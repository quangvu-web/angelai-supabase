// knowledge-save-chat — Admin lưu 1 turn hỏi/đáp tốt từ chat vào knowledge base.
// Auth: user JWT (admin).
// Body: { question: string, answer: string, title?: string, folder_id?: string | null,
//         session_id?: string | null, language?: "vi" | "en" }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkDuplicate } from "../_shared/knowledge-dedup.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "missing_auth" }, 401);

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: userData, error: uErr } = await anon.auth.getUser(token);
  if (uErr || !userData?.user) return json({ error: "invalid_token" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return json({ error: "not_admin" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const question = String(body?.question ?? "").trim();
  const answer = String(body?.answer ?? "").trim();
  if (!answer || answer.length < 40) return json({ error: "answer_too_short" }, 400);

  const language = body?.language === "en" ? "en" : "vi";
  const providedTitle: string = typeof body?.title === "string" ? body.title.trim() : "";
  const folderId: string | null = typeof body?.folder_id === "string" ? body.folder_id : null;
  const sessionId: string | null = typeof body?.session_id === "string" ? body.session_id : null;

  const content = question
    ? `# Câu hỏi\n${question}\n\n# Trả lời của Angel\n${answer}`
    : answer;

  const dedup = await checkDuplicate(admin, content);
  if (dedup.duplicate) {
    return json({
      ok: false,
      status: "duplicate",
      skipped: true,
      duplicate: true,
      document_id: dedup.existing_id,
      message: "Câu trả lời này đã có trong knowledge — bỏ qua, không tạo bản mới.",
    }, 200);
  }

  const title = (providedTitle || question || answer.slice(0, 80) || "Chat snippet").slice(0, 300);
  const now = new Date().toISOString();

  const { data: inserted, error } = await admin
    .from("knowledge_documents")
    .insert({
      title,
      description: "Saved from Angel chat",
      file_name: `chat-${Date.now()}.md`,
      file_url: `chat://session/${sessionId ?? "adhoc"}`,
      file_type: "text/markdown",
      file_size: content.length,
      extracted_content: content,
      is_processed: false,
      folder_id: folderId,
      source: "chat_save",
      source_ref: sessionId ?? userData.user.id,
      content_hash: dedup.content_hash,
      metadata: {
        origin: "knowledge-save-chat",
        session_id: sessionId,
        saved_by: userData.user.id,
      },
      language,
      ingest_status: "pending",
      created_by: userData.user.id,
      knowledge_status: "active",
      effective_from: now,
    })
    .select("id, title")
    .single();

  if (error) return json({ error: "insert_failed", detail: error.message }, 500);

  return json({
    ok: true,
    status: "created",
    duplicate: false,
    document_id: inserted.id,
    title: inserted.title,
    message: "Đã lưu vào knowledge. Cron sẽ embed trong vài phút.",
  });
});
