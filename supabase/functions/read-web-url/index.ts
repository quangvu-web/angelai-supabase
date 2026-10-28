// read-web-url — Angel AI scrape & cache web pages via Firecrawl v2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const CACHE_TTL_HOURS = 24;
const MAX_MARKDOWN = 8000;

interface Body { url: string }

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (h === "0.0.0.0" || h === "::1") return true;
  return false;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fallbackFetch(url: string): Promise<{ title: string; description: string; markdown: string } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 AngelAI-WebReader" }, redirect: "follow" });
    if (!res.ok) { await res.text(); return null; }
    const html = await res.text();
    const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<(?:br|p|div|tr|li|h[1-6])[^>]*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();
    return {
      title: (titleM?.[1] ?? "").trim().slice(0, 200),
      description: (descM?.[1] ?? "").trim().slice(0, 400),
      markdown: text.slice(0, MAX_MARKDOWN),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const rawUrl = (body?.url ?? "").trim();
  if (!rawUrl) return json({ error: "url required" }, 400);

  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return json({ error: "invalid_url" }, 400); }
  if (!/^https?:$/.test(parsed.protocol)) return json({ error: "only http/https allowed" }, 400);
  if (isPrivateHost(parsed.hostname)) return json({ error: "private host blocked" }, 400);

  const normalized = parsed.toString();
  const urlHash = await sha256(normalized);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Cache lookup
  try {
    const { data: cached } = await admin
      .from("web_scrape_cache")
      .select("*")
      .eq("url_hash", urlHash)
      .maybeSingle();
    if (cached) {
      const ageH = (Date.now() - new Date(cached.fetched_at).getTime()) / 3_600_000;
      if (ageH < CACHE_TTL_HOURS) {
        return json({
          fromCache: true,
          sourceURL: cached.url,
          title: cached.title ?? "",
          description: cached.description ?? "",
          summary: cached.summary ?? "",
          markdown: cached.markdown ?? "",
          fetchedAt: cached.fetched_at,
        });
      }
    }
  } catch (e) {
    console.warn("[read-web-url] cache lookup failed", e);
  }

  // Try Firecrawl first
  let result: { title: string; description: string; summary: string; markdown: string } | null = null;
  let fetchError: string | null = null;

  if (FIRECRAWL_API_KEY) {
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: normalized,
          formats: ["markdown", "summary"],
          onlyMainContent: true,
          waitFor: 1500,
        }),
      });
      if (fcRes.ok) {
        const data = await fcRes.json();
        const doc = data?.data ?? data;
        const md: string = (doc?.markdown ?? "").toString();
        result = {
          title: (doc?.metadata?.title ?? "").toString().slice(0, 200),
          description: (doc?.metadata?.description ?? "").toString().slice(0, 400),
          summary: (doc?.summary ?? "").toString().slice(0, 600),
          markdown: md.slice(0, MAX_MARKDOWN),
        };
      } else {
        const errText = await fcRes.text();
        fetchError = `firecrawl_${fcRes.status}`;
        console.warn("[read-web-url] firecrawl failed", fcRes.status, errText.slice(0, 200));
      }
    } catch (e) {
      fetchError = `firecrawl_exception`;
      console.warn("[read-web-url] firecrawl exception", e);
    }
  }

  // Fallback: plain HTML strip
  if (!result || !result.markdown) {
    const fb = await fallbackFetch(normalized);
    if (fb && fb.markdown) {
      result = { title: fb.title, description: fb.description, summary: "", markdown: fb.markdown };
    }
  }

  if (!result || !result.markdown) {
    return json({ error: fetchError ?? "unable_to_fetch", sourceURL: normalized }, 502);
  }

  // Upsert cache (fire and forget — but await for consistency)
  try {
    await admin.from("web_scrape_cache").upsert({
      url_hash: urlHash,
      url: normalized,
      title: result.title,
      description: result.description,
      summary: result.summary,
      markdown: result.markdown,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[read-web-url] cache upsert failed", e);
  }

  return json({
    fromCache: false,
    sourceURL: normalized,
    title: result.title,
    description: result.description,
    summary: result.summary,
    markdown: result.markdown,
    fetchedAt: new Date().toISOString(),
  });
});
