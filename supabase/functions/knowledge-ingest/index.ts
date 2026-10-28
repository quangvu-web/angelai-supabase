// knowledge-ingest — Recursive chunk + title-chunk + metadata prefix
// Input: { document_id?, batch_size?=20, max_batches?=1 }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  logAiProviderUsage,
  requireAdminOrServiceRole,
  withCloudUsage,
} from "../_shared/cost-guards.ts";
import { EMBED_DIMS, embedTexts } from "../_shared/embeddings.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH = 32;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Recursive splitter: heading → paragraph → sentence, ép size ~500-800 char, overlap ~200. */
function chunkText(raw: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const text = raw.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!text) return [];

  // Bước 1: chia theo heading markdown hoặc dòng trắng đôi
  const sections = text.split(/\n(?=#{1,6}\s)|\n\n+/);
  const out: string[] = [];

  const pushMerged = (pieces: string[]) => {
    let buf = "";
    for (const p of pieces) {
      const piece = p.trim();
      if (!piece) continue;
      if ((buf + "\n\n" + piece).length <= size) {
        buf = buf ? buf + "\n\n" + piece : piece;
      } else {
        if (buf) out.push(buf);
        if (piece.length <= size) {
          buf = piece;
        } else {
          // Chia câu
          const sentences = piece.split(/(?<=[.!?…])\s+|\n+/);
          let sBuf = "";
          for (const s of sentences) {
            if (!s.trim()) continue;
            if ((sBuf + " " + s).length <= size) {
              sBuf = sBuf ? sBuf + " " + s : s;
            } else {
              if (sBuf) out.push(sBuf);
              if (s.length <= size) {
                sBuf = s;
              } else {
                // Cắt cứng
                for (let i = 0; i < s.length; i += size - overlap) {
                  out.push(s.slice(i, i + size));
                }
                sBuf = "";
              }
            }
          }
          if (sBuf) out.push(sBuf);
          buf = "";
        }
      }
    }
    if (buf) out.push(buf);
  };
  pushMerged(sections);

  // Thêm overlap giữa các chunk liền kề
  const withOverlap: string[] = [];
  for (let i = 0; i < out.length; i++) {
    let cur = out[i];
    if (i > 0 && overlap > 0) {
      const prev = out[i - 1];
      const tail = prev.slice(Math.max(0, prev.length - overlap));
      cur = tail + " " + cur;
    }
    withOverlap.push(cur.trim());
  }
  return withOverlap.filter(c => c.length > 30);
}

async function embedBatch(
  inputs: string[],
  userId: string | null,
  isServiceRole: boolean,
): Promise<{ vectors: number[][]; model: string; provider: string }> {
  const r = await embedTexts(inputs, { taskType: "RETRIEVAL_DOCUMENT" });
  await logAiProviderUsage({
    functionName: "knowledge-ingest",
    provider: r.provider,
    model: r.model || "n/a",
    status: r.status,
    userId,
    estimatedInputTokens: Math.ceil(inputs.join("\n").length / 4),
    metadata: { input_count: inputs.length, service_role: isServiceRole, errors: r.errors ?? null },
  }).catch(() => {});
  if (r.vectors.length !== inputs.length) {
    throw new Error(`embed_all_providers_failed: ${(r.errors ?? []).join(" | ").slice(0, 300)}`);
  }
  return { vectors: r.vectors, model: r.model, provider: r.provider };
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
      console.error("[knowledge-ingest] direct insert err", docId, error.message);
      throw new Error(`insert chunks direct: ${error.message.slice(0, 240)}`);
    }
  }
}

async function ingestOne(
  supabase: any,
  docId: string,
  extracted: string,
  title: string,
  folderName: string | null,
  userId: string | null,
  isServiceRole: boolean,
) {
  const safeTitle = sanitize(title || "");
  const safeFolder = folderName ? sanitize(folderName) : null;
  const metaPrefix = `[Tài liệu: ${safeTitle}]${safeFolder ? ` [Thư mục: ${safeFolder}]` : ""}\n`;

  const bodyChunks = chunkText(extracted);
  if (bodyChunks.length === 0) {
    await supabase.from("knowledge_documents").update({
      ingest_status: "failed",
      ingest_error: "no_content_after_chunk",
      chunk_count: 0,
    }).eq("id", docId);
    return { docId, chunks: 0, status: "failed" };
  }

  // Title-chunk riêng để boost recall khi user query tên bài
  const summaryHead = sanitize(extracted).slice(0, 400).replace(/\s+/g, " ").trim();
  const titleChunkText = `${safeTitle}${safeFolder ? ` — ${safeFolder}` : ""}. ${summaryHead}`;

  await supabase.from("knowledge_documents").update({ ingest_status: "processing" }).eq("id", docId);
  await supabase.from("knowledge_chunks").delete().eq("document_id", docId);

  // Embed inputs: title-chunk trước, rồi body-chunks đã prefix meta
  const bodyInputs = bodyChunks.map(c => sanitize(metaPrefix + c));
  const allInputs = [titleChunkText, ...bodyInputs];

  const allEmbeddings: number[][] = [];
  let usedModel = "";
  let usedProvider = "";
  for (let i = 0; i < allInputs.length; i += EMBED_BATCH) {
    const slice = allInputs.slice(i, i + EMBED_BATCH);
    const { vectors, model, provider } = await embedBatch(slice, userId, isServiceRole);
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

  return { docId, chunks: rows.length, status: "ready" };
}

Deno.serve(withCloudUsage("knowledge-ingest", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { document_id?: string; batch_size?: number; max_batches?: number } = {};
  try { body = await req.json(); } catch { /* empty ok */ }

  // Auth: (1) x-cron-secret cho cron nền (đối chiếu với internal_config), (2) admin JWT / service-role.
  const cronSecretHeader = req.headers.get("x-cron-secret");
  let isCron = false;
  if (cronSecretHeader) {
    try {
      const bootstrap = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
      const { data } = await bootstrap.rpc("_get_internal_config", { _key: "knowledge_ingest_cron_secret" });
      const expected = typeof data === "string" ? data : null;
      if (expected && cronSecretHeader === expected) isCron = true;
    } catch (_) { /* ignore */ }
    // Fallback: env var (nếu ai đó đặt trùng)
    if (!isCron) {
      const envSecret = Deno.env.get("KNOWLEDGE_INGEST_CRON_SECRET");
      if (envSecret && cronSecretHeader === envSecret) isCron = true;
    }
  }

  let auth: { adminUserId: string | null; isServiceRole: boolean };
  if (isCron) {
    auth = { adminUserId: null, isServiceRole: true };
  } else {
    const a = await requireAdminOrServiceRole(req);
    if (a instanceof Response) return a;
    auth = { adminUserId: a.adminUserId, isServiceRole: a.isServiceRole };
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const batchSize = Math.min(body.batch_size ?? 20, auth.isServiceRole ? 50 : 25);
  const maxBatches = Math.min(body.max_batches ?? 1, auth.isServiceRole ? 10 : 3);
  const results: any[] = [];

  const logHealth = async (status: "ok" | "degraded" | "down", detail: Record<string, unknown>) => {
    try { await supabase.from("rag_health_events").insert({ status, detail }); } catch (_) { /* ignore */ }
  };

  try {
    if (body.document_id) {
      const { data: doc, error } = await supabase
        .from("knowledge_documents")
        .select("id, title, extracted_content, folder_id, knowledge_folders(name)")
        .eq("id", body.document_id)
        .single();
      if (error || !doc) return json({ error: "not_found" }, 404);
      if (!doc.extracted_content) {
        await supabase.from("knowledge_documents").update({
          ingest_status: "failed", ingest_error: "no_extracted_content",
        }).eq("id", doc.id);
        return json({ error: "no_content" }, 400);
      }
      const folderName = (doc as any).knowledge_folders?.name ?? null;
      try {
        const r = await ingestOne(
          supabase,
          doc.id,
          doc.extracted_content,
          doc.title,
          folderName,
          auth.adminUserId,
          auth.isServiceRole,
        );
        results.push(r);
      } catch (e) {
        await supabase.from("knowledge_documents").update({
          ingest_status: "failed", ingest_error: String(e).slice(0, 500),
        }).eq("id", doc.id);
        results.push({ docId: doc.id, status: "failed", error: String(e) });
      }
      return json({ ok: true, results });
    }

    for (let b = 0; b < maxBatches; b++) {
      const { data: docs, error } = await supabase
        .from("knowledge_documents")
        .select("id, title, extracted_content, folder_id, knowledge_folders(name)")
        .in("ingest_status", ["pending", "failed"])
        .is("deleted_at", null)
        .not("extracted_content", "is", null)
        .order("created_at", { ascending: true })
        .limit(batchSize);
      if (error) return json({ error: error.message }, 500);
      if (!docs || docs.length === 0) break;

      for (const doc of docs) {
        const folderName = (doc as any).knowledge_folders?.name ?? null;
        try {
          const r = await ingestOne(
            supabase,
            doc.id,
            doc.extracted_content!,
            doc.title,
            folderName,
            auth.adminUserId,
            auth.isServiceRole,
          );
          results.push(r);
        } catch (e) {
          console.error("[knowledge-ingest] err", doc.id, e);
          await supabase.from("knowledge_documents").update({
            ingest_status: "failed", ingest_error: String(e).slice(0, 500),
          }).eq("id", doc.id);
          results.push({ docId: doc.id, status: "failed", error: String(e).slice(0, 200) });
        }
      }
    }

    const readyCount = results.filter((r) => r.status === "ready").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    if (results.length > 0) {
      await logHealth(failedCount === 0 ? "ok" : (readyCount > 0 ? "degraded" : "down"), {
        source: isCron ? "cron" : "manual",
        processed: results.length,
        ready: readyCount,
        failed: failedCount,
        first_error: results.find((r) => r.status === "failed")?.error?.toString().slice(0, 200) ?? null,
      });
    }

    return json({ ok: true, processed: results.length, ready: readyCount, failed: failedCount, results });
  } catch (e) {
    console.error("[knowledge-ingest] fatal", e);
    await logHealth("down", { source: isCron ? "cron" : "manual", reason: "exception", err: String(e).slice(0, 200) });
    return json({ error: "exception", detail: String(e) }, 500);
  }
}));
