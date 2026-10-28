// Google AI Studio direct tier (OpenAI-compatible endpoint).
// Used as fallback #2 after Cloudflare BYOK, BEFORE Lovable Gateway.
// Consumes the project's own GOOGLE_AI_API_KEY quota — no Lovable credit.

export const GOOGLE_DIRECT_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/** Strip gateway prefixes: "google-ai-studio/gemini-2.5-flash" | "google/gemini-2.5-flash" -> "gemini-2.5-flash" */
export function toGoogleDirectModel(model: string): string {
  return String(model).replace(/^google(-ai-studio)?\//, "");
}

/**
 * Lovable Gateway is OFF by default — it is the only tier that burns Lovable credit.
 * Source of truth: system_settings.ai_routing.lock_google_only (admin toggle).
 * Env ALLOW_LOVABLE_FALLBACK=true only matters when the admin lock is OFF.
 * Cached 30s to avoid a DB hit per request.
 */
let _lockCache: { value: boolean; at: number } | null = null;

async function isGoogleOnlyLocked(): Promise<boolean> {
  if (_lockCache && Date.now() - _lockCache.at < 30_000) return _lockCache.value;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  let locked = true; // fail-safe: never burn credit if config unreadable
  try {
    if (url && key) {
      const res = await fetch(
        `${url}/rest/v1/system_settings?key=eq.ai_routing&select=value`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (res.ok) {
        const rows = await res.json();
        const v = rows?.[0]?.value?.lock_google_only;
        if (typeof v === "boolean") locked = v;
      }
    }
  } catch (e) {
    console.warn("[ai-routing] lock read failed:", (e as Error)?.message ?? e);
  }
  _lockCache = { value: locked, at: Date.now() };
  return locked;
}

export async function allowLovableFallback(): Promise<boolean> {
  if (await isGoogleOnlyLocked()) return false;
  return (Deno.env.get("ALLOW_LOVABLE_FALLBACK") ?? "false").toLowerCase() === "true";
}


/**
 * Call Google AI Studio directly with an OpenAI-shaped body.
 * Returns the raw Response (OpenAI-compatible, streaming supported) or null on failure.
 */
export async function googleDirectFetch(
  payload: Record<string, unknown>,
  opts: { model: string; timeoutMs?: number } = { model: "gemini-2.5-flash" },
): Promise<Response | null> {
  const key = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(GOOGLE_DIRECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...payload, model: toGoogleDirectModel(opts.model) }),
      ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.warn(`[google-direct] ${res.status}: ${t.slice(0, 200)}`);
      return null;
    }
    return res;
  } catch (e) {
    console.warn("[google-direct] threw:", (e as Error)?.message ?? e);
    return null;
  }
}
