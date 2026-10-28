// web-search-knowledge — Firecrawl v2 /search + auto scrape top results, cache 7d
// Input: { query: string, max_results?: number, scrape_top?: number }
// Output: { items: [{ title, url, snippet, markdown?, source_type }] }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  logAiProviderUsage,
  rateLimitCostlyAction,
  requireUserOrServiceRole,
  withCloudUsage,
} from "../_shared/cost-guards.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const CACHE_TTL_DAYS = 7;

// Ưu tiên domain chất lượng, chặn login-wall / short-form kém giá trị
const PREFERRED = /youtube\.com|wikipedia\.org|thuvienhoasen|phatgiao\.org\.vn|langmai|budsas|daophatngaynay|giacngo\.vn/i;
const BLOCKED = /^https?:\/\/(?:m\.)?(?:facebook\.com|tiktok\.com\/@[^/]+$|instagram\.com)/i;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

type Item = { title: string; url: string; snippet: string; markdown?: string; source_type: "web" | "youtube" };

Deno.serve(withCloudUsage("web-search-knowledge", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!FIRECRAWL_API_KEY) return json({ error: "FIRECRAWL_API_KEY missing", items: [] }, 200);

  let body: { query?: string; max_results?: number; scrape_top?: number };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const query = (body.query || "").trim();
  if (query.length < 3) return json({ items: [] });
  const maxResults = Math.min(Math.max(body.max_results ?? 5, 1), 8);
  const scrapeTop = Math.min(Math.max(body.scrape_top ?? 2, 0), 3);

  const auth = await requireUserOrServiceRole(req);
  if (auth instanceof Response) return auth;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const cacheKey = `search:${await sha256(query.toLowerCase() + `|${maxResults}|${scrapeTop}`)}`;
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400_000).toISOString();

  // Cache lookup
  try {
    const { data: cached } = await supabase
      .from("web_scrape_cache")
      .select("content, metadata, created_at, fetched_at")
      .eq("url", cacheKey)
      .maybeSingle();
    const ts = cached?.fetched_at || cached?.created_at;
    if (cached?.content && ts && ts >= cutoff) {
      return json({ items: JSON.parse(cached.content), cached: true });
    }
  } catch (e) {
    console.warn("[web-search] cache read err", e);
  }

  if (!auth.isServiceRole && auth.userId) {
    const limited = await rateLimitCostlyAction({
      userId: auth.userId,
      action: "web_search_knowledge",
      limit: 30,
      increment: true,
    });
    if (limited instanceof Response) return limited;
  }

  // Firecrawl search + scrape top
  let items: Item[] = [];
  try {
    const fcRes = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit: maxResults,
        scrapeOptions: scrapeTop > 0 ? { formats: ["markdown"], onlyMainContent: true } : undefined,
      }),
    });
    if (!fcRes.ok) {
      const t = await fcRes.text().catch(() => "");
      console.warn("[web-search] firecrawl", fcRes.status, t.slice(0, 200));
      return json({ items: [], error: `firecrawl_${fcRes.status}` }, 200);
    }
    await logAiProviderUsage({
      functionName: "web-search-knowledge",
      provider: "firecrawl",
      model: "v2/search",
      status: fcRes.status,
      userId: auth.userId,
      metadata: { maxResults, scrapeTop, service_role: auth.isServiceRole },
    });
    const fcJson = await fcRes.json();
    // v2 shape: { success, data: { web: [...] } } OR { data: [...] } tùy phiên bản
    const raw: any[] = fcJson?.data?.web ?? fcJson?.data ?? [];
    const filtered = raw.filter(r => r?.url && !BLOCKED.test(r.url));

    // Ưu tiên domain chất lượng lên đầu
    filtered.sort((a, b) => {
      const ap = PREFERRED.test(a.url) ? 0 : 1;
      const bp = PREFERRED.test(b.url) ? 0 : 1;
      return ap - bp;
    });

    items = filtered.slice(0, maxResults).map((r, i) => ({
      title: String(r.title || r.metadata?.title || r.url).slice(0, 200),
      url: r.url,
      snippet: String(r.description || r.snippet || r.metadata?.description || "").slice(0, 400),
      markdown: i < scrapeTop && r.markdown ? String(r.markdown).slice(0, 4000) : undefined,
      source_type: /youtube\.com|youtu\.be/.test(r.url) ? "youtube" : "web",
    }));
  } catch (e) {
    console.error("[web-search] err", e);
    return json({ items: [], error: String((e as Error).message || e) }, 200);
  }

  // Save cache
  try {
    await supabase.from("web_scrape_cache").upsert({
      url: cacheKey,
      content: JSON.stringify(items),
      metadata: { query, count: items.length, source: "firecrawl_search" },
      fetched_at: new Date().toISOString(),
    }, { onConflict: "url" });
  } catch (e) {
    console.warn("[web-search] cache write err", e);
  }

  return json({ items, cached: false });
}));
