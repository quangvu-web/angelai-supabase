import { withLanguageCheck, resolveReplyLanguage } from "../_shared/language-policy.ts";
// Angel API v1 — CANARY. Same request/response contract as angel-v1-chat.
// Adds Urantia-aware retrieval: exact-phrase + folder-scoped keyword search,
// explicit paper lookup via get_urantia_paper, vector search as fallback.
// Production function angel-v1-chat is NOT modified by this file.

import { createClient } from "npm:@supabase/supabase-js@2";
import { validateApiKey, apiKeyErrorResponse } from "../_shared/api-key-auth.ts";
import { aiChat } from "../_shared/ai-gateway.ts";
import { buildSystemPrompt } from "../_shared/angel-prompts/builder.ts";
import { searchKnowledgeInline } from "../_shared/knowledge-inline.ts";
import {
  buildAppContextBlock,
  buildSources,
  extractSuggestions,
  normalizeContextType,
  normalizePassages,
  type AppContext,
} from "../_shared/app-context.ts";

const API_VERSION = "v1";
const URANTIA_FOLDER = "SÁCH URANTIA";
const MAX_CHUNKS = 12;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-angel-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extra, "Content-Type": "application/json", "X-Angel-Api-Version": API_VERSION },
  });
}

function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return json({ error: { code, message, ...extra } }, status);
}

type Turn = { role: string; content?: unknown };

// ── Urantia intent helpers (VI + EN) ───────────────────────────────────
const URANTIA_RE = /\burantia\b|sách\s+urantia|the\s+urantia\s+book/i;

function isUrantiaQuestion(msg: string, contextType: string): boolean {
  return contextType === "urantia" || URANTIA_RE.test(msg);
}

/** "Bài 56", "bài số 56", "Paper 56", "Doc 56" → 56 */
function extractPaperNumber(msg: string): number | null {
  const m = msg.match(/\b(?:bài|b[àa]i\s*s[ốo]|paper|doc(?:ument)?)\s*(?:số\s*)?(\d{1,3})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 196 ? n : null;
}

/** Quoted phrase in the question, e.g. “Hãy hoàn hảo, như Ta là hoàn hảo”. */
function extractQuotedPhrases(msg: string): string[] {
  const out: string[] = [];
  const re = /[“"'‘„]([^”"'’”„]{8,200})[”"'’„]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg)) !== null) {
    const s = m[1].trim();
    if (s.length >= 8) out.push(s);
  }
  return out.slice(0, 3);
}

function isCitationRequest(msg: string): boolean {
  return /trích\s*dẫn|nằm\s*trong\s*bài|số\s*đoạn|nguồn|citation|which\s+paper|quote|verse/i.test(msg)
    || extractQuotedPhrases(msg).length > 0;
}

/** Progressive shortening so long quotes still match with slight wording drift. */
function phraseVariants(phrase: string): string[] {
  const clean = phrase.replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  const variants = new Set<string>([clean]);
  if (words.length > 6) variants.add(words.slice(0, 6).join(" "));
  if (words.length > 4) variants.add(words.slice(-4).join(" "));
  if (words.length > 3) variants.add(words.slice(0, 3).join(" "));
  return [...variants];
}

function escapeLike(s: string): string {
  return s.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim();
}

type Chunk = { document_id: string; doc_title: string; chunk_text: string; paper_number?: number | null };

async function attachPaperNumbers(admin: any, chunks: Chunk[]): Promise<Chunk[]> {
  const ids = [...new Set(chunks.map((c) => c.document_id))];
  if (ids.length === 0) return chunks;
  const { data } = await admin
    .from("knowledge_documents")
    .select("id, urantia_paper_number, title")
    .in("id", ids);
  const map = new Map<string, number | null>((data ?? []).map((d: any) => [d.id, d.urantia_paper_number]));
  return chunks.map((c) => ({ ...c, paper_number: map.get(c.document_id) ?? null }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const t0 = Date.now();
  const requestId = crypto.randomUUID();

  let body: { message?: unknown; language?: unknown; context?: AppContext | null; conversation?: Turn[] | null };
  try {
    body = await req.json();
  } catch {
    return fail(400, "invalid_json", "Request body must be valid JSON.");
  }

  const message = String(body.message ?? "").trim();
  if (!message) return fail(400, "invalid_request", "Field `message` is required and must be a non-empty string.");
  if (message.length > 8000) return fail(400, "invalid_request", "Field `message` exceeds 8000 characters.");


  const ctx = (body.context && typeof body.context === "object") ? body.context : null;
  const contextType = normalizeContextType(ctx?.type);
  const passages = normalizePassages(ctx);

  const conversation = (Array.isArray(body.conversation) ? body.conversation : [])
    .slice(-12)
    .map((m) => ({
      role: m?.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(m?.content ?? "").trim().slice(0, 6000),
    }))
    .filter((m) => m.content.length > 0);

  // Shared reply-language policy: latest message wins; `body.language` is only a last-resort hint.
  const priorUserTexts = conversation.filter((m) => m.role === "user").map((m) => m.content);
  const language = resolveReplyLanguage(message, priorUserTexts, String(body.language ?? "")) ?? "en";

  // ── Auth (x-api-key only) ────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return fail(401, "missing_api_key", "Missing `x-api-key` header. Angel API v1 is server-to-server only.");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const auth = await validateApiKey(apiKey, admin);
  if (!auth.ok) {
    const err = apiKeyErrorResponse(auth.status);
    const extra: Record<string, unknown> = {};
    if (auth.status === "rate_limited") {
      extra.dailyLimit = auth.dailyLimit;
      extra.currentUsage = auth.currentUsage;
      extra.retryAfter = 3600;
    }
    return fail(err.http, auth.status, err.message, extra);
  }
  admin.rpc("increment_api_key_usage", { _api_key_id: auth.apiKeyId, _tokens_used: 0 })
    .then(() => {}).catch((e: unknown) => console.warn("increment_api_key_usage failed"));

  let scope = "strict";
  try {
    const { data: keyRow } = await admin.from("user_api_keys").select("scope").eq("id", auth.apiKeyId).maybeSingle();
    scope = (keyRow?.scope as string) || "strict";
  } catch { /* default strict */ }

  // ── Retrieval ────────────────────────────────────────────────────────
  const tRetrieval = Date.now();
  const urantia = isUrantiaQuestion(message, contextType);
  const paperNumber = urantia ? extractPaperNumber(message) : null;
  const quotes = extractQuotedPhrases(message);
  const wantsCitation = urantia && isCitationRequest(message);

  const strategies: string[] = [];
  let knowledgeContext = "";
  let retrievedChunks: Chunk[] = [];
  let paperDoc: { title: string; paper_number: number } | null = null;
  let ragMode = "skipped";

  // 1) Explicit paper number → authoritative document lookup.
  if (paperNumber !== null) {
    try {
      const { data, error } = await admin.rpc("get_urantia_paper", { p_number: paperNumber });
      if (!error && Array.isArray(data) && data[0]?.extracted_content) {
        paperDoc = { title: data[0].title, paper_number: paperNumber };
        knowledgeContext +=
          `--- TÀI LIỆU GỐC: ${data[0].title} (Bài ${paperNumber}) ---\n` +
          String(data[0].extracted_content).slice(0, 24000) + "\n\n";
        strategies.push("exact_paper");
      }
    } catch {
      strategies.push("exact_paper_failed");
    }
  }

  // 2) Exact phrase / keyword search inside the Urantia folder only.
  if (urantia) {
    const terms = quotes.length > 0
      ? quotes.flatMap(phraseVariants)
      : [escapeLike(message).split(" ").slice(0, 8).join(" ")];
    for (const term of terms) {
      if (retrievedChunks.length >= MAX_CHUNKS) break;
      const t = escapeLike(term);
      if (t.length < 6) continue;
      const { data, error } = await admin
        .from("knowledge_chunks")
        .select("document_id, doc_title, chunk_text")
        .eq("folder_name", URANTIA_FOLDER)
        .ilike("chunk_text", `%${t}%`)
        .limit(MAX_CHUNKS);
      if (error) continue;
      for (const row of (data ?? []) as Chunk[]) {
        if (retrievedChunks.some((c) => c.chunk_text === row.chunk_text)) continue;
        retrievedChunks.push(row);
        if (retrievedChunks.length >= MAX_CHUNKS) break;
      }
      if (retrievedChunks.length > 0) break; // longest variant matched first
    }
    if (retrievedChunks.length > 0) strategies.push("folder_phrase");
  }

  // 3) Vector / hybrid fallback (unchanged pipeline).
  if (retrievedChunks.length === 0 && !paperDoc && message.length >= 8) {
    try {
      const res = await searchKnowledgeInline(message, { top_k: MAX_CHUNKS, min_similarity: 0.3 });
      ragMode = res.mode;
      retrievedChunks = (res.chunks ?? []).slice(0, MAX_CHUNKS).map((c) => ({
        document_id: c.document_id,
        doc_title: c.doc_title,
        chunk_text: c.chunk_text,
      }));
      if (retrievedChunks.length > 0) strategies.push(`vector_${res.mode}`);
    } catch {
      strategies.push("vector_failed");
    }
  }

  if (retrievedChunks.length > 0) {
    retrievedChunks = await attachPaperNumbers(admin, retrievedChunks);
    knowledgeContext +=
      `--- ĐOẠN TRÍCH TỪ KHO TÀI LIỆU CỦA ANGEL ---\n\n` +
      retrievedChunks
        .map((c) => `[${c.paper_number !== null && c.paper_number !== undefined ? `Bài ${c.paper_number} — ` : ""}${c.doc_title}]\n${(c.chunk_text || "").slice(0, 1500)}`)
        .join("\n\n---\n\n");
  }

  const retrievalMs = Date.now() - tRetrieval;
  const hasTrustedSource = Boolean(paperDoc) || retrievedChunks.length > 0 || passages.length > 0;

  // Safe logging only: strategy, counts, doc titles, timing, status.
  console.log(
    `[angel-v1-canary] ${requestId} urantia=${urantia} paper=${paperNumber ?? "-"} quotes=${quotes.length} ` +
    `strategy=${strategies.join("+") || "none"} candidates=${retrievedChunks.length} ` +
    `titles=${retrievedChunks.map((c) => c.doc_title).slice(0, 5).join(" | ") || "-"} ` +
    `retrievalMs=${retrievalMs} scope=${scope}`,
  );

  // ── Strict scope guard: no trusted source → refuse, never guess ──────
  if (scope === "strict" && !hasTrustedSource) {
    const answer = language === "en"
      ? "I could not find this passage in the documents I have access to, so I will not guess a paper number. Please give me a longer excerpt or the paper you are reading, and I will look again."
      : "Mình chưa tìm thấy đoạn này trong kho tài liệu đang có, nên mình sẽ không đoán số Bài. Bạn gửi thêm một đoạn dài hơn hoặc cho mình biết bạn đang đọc Bài nào, mình sẽ tra lại nhé.";
    return json({
      answer,
      sources: [],
      relatedPapers: [],
      suggestions: [],
      meta: {
        requestId, apiVersion: API_VERSION, contextType, language,
        provider: "none", canary: true, scope,
        retrievalStrategy: strategies.join("+") || "none",
        angelKnowledgeUsed: false, angelKnowledgeChunks: 0, ragMode,
        notFoundInCorpus: true, retrievalMs, latencyMs: Date.now() - t0,
      },
    });
  }

  // ── Prompt ───────────────────────────────────────────────────────────
  let styleInstruction =
    `Reply language follows the LANGUAGE CHECK attached to the latest user message. Be clear and useful. ` +
    `Default to a focused answer; expand fully when the user asks for depth, ideas, plans, or writing help.`;
  if (wantsCitation) {
    styleInstruction +=
      ` The reader asks for an exact citation. Use ONLY the retrieved documents above. ` +
      `State the paper number and paragraph reference exactly as it appears in the retrieved text. ` +
      `If the retrieved text does not contain the quote, say clearly that it was not found and do NOT guess a paper number.`;
  }
  if (scope === "strict") {
    styleInstruction +=
      ` STRICT MODE: answer only from the retrieved documents. Never fall back to general knowledge, never invent paper or paragraph numbers.`;
  }

  const built = buildSystemPrompt({ userMessage: message, knowledgeContext, styleInstruction });
  const appBlock = buildAppContextBlock(ctx, passages, language);
  const systemPrompt = appBlock ? `${built.prompt}\n\n${appBlock}` : built.prompt;

  const aiMessages = withLanguageCheck([
    { role: "system" as const, content: systemPrompt },
    ...conversation,
    { role: "user" as const, content: message },
  ], message, priorUserTexts, String(body.language ?? ""));

  const ai = await aiChat({ messages: aiMessages, maxTokens: 4000 });
  if (!ai.ok) {
    const status = ai.status === 429 ? 429 : ai.status === 402 ? 402 : 503;
    return fail(status, ai.code, ai.message, { requestId });
  }

  const { answer, suggestions } = extractSuggestions(ai.text || "");
  const { sources, relatedPapers, unverifiedCitations, unverifiedPapers } = buildSources(answer, passages, ctx);

  // Retrieved Urantia papers are trustworthy sources too — surface them.
  const corpusPapers = [...new Set(
    retrievedChunks.map((c) => c.paper_number).filter((n): n is number => typeof n === "number"),
  )];
  if (paperDoc) corpusPapers.unshift(paperDoc.paper_number);

  const latencyMs = Date.now() - t0;
  console.log(
    `[angel-v1-canary] ${requestId} done provider=${ai.provider} sources=${sources.length} ` +
    `corpusPapers=${corpusPapers.join(",") || "-"} ${latencyMs}ms`,
  );

  return json({
    answer,
    sources,
    relatedPapers,
    suggestions,
    meta: {
      requestId,
      apiVersion: API_VERSION,
      contextType,
      language,
      provider: ai.provider,
      canary: true,
      scope,
      retrievalStrategy: strategies.join("+") || "none",
      retrievalMs,
      corpusPapers,
      angelKnowledgeUsed: retrievedChunks.length > 0 || Boolean(paperDoc),
      angelKnowledgeChunks: retrievedChunks.length,
      ragMode,
      modules: built.loadedModules,
      passagesProvided: passages.length,
      passagesCited: sources.length,
      unverifiedCitations,
      unverifiedPapers,
      conversationTurns: conversation.length,
      latencyMs,
    },
  });
});
