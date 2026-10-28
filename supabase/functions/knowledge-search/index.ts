// knowledge-search — Hybrid RRF (vector + trigram keyword)
// Input: { query, top_k?=8, min_similarity?=0.30 }
// Output: { chunks: [...] }
// Auth: JWT, service-role, hoặc x-api-key (chia sẻ quota với daily_limit của key).
import { corsHeaders as baseCors } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  logAiProviderUsage,
  rateLimitCostlyAction,
  requireUserOrServiceRole,
  withCloudUsage,
} from "../_shared/cost-guards.ts";
import { validateApiKey, apiKeyErrorResponse } from "../_shared/api-key-auth.ts";
import { embedTexts, EMBED_DIMS } from "../_shared/embeddings.ts";

const corsHeaders = {
  ...baseCors,
  "Access-Control-Allow-Headers":
    (baseCors["Access-Control-Allow-Headers"] || "authorization, x-client-info, apikey, content-type") + ", x-api-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function logRagHealth(admin: any, status: "ok" | "degraded" | "down", detail: Record<string, unknown>) {
  try {
    await admin.from("rag_health_events").insert({ status, detail });
  } catch (_) { /* table may not exist yet; ignore */ }
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(withCloudUsage("knowledge-search", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { query?: string; top_k?: number; min_similarity?: number };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  // Auth: ưu tiên x-api-key (cho app bên thứ 3), fallback JWT/service-role.
  const apiKeyHeader = req.headers.get("x-api-key");
  let userId: string | null = null;
  let isServiceRole = false;
  let apiKeyId: string | null = null;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (apiKeyHeader) {
    const v = await validateApiKey(apiKeyHeader, admin);
    if (!v.ok) {
      const err = apiKeyErrorResponse(v.status);
      return json({ error: err.message, code: v.status, current_usage: v.currentUsage, daily_limit: v.dailyLimit }, err.http);
    }
    userId = v.userId;
    apiKeyId = v.apiKeyId;
    admin.rpc("increment_api_key_usage", { _api_key_id: apiKeyId, _tokens_used: 0 })
      .then(() => {}).catch((e: unknown) => console.warn("increment_api_key_usage:", e));
  } else {
    const auth = await requireUserOrServiceRole(req);
    if (auth instanceof Response) return auth;
    userId = auth.userId;
    isServiceRole = auth.isServiceRole;
    if (!isServiceRole && userId) {
      const limited = await rateLimitCostlyAction({
        userId,
        action: "knowledge_search",
        limit: 100,
        increment: true,
      });
      if (limited instanceof Response) return limited;
    }
  }


  const query = (body.query ?? "").toString().trim();
  if (query.length < 3) return json({ chunks: [] });

  const topK = Math.min(Math.max(body.top_k ?? 8, 1), 20);
  const minSim = Math.min(Math.max(body.min_similarity ?? 0.30, 0), 1);

  const supabase = admin;
  try {
    // Dual-provider query embedding: Google native → Lovable OpenAI fallback.
    const emb = await embedTexts([query.slice(0, 8000)], { taskType: "RETRIEVAL_QUERY" });

    await logAiProviderUsage({
      functionName: "knowledge-search",
      provider: emb.provider,
      model: emb.model || "n/a",
      status: emb.status,
      userId: userId ?? undefined,
      estimatedInputTokens: Math.ceil(query.length / 4),
      metadata: {
        topK, minSim, service_role: isServiceRole,
        via: apiKeyId ? "api_key" : (isServiceRole ? "service" : "jwt"),
        api_key_id: apiKeyId,
        errors: emb.errors ?? null,
      },
    }).catch(() => {});

    if (emb.vectors.length !== 1) {
      // Both providers failed → keyword-only fallback via zero vector.
      // The vec branch of match_knowledge_hybrid will drop out (similarity 0),
      // but the kw (trigram) branch still returns matches.
      console.error("[knowledge-search] all embed providers failed", emb.errors);
      await logRagHealth(admin, "degraded", { reason: "embed_all_failed", errors: emb.errors });
      const zero = `[${new Array(EMBED_DIMS).fill(0).join(",")}]`;
      const { data: kwData, error: kwErr } = await supabase.rpc("match_knowledge_hybrid", {
        query_embedding: zero,
        query_text: query,
        match_count: topK,
        min_similarity: 0,
      });
      if (kwErr) {
        await logRagHealth(admin, "down", { reason: "kw_rpc_failed", err: kwErr.message });
        return json({ chunks: [], error: "embed_failed", error_code: "embed_all_failed", mode: "none", provider: "none", errors: emb.errors }, 200);
      }
      return json({ chunks: kwData ?? [], mode: "keyword_only", provider: "none", degraded: true, errors: emb.errors });
    }

    const queryEmbedding = `[${emb.vectors[0].join(",")}]`;
    const { data, error } = await supabase.rpc("match_knowledge_hybrid", {
      query_embedding: queryEmbedding,
      query_text: query,
      match_count: topK,
      min_similarity: minSim,
    });
    if (error) {
      console.error("[knowledge-search] rpc err", error);
      const { data: fallback } = await supabase.rpc("match_knowledge_chunks", {
        query_embedding: queryEmbedding,
        match_count: topK,
        min_similarity: minSim,
      });
      return json({ chunks: fallback ?? [], fallback: true, mode: "vector_only", provider: emb.provider });
    }
    return json({ chunks: data ?? [], mode: "hybrid", provider: emb.provider });
  } catch (e) {
    console.error("[knowledge-search] exception", e);
    await logRagHealth(admin, "down", { reason: "exception", err: String(e).slice(0, 200) });
    return json({ chunks: [], error: String(e), error_code: "exception" }, 200);
  }
}));
