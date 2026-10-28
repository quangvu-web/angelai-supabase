// youtube-search-camly — Tìm video trên kênh Happy Camly Coin VN không cần YouTube Data API
// Chiến lược: (1) scrape trang kênh /videos qua Firecrawl, cache 6h;
// (2) fallback Firecrawl search với site:youtube.com/@HappyCamlyCoinVN
// Input: { query: string, limit?: number = 5 }
// Output: { items: [{ video_id, url, title, score, published_hint? }], source }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const CHANNEL_URL = "https://www.youtube.com/@HappyCamlyCoinVN/videos";
const CHANNEL_HANDLE = "@HappyCamlyCoinVN";
const CACHE_KEY = "yt-channel:HappyCamlyCoinVN:videos";
const CACHE_TTL_HOURS = 6;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase();
}

/** Tokenize query, bỏ stopwords, trả về set từ đã unaccent. */
function tokenize(s: string): string[] {
  const norm = stripDiacritics(s).replace(/[^a-z0-9\s]/g, " ");
  const stop = new Set(["cha", "con", "toi", "minh", "ban", "angel", "cho", "va", "cua", "la", "gi", "hay", "xin", "vui", "long", "lam", "on", "tim", "giup", "the", "an", "the", "co", "de", "voi", "trong", "khong", "co"]);
  return norm.split(/\s+/).filter(w => w.length >= 2 && !stop.has(w));
}

/** Fuzzy score: tỉ lệ token query có trong title (unaccent). */
function scoreTitle(title: string, qTokens: string[]): number {
  if (qTokens.length === 0) return 0;
  const tNorm = stripDiacritics(title);
  let hit = 0;
  for (const tok of qTokens) if (tNorm.includes(tok)) hit++;
  return hit / qTokens.length;
}

type VideoItem = { video_id: string; url: string; title: string; score?: number; published_hint?: string };

/** Scrape trang kênh /videos qua Firecrawl, trả về danh sách video. */
async function scrapeChannelList(): Promise<VideoItem[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: CHANNEL_URL,
        formats: ["html", "links"],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });
    if (!res.ok) {
      console.warn("[yt-camly] firecrawl scrape", res.status);
      return [];
    }
    const j = await res.json();
    const html: string = j?.data?.html || j?.html || "";
    const links: string[] = j?.data?.links || j?.links || [];

    const seen = new Map<string, VideoItem>();

    // 1) Regex trực tiếp trên HTML: {"videoId":"XXXX","title":{"runs":[{"text":"..."}]}}
    const re = /"videoId":"([A-Za-z0-9_-]{11})"[^}]*?"title":\{"runs":\[\{"text":"([^"]{3,200})"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const vid = m[1];
      const title = m[2].replace(/\\u0026/g, "&").replace(/\\"/g, '"');
      if (!seen.has(vid)) {
        seen.set(vid, { video_id: vid, url: `https://www.youtube.com/watch?v=${vid}`, title });
      }
    }

    // 2) Fallback: từ links[] chỉ lấy watch URLs, title = "YouTube video"
    if (seen.size === 0 && links.length) {
      for (const link of links) {
        const mv = link.match(/[?&]v=([A-Za-z0-9_-]{11})/);
        if (mv && !seen.has(mv[1])) {
          seen.set(mv[1], { video_id: mv[1], url: link, title: "YouTube video" });
        }
      }
    }

    return Array.from(seen.values());
  } catch (e) {
    console.warn("[yt-camly] scrape err", e);
    return [];
  }
}

/** Fallback: Firecrawl search với site: filter. */
async function firecrawlSearchChannel(query: string, limit: number): Promise<VideoItem[]> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `site:youtube.com/${CHANNEL_HANDLE} ${query}`,
        limit,
      }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const raw: any[] = j?.data?.web ?? j?.data ?? [];
    const out: VideoItem[] = [];
    for (const r of raw) {
      const url = r?.url || "";
      const mv = url.match(/[?&]v=([A-Za-z0-9_-]{11})|youtu\.be\/([A-Za-z0-9_-]{11})/);
      const vid = mv?.[1] || mv?.[2];
      if (!vid) continue;
      out.push({
        video_id: vid,
        url: `https://www.youtube.com/watch?v=${vid}`,
        title: String(r.title || "YouTube video").slice(0, 200),
      });
    }
    return out;
  } catch (e) {
    console.warn("[yt-camly] search err", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!FIRECRAWL_API_KEY) return json({ items: [], error: "no_firecrawl_key" });

  let body: { query?: string; limit?: number };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const query = (body.query || "").trim();
  if (query.length < 3) return json({ items: [] });
  const limit = Math.min(Math.max(body.limit ?? 5, 1), 10);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600_000).toISOString();

  // Compute sha256 hash for cache key
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(CACHE_KEY));
  const urlHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

  // Cache lookup — dùng cột markdown để lưu JSON list
  let list: VideoItem[] = [];
  try {
    const { data: cached } = await supabase
      .from("web_scrape_cache")
      .select("markdown, fetched_at")
      .eq("url_hash", urlHash)
      .maybeSingle();
    if (cached?.markdown && cached.fetched_at && cached.fetched_at >= cutoff) {
      list = JSON.parse(cached.markdown);
    }
  } catch (e) { console.warn("[yt-camly] cache read", e); }

  let source = "cache";
  if (list.length === 0) {
    source = "scrape";
    list = await scrapeChannelList();
    if (list.length > 0) {
      try {
        await supabase.from("web_scrape_cache").upsert({
          url_hash: urlHash,
          url: CACHE_KEY,
          title: "yt-channel:HappyCamlyCoinVN",
          markdown: JSON.stringify(list),
          fetched_at: new Date().toISOString(),
        }, { onConflict: "url_hash" });
      } catch (e) { console.warn("[yt-camly] cache write", e); }
    }
  }

  // Fuzzy rank
  const qTokens = tokenize(query);
  let scored: VideoItem[] = [];
  if (list.length > 0 && qTokens.length > 0) {
    scored = list
      .map(v => ({ ...v, score: scoreTitle(v.title, qTokens) }))
      .filter(v => (v.score ?? 0) > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  }

  // Nếu không có match trong list kênh → fallback Firecrawl search
  if (scored.length === 0) {
    source = "firecrawl_search";
    const searchItems = await firecrawlSearchChannel(query, limit);
    scored = searchItems.slice(0, limit);
  }

  // Nếu vẫn không có gì và list kênh có → trả top N mới nhất (không match cũng còn hơn không)
  if (scored.length === 0 && list.length > 0) {
    source = "channel_recent";
    scored = list.slice(0, limit);
  }

  return json({ items: scored, source, channel_size: list.length });
});
