import { withLanguageCheck, resolveReplyLanguage } from "../_shared/language-policy.ts";
// Angel API v1 — versioned public gateway for FUN ecosystem apps.
// Production URL: POST https://angel.fun.rich/api/v1/angel/chat  (proxied here)
// Backend:        POST /functions/v1/angel-v1-chat
//
// Contract:  { message, language?, context?, conversation? }
//         →  { answer, sources[], relatedPapers[], suggestions[], meta{} }
//
// Angel keeps FULL intelligence here: same core prompt, same modules, same internal
// RAG, same AI gateway as angel.fun.rich/chat. App context is ADDITIONAL only.
// The legacy /functions/v1/angel-chat endpoint is untouched.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const t0 = Date.now();
  const requestId = crypto.randomUUID();

  // ── 1. Parse + validate ──────────────────────────────────────────────
  let body: {
    message?: unknown;
    language?: unknown;
    context?: AppContext | null;
    conversation?: Turn[] | null;
  };
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

  // ── 2. Authenticate (x-api-key only — this is a server-to-server API) ─
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return fail(401, "missing_api_key", "Missing `x-api-key` header. Angel API v1 is server-to-server only.");
  }

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
  // Quota is configuration-driven (user_api_keys.daily_limit) — never hard-coded here.
  admin.rpc("increment_api_key_usage", { _api_key_id: auth.apiKeyId, _tokens_used: 0 })
    .then(() => {}).catch((e: unknown) => console.warn("increment_api_key_usage:", e));

  // ── 3. Angel internal knowledge (RAG) — same pipeline as angel.fun.rich ─
  let knowledgeContext = "";
  let ragChunks = 0;
  let ragMode = "skipped";
  try {
    if (message.length >= 8) {
      const res = await searchKnowledgeInline(message, { top_k: 6, min_similarity: 0.3 });
      ragMode = res.mode;
      const chunks = (res.chunks ?? []).slice(0, 5);
      ragChunks = chunks.length;
      if (chunks.length > 0) {
        knowledgeContext =
          `--- KIẾN THỨC HỌC ĐƯỢC TỪ KHO TÀI LIỆU CỦA ANGEL ---\n\n` +
          chunks.map((c) => `[${c.doc_title}]\n${(c.chunk_text || "").slice(0, 1500)}`).join("\n\n---\n\n");
      }
    }
  } catch (e) {
    console.warn("[angel-v1] RAG error:", e);
  }

  // ── 4. Prompt = ANGEL CORE (+modules+RAG) → APPLICATION CONTEXT ───────
  const built = buildSystemPrompt({
    userMessage: message,
    knowledgeContext,
    styleInstruction:
      `Reply language follows the LANGUAGE CHECK attached to the latest user message. Be clear and useful. ` +
      `Default to a focused answer; expand fully when the user asks for depth, ideas, plans, or writing help.`,
  });

  const appBlock = buildAppContextBlock(ctx, passages, language);
  const systemPrompt = appBlock ? `${built.prompt}\n\n${appBlock}` : built.prompt;

  const aiMessages = withLanguageCheck([
    { role: "system" as const, content: systemPrompt },
    ...conversation,
    { role: "user" as const, content: message },
  ], message, priorUserTexts, String(body.language ?? ""));

  // ── 5. Angel AI gateway (Cloudflare → Google direct → Lovable) ────────
  const ai = await aiChat({ messages: aiMessages, maxTokens: 4000 });
  if (!ai.ok) {
    const status = ai.status === 429 ? 429 : ai.status === 402 ? 402 : 503;
    return fail(status, ai.code, ai.message, { requestId });
  }

  // ── 6. Source integrity — backend builds sources from client passages ─
  const { answer, suggestions } = extractSuggestions(ai.text || "");
  const { sources, relatedPapers, unverifiedCitations, unverifiedPapers } = buildSources(answer, passages, ctx);

  const latencyMs = Date.now() - t0;
  console.log(
    `[angel-v1] ${requestId} type=${contextType} lang=${language} passages=${passages.length} ` +
    `rag=${ragChunks}/${ragMode} provider=${ai.provider} sources=${sources.length} unverified=${unverifiedPapers.join(",") || "-"} ${latencyMs}ms`,
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
      angelKnowledgeUsed: ragChunks > 0,
      angelKnowledgeChunks: ragChunks,
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
