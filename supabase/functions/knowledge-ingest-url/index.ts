// knowledge-ingest-url — Nạp kiến thức từ URL bất kỳ.
// Auth: user JWT (admin) HOẶC header `x-api-key: <ANGEL_KNOWLEDGE_INGEST_KEY>`.
// Body: { url: string, title?: string, folder_id?: string | null, language?: "vi" | "en" }
//
// Luồng: fetch URL → strip HTML → dedup theo content_hash → tạo knowledge_documents
// (ingest_status='pending'). Cron `knowledge-ingest` sẽ tự embed thành chunks.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkDuplicate } from "../_shared/knowledge-dedup.ts";
import { titleFromUrl } from "../_shared/knowledge-title.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_KEY = Deno.env.get("ANGEL_KNOWLEDGE_INGEST_KEY") ?? "";

const MAX_BYTES = 5_000_000; // 5MB HTML cap
const MAX_CONTENT_CHARS = 200_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractText(html: string): { title: string; text: string } {
  let doc = html;
  // Grab <title>
  const titleMatch = doc.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(stripTags(titleMatch[1])).trim() : "";
  // Remove scripts/styles/nav/footer/aside/header
  doc = doc.replace(/<script[\s\S]*?<\/script>/gi, " ");
  doc = doc.replace(/<style[\s\S]*?<\/style>/gi, " ");
  doc = doc.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  doc = doc.replace(/<(nav|footer|aside|header|form|iframe)[\s\S]*?<\/\1>/gi, " ");
  // Prefer <article> or <main>
  const article = doc.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i);
  const body = article ? article[2] : doc;
  // Convert block tags to newlines
  const text = body
    .replace(/<\/(p|div|li|h[1-6]|br|section|tr)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  return { title, text: decodeEntities(stripTags(text)) };
}

function stripTags(s: string) {
  return s.replace(/<[^>]+>/g, " ");
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function authorize(req: Request): Promise<{ ok: boolean; userId?: string; reason?: string }> {
  const apiKey = req.headers.get("x-api-key") ?? "";
  if (INGEST_KEY && apiKey && apiKey === INGEST_KEY) {
    return { ok: true };
  }
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { ok: false, reason: "missing_auth" };
  const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const { data: userData, error } = await anonClient.auth.getUser(token);
  if (error || !userData?.user) return { ok: false, reason: "invalid_token" };
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return { ok: false, reason: "not_admin" };
  return { ok: true, userId: userData.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authorize(req);
  if (!auth.ok) return json({ error: "unauthorized", reason: auth.reason }, 401);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  if (!/^https?:\/\//i.test(url)) return json({ error: "invalid_url" }, 400);
  const folderId: string | null = typeof payload?.folder_id === "string" ? payload.folder_id : null;
  const language: string = payload?.language === "en" ? "en" : "vi";
  const providedTitle: string | null = typeof payload?.title === "string" ? payload.title.trim() : null;

  // Fetch page
  let html = "";
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AngelAI-Ingest/1.0; +https://angel.fun.rich)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!resp.ok) return json({ error: "fetch_failed", status: resp.status }, 502);
    const ct = resp.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ct) && !ct.startsWith("text/")) {
      return json({ error: "unsupported_content_type", content_type: ct }, 415);
    }
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return json({ error: "page_too_large", bytes: buf.byteLength }, 413);
    html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch (e) {
    return json({ error: "fetch_exception", detail: String(e).slice(0, 240) }, 502);
  }

  const { title: extractedTitle, text } = extractText(html);
  const content = text.slice(0, MAX_CONTENT_CHARS);
  if (content.length < 80) return json({ error: "empty_content" }, 422);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Anti-duplicate
  const dedup = await checkDuplicate(admin, content);
  if (dedup.duplicate) {
    return json({
      ok: false,
      status: "duplicate",
      skipped: true,
      duplicate: true,
      document_id: dedup.existing_id,
      title: dedup.existing_title,
      message: "Nội dung đã tồn tại trong knowledge (cùng content_hash) — bỏ qua, không tạo bản mới.",
    }, 200);
  }

  const title = providedTitle || extractedTitle || titleFromUrl(url);
  const now = new Date().toISOString();
  const fileName = `url-${new URL(url).hostname}-${Date.now()}.txt`;

  const { data: inserted, error: insErr } = await admin
    .from("knowledge_documents")
    .insert({
      title: title.slice(0, 300),
      description: `Ingested from ${url}`,
      file_name: fileName,
      file_url: url,
      file_type: "text/html",
      file_size: content.length,
      extracted_content: content,
      is_processed: false,
      folder_id: folderId,
      source: "url_ingest",
      source_ref: url,
      source_url: url,
      content_hash: dedup.content_hash,
      metadata: { origin: "knowledge-ingest-url", host: new URL(url).hostname },
      language,
      ingest_status: "pending",
      created_by: auth.userId ?? null,
      knowledge_status: "active",
      effective_from: now,
    })
    .select("id, title")
    .single();

  if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

  return json({
    ok: true,
    status: "created",
    duplicate: false,
    document_id: inserted.id,
    title: inserted.title,
    content_length: content.length,
    message: "Đã lưu. Cron knowledge-ingest sẽ embed trong vài phút.",
  });
});
