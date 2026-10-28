// knowledge-external-ingest — Endpoint chuẩn cho hệ thống bên ngoài (FUN Profile,
// Telegram, Facebook, YouTube, Website…) đẩy tài liệu vào RAG của Angel AI.
//
// Auth: header `x-api-key: <ANGEL_KNOWLEDGE_INGEST_KEY>`
// Actions: upsert | delete | status
//
// Xem docs: /docs/knowledge-ingest-api
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logAiProviderUsage, withCloudUsage } from "../_shared/cost-guards.ts";
import { EMBED_DIMS, embedTexts } from "../_shared/embeddings.ts";
import { canonicalKnowledgeFolder } from "../_shared/knowledge-folders.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INGEST_KEY = Deno.env.get("ANGEL_KNOWLEDGE_INGEST_KEY") ?? "";

const EMBED_BATCH = 32;
const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 200;

const MAX_CONTENT = 200_000;
const MAX_TITLE = 300;
const MAX_BATCH_DOCS = 200;
const RATE_LIMIT_PER_MIN = 60;

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- helpers ----------
async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const sanitize = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    .replace(/[\u2028\u2029\uFDD0-\uFDEF\uFFFE\uFFFF]/g, "");

const transportSafe = (s: string | null) => {
  if (s == null) return null;
  return sanitize(s)
    .replace(/[\u200B-\u200D\uFE0E\uFE0F]/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, "")
    .trim();
};

function vectorToText(vector: number[], context: string) {
  if (!Array.isArray(vector) || vector.length !== EMBED_DIMS) {
    throw new Error(`bad_embedding_shape:${context}:${Array.isArray(vector) ? vector.length : "not_array"}`);
  }
  const clean = vector.map((value) => Number.isFinite(value) ? value : 0);
  return `[${clean.join(",")}]`;
}

async function insertChunkRows(supabase: any, docId: string, rows: Array<Record<string, unknown>>) {
  for (let i = 0; i < rows.length; i += 5) {
    const slice = rows.slice(i, i + 5).map((row) => ({
      document_id: docId,
      chunk_text: transportSafe(String(row.chunk_text ?? "")),
      chunk_order: Number(row.chunk_order ?? 0),
      doc_title: transportSafe(String(row.doc_title ?? "")),
      folder_name: transportSafe(typeof row.folder_name === "string" ? row.folder_name : null),
      token_count: Number(row.token_count ?? 0),
      embedding: String(row.embedding ?? ""),
      embed_model: String(row.embed_model ?? ""),
      embedded_at: String(row.embedded_at ?? new Date().toISOString()),
      keywords: [],
      category: null,
      chunk_type: String(row.chunk_type ?? "body"),
    }));

    const { error } = await supabase.from("knowledge_chunks").insert(slice);
    if (error) {
      console.error("[knowledge-external-ingest] direct insert err", docId, error.message);
      throw new Error(`insert chunks direct: ${error.message.slice(0, 240)}`);
    }
  }
}

function buildFallbackUrl(
  source: string,
  source_ref: string,
  metadata: any,
  providedUrl: unknown,
): string {
  const u = typeof providedUrl === "string" ? providedUrl.trim() : "";
  if (u && /^https?:\/\//i.test(u)) return u;

  if (source === "telegram_channel" && metadata && typeof metadata === "object") {
    const chatId = metadata.chat_id;
    const messageId = metadata.message_id;
    const username = typeof metadata.channel_username === "string"
      ? metadata.channel_username.replace(/^@/, "").trim()
      : "";
    if (messageId != null) {
      if (username) return `https://t.me/${username}/${messageId}`;
      if (typeof chatId === "number") {
        const abs = String(Math.abs(chatId));
        const stripped = abs.startsWith("100") ? abs.slice(3) : abs;
        return `https://t.me/c/${stripped}/${messageId}`;
      }
    }
  }

  const safeRef = encodeURIComponent(source_ref || "unknown");
  const safeSrc = encodeURIComponent(source || "external");
  return `internal://${safeSrc}/${safeRef}`;
}

// Lấy danh sách media (ảnh/video) từ payload: chấp nhận `media: [{type,url}]`
// hoặc `image_url` đơn lẻ; chỉ giữ URL https hợp lệ, tối đa 10 mục.
function extractMedia(d: any): { type: string; url: string }[] | null {
  const out: { type: string; url: string }[] = [];
  const push = (type: unknown, url: unknown) => {
    if (typeof url !== "string") return;
    const u = url.trim();
    if (!/^https:\/\//i.test(u) || u.length > 2048) return;
    const t = typeof type === "string" && type ? type.slice(0, 20) : "photo";
    if (!out.some((m) => m.url === u)) out.push({ type: t, url: u });
  };
  if (Array.isArray(d?.media)) {
    for (const m of d.media) push(m?.type, m?.url);
  }
  push("photo", d?.image_url);
  const media = out.slice(0, 10);
  return media.length ? media : null;
}

function chunkText(raw: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const text = raw.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!text) return [];
  const sections = text.split(/\n(?=#{1,6}\s)|\n\n+/);
  const out: string[] = [];
  let buf = "";
  for (const p of sections) {
    const piece = p.trim();
    if (!piece) continue;
    if ((buf + "\n\n" + piece).length <= size) {
      buf = buf ? buf + "\n\n" + piece : piece;
    } else {
      if (buf) out.push(buf);
      if (piece.length <= size) {
        buf = piece;
      } else {
        for (let i = 0; i < piece.length; i += size - overlap) out.push(piece.slice(i, i + size));
        buf = "";
      }
    }
  }
  if (buf) out.push(buf);
  const withOverlap: string[] = [];
  for (let i = 0; i < out.length; i++) {
    let cur = out[i];
    if (i > 0 && overlap > 0) {
      const prev = out[i - 1];
      cur = prev.slice(Math.max(0, prev.length - overlap)) + " " + cur;
    }
    withOverlap.push(cur.trim());
  }
  return withOverlap.filter((c) => c.length > 30);
}

async function embedBatch(inputs: string[]): Promise<{ vectors: number[][]; model: string; provider: string }> {
  const result = await embedTexts(inputs, { taskType: "RETRIEVAL_DOCUMENT" });
  await logAiProviderUsage({
    functionName: "knowledge-external-ingest",
    provider: result.provider,
    model: result.model || "n/a",
    status: result.status,
    estimatedInputTokens: Math.ceil(inputs.join("\n").length / 4),
    metadata: { input_count: inputs.length, errors: result.errors ?? null },
  }).catch(() => {});
  if (result.vectors.length !== inputs.length) {
    throw new Error(`embed_all_providers_failed: ${(result.errors ?? []).join(" | ").slice(0, 300)}`);
  }
  return { vectors: result.vectors, model: result.model, provider: result.provider };
}

async function chunkAndEmbed(
  supabase: any,
  docId: string,
  content: string,
  title: string,
  folderName: string | null,
) {
  const safeTitle = transportSafe(title || "") ?? "";
  const safeFolder = folderName ? transportSafe(folderName) : null;
  const metaPrefix = `[Tài liệu: ${safeTitle}]${safeFolder ? ` [Thư mục: ${safeFolder}]` : ""}\n`;
  const bodyChunks = chunkText(content);
  if (bodyChunks.length === 0) {
    await supabase.from("knowledge_documents").update({
      ingest_status: "failed",
      ingest_error: "no_content_after_chunk",
      chunk_count: 0,
    }).eq("id", docId);
    return { chunks: 0, status: "failed" };
  }
  const summaryHead = (transportSafe(content) ?? "").slice(0, 400).replace(/\s+/g, " ").trim();
  const titleChunkText = `${safeTitle}${safeFolder ? ` — ${safeFolder}` : ""}. ${summaryHead}`;
  await supabase.from("knowledge_documents").update({ ingest_status: "processing" }).eq("id", docId);
  await supabase.from("knowledge_chunks").delete().eq("document_id", docId);

  const bodyInputs = bodyChunks.map((c) => transportSafe(metaPrefix + c) ?? "");
  const allInputs = [titleChunkText, ...bodyInputs];
  const allEmbeddings: number[][] = [];
  let usedModel = "";
  let usedProvider = "";
  for (let i = 0; i < allInputs.length; i += EMBED_BATCH) {
    const { vectors, model, provider } = await embedBatch(allInputs.slice(i, i + EMBED_BATCH));
    allEmbeddings.push(...vectors);
    usedModel = model;
    usedProvider = provider;
  }
  const rows = allInputs.map((text, idx) => ({
    chunk_text: text,
    chunk_order: idx,
    doc_title: safeTitle,
    folder_name: safeFolder,
    token_count: Math.ceil(text.length / 4),
    embedding: vectorToText(allEmbeddings[idx], `${docId}:${idx}`),
    embed_model: `${usedProvider}:${usedModel}`,
    embedded_at: new Date().toISOString(),
    chunk_type: idx === 0 ? "title" : "body",
  }));
  await insertChunkRows(supabase, docId, rows);
  await supabase.from("knowledge_documents").update({
    ingest_status: "ready",
    ingest_error: null,
    ingested_at: new Date().toISOString(),
    chunk_count: rows.length,
    is_processed: true,
  }).eq("id", docId);
  return { chunks: rows.length, status: "ready" };
}

async function checkRateLimit(supabase: any, keyHash: string): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const { data } = await supabase
    .from("knowledge_ingest_rate_limit")
    .select("count")
    .eq("api_key_hash", keyHash)
    .eq("window_start", windowStart)
    .maybeSingle();
  const cur = data?.count ?? 0;
  if (cur >= RATE_LIMIT_PER_MIN) return false;
  await supabase.from("knowledge_ingest_rate_limit").upsert(
    { api_key_hash: keyHash, window_start: windowStart, count: cur + 1 },
    { onConflict: "api_key_hash,window_start" },
  );
  return true;
}

// Chuẩn hoá tên folder: fix typo, chuẩn hoá prefix Telegram, trim, giới hạn 120 ký tự.
function normalizeFolderName(raw: string): string {
  let n = raw.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
             .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1");
  n = n.replace(/KNOWNLEDGE/gi, "KNOWLEDGE");
  n = n.replace(/^\s*Telegram\s+Files\s*\/\s*/i, "Telegram / ");
  n = n.replace(/\s+/g, " ").trim();
  if (n.length > 120) n = n.slice(0, 120).trim();
  return n;
}

async function ensureFolder(supabase: any, rawName: string | null): Promise<string | null> {
  const name = canonicalKnowledgeFolder(normalizeFolderName(String(rawName ?? "Các tài liệu khác")));
  if (!name) return null;
  // Idempotent: dựa vào UNIQUE INDEX (lower(trim(name))) trong DB.
  // Case-insensitive lookup TRƯỚC để không tạo bản trùng khác hoa/thường.
  const { data: existing } = await supabase
    .from("knowledge_folders")
    .select("id, name")
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from("knowledge_folders")
    .insert({ name })
    .select("id")
    .maybeSingle();
  if (created?.id) return created.id;
  // Race: nếu insert lỗi duplicate → SELECT lại
  if (error) {
    const { data: retry } = await supabase
      .from("knowledge_folders")
      .select("id")
      .eq("name", name)
      .limit(1)
      .maybeSingle();
    return retry?.id ?? null;
  }
  return null;
}

// Đọc cấu hình filter chất lượng cho folder Telegram (match theo LIKE pattern, chọn cụ thể nhất).
type TgConfig = {
  paused: boolean;
  min_content_length: number;
  min_meaningful_words: number;
  require_role: string | null;
};
async function loadTelegramConfig(
  supabase: any,
  folderName: string | null,
): Promise<TgConfig | null> {
  if (!folderName) return null;
  const { data } = await supabase
    .from("telegram_ingest_config")
    .select("folder_pattern, paused, min_content_length, min_meaningful_words, require_role")
    .order("folder_pattern", { ascending: false }); // pattern dài hơn = cụ thể hơn
  if (!Array.isArray(data)) return null;
  const like2re = (p: string) =>
    new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i");
  for (const row of data) {
    if (like2re(row.folder_pattern).test(folderName)) return row;
  }
  return null;
}

// Lọc chất lượng đầu vào cho Telegram (dùng ngưỡng từ config nếu có).
function isLowQualityTelegramContent(
  source: string,
  content: string,
  cfg: TgConfig | null,
): boolean {
  if (!source.toLowerCase().startsWith("telegram")) return false;
  const minLen = cfg?.min_content_length ?? 40;
  const minWords = cfg?.min_meaningful_words ?? 6;
  const stripped = content
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length < minLen) return true;
  const words = stripped.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < minWords) return true;
  return false;
}


async function writeAudit(
  supabase: any,
  row: {
    api_key_hash: string;
    action: string;
    docs_count?: number;
    success_count?: number;
    error_count?: number;
    http_status?: number;
    sample_error?: string | null;
    sample_source?: string | null;
    sample_source_ref?: string | null;
    request_bytes?: number | null;
    duration_ms?: number | null;
    ip_hash?: string | null;
    user_agent?: string | null;
    created_count?: number;
    updated_count?: number;
    duplicate_count?: number;
    skipped_count?: number;
    low_content_count?: number;
  },
) {
  try {
    await supabase.from("knowledge_ingest_audit").insert(row);
  } catch (e) {
    console.error("[audit] insert failed:", String(e).slice(0, 200));
  }
}

// ---------- handler ----------
Deno.serve(withCloudUsage("knowledge-external-ingest", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();
  const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("cf-connecting-ip") ?? "";
  const ipHash = rawIp ? await sha256(rawIp) : null;

  if (req.method !== "POST") {
    console.log(`[knowledge-external-ingest] rejected method=${req.method}`);
    return json({ error: "method_not_allowed" }, 405);
  }

  const apiKey = req.headers.get("x-api-key") ?? "";
  const keyHash = apiKey ? await sha256(apiKey) : "no_key";
  const BOT_KEY = Deno.env.get("ANGEL_KNOWLEDGE_INGEST_KEY_FUNRICHBOT") ?? "";
  let client: "fun_profile" | "fun_rich_bot" | null = null;
  if (apiKey && INGEST_KEY && apiKey === INGEST_KEY) client = "fun_profile";
  else if (apiKey && BOT_KEY && apiKey === BOT_KEY) client = "fun_rich_bot";
  if (!client) {
    const headerNames = [...req.headers.keys()]
      .filter((h) => /key|auth/i.test(h)).join(",");
    console.log(`[knowledge-external-ingest] unauthorized key_prefix=${apiKey.slice(0, 4)} auth_headers=${headerNames}`);
    await writeAudit(createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }), {
      api_key_hash: keyHash, action: "auth_failed", http_status: 401,
      sample_error: `unauthorized prefix=${apiKey.slice(0, 4) || "none"} headers=${headerNames || "none"}`.slice(0, 300),
      duration_ms: Date.now() - started, ip_hash: ipHash, user_agent: userAgent,
    });
    return json({ error: "unauthorized", hint: "send header x-api-key with the ingest key issued for your client" }, 401);
  }
  console.log(`[knowledge-external-ingest] client=${client}`);

  const rawBody = await req.text();
  const requestBytes = rawBody.length;
  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    const supabase0 = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    await writeAudit(supabase0, {
      api_key_hash: keyHash,
      action: "invalid_json",
      http_status: 400,
      sample_error: "invalid_json",
      request_bytes: requestBytes,
      duration_ms: Date.now() - started,
      ip_hash: ipHash,
      user_agent: userAgent,
    });
    console.log("[knowledge-external-ingest] invalid_json bytes=" + requestBytes);
    return json({ error: "invalid_payload", detail: "invalid_json" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const ok = await checkRateLimit(supabase, keyHash);
  if (!ok) {
    await writeAudit(supabase, {
      api_key_hash: keyHash,
      action: String(body?.action ?? ""),
      http_status: 429,
      sample_error: "rate_limited",
      request_bytes: requestBytes,
      duration_ms: Date.now() - started,
      ip_hash: ipHash,
      user_agent: userAgent,
    });
    return json({ error: "rate_limited", retry_after: 60 }, 429);
  }

  const action = String(body?.action ?? "").toLowerCase();
  console.log(`[knowledge-external-ingest] action=${action} bytes=${requestBytes}`);

  // ---------- DELETE ----------
  if (action === "delete") {
    const src = body?.source;
    const ref = body?.source_ref;
    if (!src) {
      await writeAudit(supabase, {
        api_key_hash: keyHash, action, http_status: 400,
        sample_error: "source required", request_bytes: requestBytes,
        duration_ms: Date.now() - started, ip_hash: ipHash, user_agent: userAgent,
      });
      return json({ error: "invalid_payload", detail: "source required" }, 400);
    }
    let q = supabase.from("knowledge_documents").delete().eq("source", src);
    if (ref) q = q.eq("source_ref", ref);
    const { error, count } = await q.select("id", { count: "exact" });
    if (error) {
      await writeAudit(supabase, {
        api_key_hash: keyHash, action, http_status: 500,
        sample_error: error.message.slice(0, 300), sample_source: src, sample_source_ref: ref ?? null,
        request_bytes: requestBytes, duration_ms: Date.now() - started,
        ip_hash: ipHash, user_agent: userAgent,
      });
      return json({ error: "internal_error", detail: error.message }, 500);
    }
    await writeAudit(supabase, {
      api_key_hash: keyHash, action, docs_count: count ?? 0, success_count: count ?? 0,
      sample_source: src, sample_source_ref: ref ?? null,
      request_bytes: requestBytes, duration_ms: Date.now() - started,
      ip_hash: ipHash, user_agent: userAgent,
    });
    return json({ ok: true, deleted: count ?? 0 });
  }

  // ---------- STATUS ----------
  if (action === "status") {
    const src = body?.source;
    const refs: string[] = Array.isArray(body?.source_refs) ? body.source_refs : [];
    if (!src || refs.length === 0) {
      await writeAudit(supabase, {
        api_key_hash: keyHash, action, http_status: 400,
        sample_error: "source + source_refs required",
        request_bytes: requestBytes, duration_ms: Date.now() - started,
        ip_hash: ipHash, user_agent: userAgent,
      });
      return json({ error: "invalid_payload" }, 400);
    }
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("id, source_ref, ingest_status, chunk_count, ingest_error, ingested_at, file_url")
      .eq("source", src)
      .in("source_ref", refs);
    if (error) {
      await writeAudit(supabase, {
        api_key_hash: keyHash, action, http_status: 500,
        sample_error: error.message.slice(0, 300), sample_source: src,
        request_bytes: requestBytes, duration_ms: Date.now() - started,
        ip_hash: ipHash, user_agent: userAgent,
      });
      return json({ error: "internal_error", detail: error.message }, 500);
    }
    const byRef = new Map<string, any>();
    for (const row of data ?? []) byRef.set(row.source_ref, row);
    const items = refs.map((ref) => {
      const row = byRef.get(ref);
      if (!row) {
        return { source: src, source_ref: ref, status: "missing", document_id: null, file_url: null, chunk_count: 0 };
      }
      const status = row.ingest_status === "ready" ? "persisted" : (row.ingest_status ?? "unknown");
      return {
        source: src,
        source_ref: ref,
        status,
        document_id: row.id,
        file_url: row.file_url ?? null,
        chunk_count: row.chunk_count ?? 0,
        ingest_error: row.ingest_error ?? null,
      };
    });
    await writeAudit(supabase, {
      api_key_hash: keyHash, action, docs_count: refs.length, success_count: (data ?? []).length,
      sample_source: src, request_bytes: requestBytes, duration_ms: Date.now() - started,
      ip_hash: ipHash, user_agent: userAgent,
    });
    return json({ ok: true, items });
  }

  // ---------- UPSERT ----------
  if (action === "upsert") {
    const docs: any[] = Array.isArray(body?.documents) ? body.documents : [];
    if (docs.length === 0) {
      // Log rõ để chẩn đoán: payload có nhưng thiếu "documents"
      const topKeys = Object.keys(body ?? {}).join(",");
      console.log(`[knowledge-external-ingest] upsert missing documents. top_keys=[${topKeys}]`);
      await writeAudit(supabase, {
        api_key_hash: keyHash, action, http_status: 400,
        sample_error: `documents required. top_keys=[${topKeys}]`,
        request_bytes: requestBytes, duration_ms: Date.now() - started,
        ip_hash: ipHash, user_agent: userAgent,
      });
      return json({ error: "invalid_payload", detail: "documents required" }, 400);
    }
    if (docs.length > MAX_BATCH_DOCS) {
      await writeAudit(supabase, {
        api_key_hash: keyHash, action, http_status: 413, docs_count: docs.length,
        sample_error: `batch>${MAX_BATCH_DOCS}`,
        request_bytes: requestBytes, duration_ms: Date.now() - started,
        ip_hash: ipHash, user_agent: userAgent,
      });
      return json({ error: "content_too_large", detail: `batch>${MAX_BATCH_DOCS}` }, 413);
    }

    const opts = body?.options ?? {};
    const chunkNow = body?.chunk_now === true || opts.chunk_now === true;

    const results: any[] = [];
    let success = 0;
    let errors = 0;
    let firstError: string | null = null;
    let firstSource: string | null = null;
    let firstRef: string | null = null;
    for (const d of docs) {
      const source = String(d?.source ?? "").trim();
      const source_ref = String(d?.source_ref ?? "").trim();
      const title = String(d?.title ?? "").trim();
      const content = String(d?.content ?? "");
      if (!source || !source_ref || !title || !content) {
        const missing = [
          !source && "source", !source_ref && "source_ref",
          !title && "title", !content && "content",
        ].filter(Boolean).join(",");
        console.log(`[knowledge-external-ingest] doc missing fields=[${missing}] ref=${source_ref}`);
        results.push({ source_ref, status: "error", error_code: "missing_required_field", error: `missing_required_field:${missing}`, missing });
        errors++;
        if (!firstError) { firstError = `missing_required_field:${missing}`; firstSource = source || null; firstRef = source_ref || null; }
        continue;
      }
      if (title.length > MAX_TITLE) {
        results.push({ source_ref, status: "error", error_code: "title_too_long", error: "title_too_long" });
        errors++;
        if (!firstError) { firstError = "title_too_long"; firstSource = source; firstRef = source_ref; }
        continue;
      }
      if (content.length > MAX_CONTENT) {
        results.push({ source_ref, status: "error", error_code: "content_too_large", error: "content_too_large" });
        errors++;
        if (!firstError) { firstError = "content_too_large"; firstSource = source; firstRef = source_ref; }
        continue;
      }

      const normalizedFolder = d?.folder ? normalizeFolderName(String(d.folder)) : null;
      if (normalizedFolder && !canonicalKnowledgeFolder(normalizedFolder)) {
        results.push({ source_ref, status: "skipped", reason: "folder_requires_admin_mapping" });
        continue;
      }
      const tgCfg = await loadTelegramConfig(supabase, normalizedFolder);

      // Pause: config bảo tạm dừng ingest cho folder này.
      if (tgCfg?.paused) {
        results.push({ source_ref, status: "skipped", reason: "folder_paused" });
        continue;
      }

      // Role gate: config yêu cầu author role cụ thể (admin/coordinator).
      if (tgCfg?.require_role) {
        const authorRole = String(d?.metadata?.author_role ?? "").toLowerCase();
        if (authorRole !== tgCfg.require_role.toLowerCase()) {
          results.push({ source_ref, status: "skipped", reason: "role_required" });
          continue;
        }
      }

      // Quality filter (dùng ngưỡng từ config).
      if (isLowQualityTelegramContent(source, content, tgCfg)) {
        results.push({ source_ref, status: "skipped", reason: "low_quality" });
        continue;
      }

      const contentHash = await sha256(content);

      // Cross-source dedup: nếu 1 document khác đã có cùng content_hash → skip
      // (áp dụng cho MỌI source, không chỉ telegram, để tránh "báo thành công giả").
      {
        const { data: dup } = await supabase
          .from("knowledge_documents")
          .select("id, source, source_ref")
          .eq("content_hash", contentHash)
          .is("deleted_at", null)
          .or(`source.neq.${source},source_ref.neq.${source_ref}`)
          .limit(1)
          .maybeSingle();
        if (dup) {
          results.push({
            source_ref,
            status: "duplicate",
            action: "skipped",
            reason: "duplicate_content",
            duplicate_of: dup.id,
            duplicate_source: dup.source,
            duplicate_source_ref: dup.source_ref,
          });
          continue;
        }
      }

      const folderId = await ensureFolder(supabase, d?.folder ?? null);
      const fallbackUrl = buildFallbackUrl(source, source_ref, d?.metadata, d?.url);
      const fileSize = new TextEncoder().encode(content).length;
      const media = extractMedia(d);
      const mergedMetadata = { ...(d?.metadata ?? {}), ...(media ? { media } : {}) };

      const { data: existing } = await supabase
        .from("knowledge_documents")
        .select("id, content_hash, ingest_status")
        .eq("source", source)
        .eq("source_ref", source_ref)
        .maybeSingle();

      let docId: string;
      let actionTaken: "created" | "updated" | "unchanged" = "created";

      if (existing) {
        docId = existing.id;
        if (existing.content_hash === contentHash) {
          // Same source_ref + same content → không tạo mới, không tính là success.
          results.push({
            source_ref,
            document_id: docId,
            status: "duplicate",
            action: "unchanged",
            reason: "same_source_ref_same_hash",
            ingest_status: existing.ingest_status,
          });
          continue;
        }

        actionTaken = "updated";
        await supabase.from("knowledge_documents").update({
          title,
          extracted_content: content,
          content_hash: contentHash,
          source_url: fallbackUrl,
          file_url: fallbackUrl,
          file_size: fileSize,
          language: d?.language ?? "vi",
          metadata: mergedMetadata,
          folder_id: folderId,
          file_name: title.slice(0, 200) || source_ref,
          file_type: "text/plain",
          ingest_status: "pending",
          ingest_error: null,
        }).eq("id", docId);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("knowledge_documents")
          .insert({
            title,
            extracted_content: content,
            content_hash: contentHash,
            source,
            source_ref,
            source_url: fallbackUrl,
            file_url: fallbackUrl,
            file_size: fileSize,
            language: d?.language ?? "vi",
            metadata: mergedMetadata,
            folder_id: folderId,
            file_name: title.slice(0, 200) || source_ref,
            file_type: "text/plain",
            ingest_status: "pending",
          })
          .select("id")
          .single();
        if (insErr || !inserted) {
          const msg = insErr?.message ?? "insert_failed";
          console.log(`[knowledge-external-ingest] insert failed src=${source} ref=${source_ref} err=${msg}`);
          results.push({ source_ref, status: "error", error_code: "db_insert_failed", error: msg });
          errors++;
          if (!firstError) { firstError = msg.slice(0, 300); firstSource = source; firstRef = source_ref; }
          continue;
        }
        docId = inserted.id;
      }

      if (chunkNow) {
        try {
          const r = await chunkAndEmbed(supabase, docId, content, title, d?.folder ?? null);
          results.push({ source_ref, document_id: docId, status: r.status, chunks: r.chunks, action: actionTaken });
          success++;
        } catch (e) {
          const msg = String(e).slice(0, 300);
          const lower = msg.toLowerCase();
          const errCode = lower.includes("embed") ? "embedding_failed"
            : lower.includes("insert chunks") ? "chunk_insert_failed"
            : lower.includes("no_content") ? "no_content_after_chunk"
            : "chunk_pipeline_failed";
          await supabase.from("knowledge_documents").update({
            ingest_status: "failed",
            ingest_error: msg.slice(0, 500),
          }).eq("id", docId);
          results.push({ source_ref, document_id: docId, status: "error", error_code: errCode, error: msg.slice(0, 200), action: actionTaken });
          errors++;
          if (!firstError) { firstError = msg; firstSource = source; firstRef = source_ref; }
        }
      } else {
        results.push({ source_ref, document_id: docId, status: "queued", chunks: 0, action: actionTaken });
        success++;
      }
    }

    const duplicates = results.filter((r) => r?.status === "duplicate").length;
    const skipped = results.filter((r) => r?.status === "skipped").length;
    const created = results.filter((r) => r?.action === "created" && r?.status !== "error").length;
    const updated = results.filter((r) => r?.action === "updated" && r?.status !== "error").length;
    // low_content: doc source=google_doc và content < 500 ký tự
    let lowContent = 0;
    for (const d of docs) {
      const src = String(d?.source ?? "").trim();
      const c = String(d?.content ?? "");
      if (src === "google_doc" && c.length > 0 && c.length < 500) lowContent++;
    }
    console.log(`[knowledge-external-ingest] upsert done docs=${docs.length} ok=${success} created=${created} updated=${updated} dup=${duplicates} skip=${skipped} low=${lowContent} err=${errors}`);
    const skippedList = results.filter((r) => r?.status === "skipped");
    const skipNote = skippedList.length
      ? "skipped: " + skippedList.map((r) => `${r?.source_ref ?? "?"}(${r?.reason ?? "?"})`).join(", ")
      : null;
    const firstSkip = skippedList[0];
    await writeAudit(supabase, {
      api_key_hash: keyHash, action,
      docs_count: docs.length, success_count: success, error_count: errors,
      created_count: created, updated_count: updated,
      duplicate_count: duplicates, skipped_count: skipped,
      low_content_count: lowContent,
      sample_error: (firstError ?? skipNote)?.slice(0, 300) ?? null,
      sample_source: firstSource ?? (docs[0]?.source ?? null),
      sample_source_ref: firstRef ?? firstSkip?.source_ref ?? (docs[0]?.source_ref ?? null),
      request_bytes: requestBytes, duration_ms: Date.now() - started,
      ip_hash: ipHash, user_agent: userAgent,
    });

    return json({
      ok: errors === 0,
      processed: results.length,
      success,
      created,
      updated,
      duplicates,
      skipped,
      low_content: lowContent,
      errors,
      results,
    });
  }

  console.log(`[knowledge-external-ingest] unknown action=${action}`);
  await writeAudit(supabase, {
    api_key_hash: keyHash, action: action || "empty",
    http_status: 400, sample_error: `unknown_action:${action}`,
    request_bytes: requestBytes, duration_ms: Date.now() - started,
    ip_hash: ipHash, user_agent: userAgent,
  });
  return json({ error: "invalid_payload", detail: "unknown action" }, 400);
}));
