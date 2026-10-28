// youtube-transcript — Fetch transcript của YouTube video qua Gemini native video support
// Input: { urls: string[] }  (tối đa 3 URL)
// Output: { items: [{ url, video_id, title, transcript, cached, error }] }
// Cache 30 ngày trong web_scrape_cache.
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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const GEMINI_NATIVE_MODEL = "gemini-2.5-flash";
const CACHE_TTL_DAYS = 30;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split(/[/?&]/)[0] || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch { return null; }
}

async function callGeminiNative(url: string, mediaResolution: "MEDIA_RESOLUTION_LOW" | "MEDIA_RESOLUTION_MEDIUM", fps?: number) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_NATIVE_MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`;
  const videoPart: any = { fileData: { fileUri: url, mimeType: "video/*" } };
  if (fps) videoPart.videoMetadata = { fps };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          videoPart,
          { text:
            "Trích transcript đầy đủ của video này (giữ nguyên trình tự nói, tiếng gốc, bao gồm cả audio nếu có). " +
            "Trả về JSON thuần (không markdown): {\"title\":\"...\",\"transcript\":\"...\"}. " +
            "Nếu video không có audio/không truy cập được, trả {\"error\":\"lý do\"}." },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        mediaResolution,
      },
    }),
  });
  return res;
}

async function fetchTranscriptFromGeminiNative(
  url: string,
  auth: { userId: string | null; isServiceRole: boolean },
): Promise<{ title?: string; transcript: string }> {
  // Gemini native API hỗ trợ YouTube URL trực tiếp qua fileData part.
  // https://ai.google.dev/gemini-api/docs/video-understanding#youtube
  // Chiến lược: thử LOW resolution + fps mặc định trước. Nếu vượt token limit
  // (video quá dài), retry với fps=0.2 để giảm frame và fit vào 1M token.
  if (!GOOGLE_AI_API_KEY) throw new Error("no_google_ai_key");

  const attempts: Array<{ res: "MEDIA_RESOLUTION_LOW" | "MEDIA_RESOLUTION_MEDIUM"; fps?: number }> = [
    { res: "MEDIA_RESOLUTION_LOW" },
    { res: "MEDIA_RESOLUTION_LOW", fps: 0.2 },
    { res: "MEDIA_RESOLUTION_LOW", fps: 0.1 },
  ];

  let lastErr = "";
  for (const a of attempts) {
    const res = await callGeminiNative(url, a.res, a.fps);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      lastErr = `gemini_native_${res.status}: ${t.slice(0, 200)}`;
      // Chỉ retry cho lỗi token limit (400 INVALID_ARGUMENT với message chứa "token count")
      if (res.status === 400 && /token count|maximum number of tokens/i.test(t)) {
        console.warn(`[yt] token limit at fps=${a.fps ?? "default"}, retrying...`);
        continue;
      }
      throw new Error(lastErr);
    }
    await logAiProviderUsage({
      functionName: "youtube-transcript",
      provider: "google_direct",
      model: GEMINI_NATIVE_MODEL,
      status: res.status,
      userId: auth.userId,
      metadata: { service_role: auth.isServiceRole, fps: a.fps ?? null },
    });
    const j = await res.json();
    const content: string = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") ?? "";
    const cleaned = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.error) throw new Error(parsed.error);
      const transcript = String(parsed.transcript || "").trim();
      if (!transcript) throw new Error("empty_transcript_native");
      return { title: parsed.title, transcript };
    } catch (e) {
      if (content.length > 40) return { transcript: content };
      throw e;
    }
  }
  throw new Error(lastErr || "gemini_native_all_attempts_failed");
}


async function fetchTranscriptFromLovableGateway(
  url: string,
  auth: { userId: string | null; isServiceRole: boolean },
): Promise<{ title?: string; transcript: string }> {
  if (!LOVABLE_API_KEY) throw new Error("no_lovable_key");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content:
          "Bạn là công cụ trích xuất transcript. Trả JSON thuần: {\"title\":\"...\",\"transcript\":\"...\"} hoặc {\"error\":\"...\"}." },
        { role: "user", content: [
          { type: "image_url", image_url: { url } },
          { type: "text", text: `Trích transcript đầy đủ của video YouTube: ${url}` },
        ] },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`gateway_${res.status}: ${t.slice(0, 200)}`);
  }
  await logAiProviderUsage({
    functionName: "youtube-transcript",
    provider: "lovable",
    model: MODEL,
    status: res.status,
    userId: auth.userId,
    metadata: { service_role: auth.isServiceRole },
  });
  const j = await res.json();
  const content: string = j?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.error) throw new Error(parsed.error);
    const transcript = String(parsed.transcript || "").trim();
    if (!transcript) throw new Error("empty_transcript_gateway");
    return { title: parsed.title, transcript };
  } catch {
    if (content.length > 40) return { transcript: content };
    throw new Error("parse_failed");
  }
}

async function fetchTranscript(
  url: string,
  auth: { userId: string | null; isServiceRole: boolean },
): Promise<{ title?: string; transcript: string }> {
  // Ưu tiên Gemini native (hỗ trợ YouTube URL chính thức), fallback Lovable gateway.
  const errors: string[] = [];
  try {
    return await fetchTranscriptFromGeminiNative(url, auth);
  } catch (e) {
    errors.push(`native: ${(e as Error).message}`);
    console.warn("[yt] native failed:", (e as Error).message);
  }
  try {
    return await fetchTranscriptFromLovableGateway(url, auth);
  } catch (e) {
    errors.push(`gateway: ${(e as Error).message}`);
    console.warn("[yt] gateway failed:", (e as Error).message);
  }
  throw new Error(errors.join(" | ") || "all_providers_failed");
}

Deno.serve(withCloudUsage("youtube-transcript", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { urls?: string[] };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const urls = (body.urls || []).filter(u => typeof u === "string").slice(0, 3);
  if (urls.length === 0) return json({ items: [] });

  const auth = await requireUserOrServiceRole(req);
  if (auth instanceof Response) return auth;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400_000).toISOString();
  const items: Array<{ url: string; video_id: string | null; title?: string; transcript?: string; cached?: boolean; error?: string }> = [];

  for (const url of urls) {
    const videoId = extractVideoId(url);
    if (!videoId) { items.push({ url, video_id: null, error: "invalid_youtube_url" }); continue; }
    const cacheKey = `yt:${videoId}`;

    // Check cache
    try {
      const { data: cached } = await supabase
        .from("web_scrape_cache")
        .select("content, metadata, created_at")
        .eq("url", cacheKey)
        .gte("created_at", cutoff)
        .maybeSingle();
      if (cached?.content) {
        items.push({
          url,
          video_id: videoId,
          title: (cached.metadata as any)?.title,
          transcript: cached.content,
          cached: true,
        });
        continue;
      }
    } catch (e) {
      console.warn("[yt] cache read err", e);
    }

    if (!auth.isServiceRole && auth.userId) {
      const limited = await rateLimitCostlyAction({
        userId: auth.userId,
        action: "youtube_transcript",
        limit: 10,
        increment: true,
      });
      if (limited instanceof Response) return limited;
    }

    // Fetch fresh
    try {
      const { title, transcript } = await fetchTranscript(url, auth);
      if (!transcript || transcript.length < 40) {
        items.push({ url, video_id: videoId, error: "empty_transcript" });
        continue;
      }
      items.push({ url, video_id: videoId, title, transcript, cached: false });
      // Save cache (best-effort)
      try {
        await supabase.from("web_scrape_cache").upsert({
          url: cacheKey,
          content: transcript,
          metadata: { title: title || null, source: "youtube", video_id: videoId },
        }, { onConflict: "url" });
      } catch (e) {
        console.warn("[yt] cache write err", e);
      }
    } catch (e) {
      console.error("[yt] fetch err", url, e);
      items.push({ url, video_id: videoId, error: String((e as Error).message || e) });
    }
  }

  return json({ items });
}));
