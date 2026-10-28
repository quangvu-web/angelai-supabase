// Inline knowledge-search — skip HTTP edge→edge overhead.
// Embeds query + calls match_knowledge_hybrid RPC directly.
// Same output shape as knowledge-search HTTP endpoint.
import { createClient } from "npm:@supabase/supabase-js@2";
import { embedTexts, EMBED_DIMS } from "./embeddings.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface InlineSearchResult {
  chunks: Array<{
    chunk_id: string;
    document_id: string;
    doc_title: string;
    chunk_text: string;
    similarity: number;
    rrf_score?: number;
    chunk_type?: string;
    is_authoritative?: boolean;
    corpus?: string;
    language?: string;
    edition?: string;
    source_version?: string;
    version_id?: string;
    part_number?: number | null;
    paper_number?: number;
    paper_title?: string;
    section_number?: number;
    section_title?: string;
    paragraph_start?: string;
    paragraph_end?: string;
    paragraph_ids?: string[];
  }>;
  mode: "hybrid" | "vector_only" | "keyword_only" | "none";
  provider: string;
  degraded?: boolean;
}

let _client: ReturnType<typeof createClient> | null = null;
function client() {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  }
  return _client;
}

// Tiny in-memory query embedding cache (10-min TTL).
const embedCache = new Map<string, { vec: number[]; provider: string; ts: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function searchKnowledgeInline(
  query: string,
  opts: { top_k?: number; min_similarity?: number; corpus?: "urantia"; language?: "vi" | "en" } = {},
): Promise<InlineSearchResult> {
  const q = (query ?? "").toString().trim();
  if (q.length < 3) return { chunks: [], mode: "none", provider: "none" };

  const top_k = Math.min(Math.max(opts.top_k ?? 6, 1), 20);
  const min_similarity = Math.min(Math.max(opts.min_similarity ?? 0.30, 0), 1);
  const supabase = client();

  // Embed (with cache)
  const cacheKey = q.slice(0, 400);
  const now = Date.now();
  const hit = embedCache.get(cacheKey);
  let vec: number[] | null = null;
  let provider = "cache";
  if (hit && (now - hit.ts) < CACHE_TTL_MS) {
    vec = hit.vec;
    provider = hit.provider;
  } else {
    try {
      const emb = await embedTexts([q.slice(0, 8000)], { taskType: "RETRIEVAL_QUERY" });
      if (emb.vectors.length === 1) {
        vec = emb.vectors[0];
        provider = emb.provider;
        embedCache.set(cacheKey, { vec, provider, ts: now });
        // Prune when large
        if (embedCache.size > 500) {
          const oldest = [...embedCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
          for (const [k] of oldest) embedCache.delete(k);
        }
      }
    } catch (e) {
      console.warn("[knowledge-inline] embed err:", e);
    }
  }

  // Fallback keyword-only if embed failed
  if (!vec) {
    try {
      const zero = `[${new Array(EMBED_DIMS).fill(0).join(",")}]`;
      const { data } = await supabase.rpc("match_knowledge_hybrid", {
        query_embedding: zero,
        query_text: q,
        match_count: top_k,
        min_similarity: 0,
      });
      return { chunks: (data as any) ?? [], mode: "keyword_only", provider: "none", degraded: true };
    } catch (e) {
      console.error("[knowledge-inline] kw fallback failed:", e);
      return { chunks: [], mode: "none", provider: "none", degraded: true };
    }
  }

  const embStr = `[${vec.join(",")}]`;
  try {
    if (opts.corpus === "urantia") {
      const { data, error } = await supabase.rpc("match_urantia_chunks", {
        query_embedding: embStr,
        query_text: q,
        requested_language: opts.language ?? "vi",
        match_count: top_k,
        min_similarity,
      });
      if (error) {
        console.warn("[knowledge-inline] urantia rpc err:", error.message);
        return { chunks: [], mode: "none", provider, degraded: true };
      }
      return { chunks: (data as any) ?? [], mode: "hybrid", provider };
    }
    const { data, error } = await supabase.rpc("match_knowledge_hybrid", {
      query_embedding: embStr,
      query_text: q,
      match_count: top_k,
      min_similarity,
    });
    if (error) {
      console.warn("[knowledge-inline] hybrid rpc err:", error.message);
      const { data: fb } = await supabase.rpc("match_knowledge_chunks", {
        query_embedding: embStr,
        match_count: top_k,
        min_similarity,
      });
      return { chunks: (fb as any) ?? [], mode: "vector_only", provider };
    }
    return { chunks: (data as any) ?? [], mode: "hybrid", provider };
  } catch (e) {
    console.error("[knowledge-inline] rpc exception:", e);
    return { chunks: [], mode: "none", provider, degraded: true };
  }
}
