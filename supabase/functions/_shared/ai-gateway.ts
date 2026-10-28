// Shared AI Gateway helper — Cloudflare BYOK → Google direct → Lovable (flag-gated).
// Only the Lovable tier consumes Lovable credit; it is OFF unless ALLOW_LOVABLE_FALLBACK=true.

import { allowLovableFallback, googleDirectFetch } from "./google-direct.ts";

const CF_GATEWAY_URL =
  "https://gateway.ai.cloudflare.com/v1/6083e34ad429331916b93ba8a5ede81d/angel-ai/compat/chat/completions";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";


export interface AiChatOpts {
  messages: Array<{ role: "system" | "user" | "assistant"; content: unknown }>;
  // Default to gemini-2.5-flash (Angel AI primary). For json_object responses,
  // 2.5-flash works on both CF (google-ai-studio/gemini-2.5-flash) and Lovable
  // (google/gemini-2.5-flash). Override via opts.cfModel / opts.lovableModel.
  cfModel?: string;
  lovableModel?: string;
  jsonObject?: boolean;
  maxTokens?: number;
}

export interface AiChatResult {
  ok: true;
  text: string;
  provider: "cloudflare" | "google_direct" | "lovable";
}


export interface AiChatError {
  ok: false;
  status: number;
  code: "payment_required" | "rate_limited" | "no_provider" | "upstream_error";
  message: string;
}

export async function aiChat(opts: AiChatOpts): Promise<AiChatResult | AiChatError> {
  const CF_TOKEN = Deno.env.get("CF_API_TOKEN");
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

  const cfModel = opts.cfModel ?? "google-ai-studio/gemini-2.5-flash";
  const lovableModel = opts.lovableModel ?? "google/gemini-2.5-flash";

  const basePayload: Record<string, unknown> = {
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 4000,
  };
  if (opts.jsonObject) basePayload.response_format = { type: "json_object" };

  // 1) Cloudflare BYOK (primary) — does not consume Lovable credit
  if (CF_TOKEN) {
    try {
      const res = await fetch(CF_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CF_TOKEN}`,
        },
        body: JSON.stringify({ ...basePayload, model: cfModel }),
      });
      if (res.ok) {
        const j = await res.json();
        const text = j?.choices?.[0]?.message?.content ?? "";
        return { ok: true, text, provider: "cloudflare" };
      }
      // 429/402 from CF → still try Lovable fallback below (might have different limits)
      const errText = await res.text().catch(() => "");
      console.warn(`CF gateway ${res.status}: ${errText.slice(0, 200)}`);
    } catch (e) {
      console.warn("CF gateway threw:", e);
    }
  }

  // 2) Google AI Studio direct (BYOK) — no Lovable credit
  {
    const res = await googleDirectFetch(basePayload, { model: cfModel });
    if (res) {
      const j = await res.json().catch(() => null);
      const text = j?.choices?.[0]?.message?.content ?? "";
      if (text) return { ok: true, text, provider: "google_direct" };
    }
  }

  // 3) Lovable Gateway — ONLY when explicitly allowed (burns Lovable credit)
  if (LOVABLE_KEY && (await allowLovableFallback())) {
    try {
      const res = await fetch(LOVABLE_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_KEY}`,
        },
        body: JSON.stringify({ ...basePayload, model: lovableModel }),
      });
      if (res.ok) {
        const j = await res.json();
        const text = j?.choices?.[0]?.message?.content ?? "";
        return { ok: true, text, provider: "lovable" };
      }
      const errText = await res.text().catch(() => "");
      if (res.status === 402) {
        return {
          ok: false,
          status: 402,
          code: "payment_required",
          message: "Hết credit AI Gateway. Vui lòng nạp tại Settings → Workspace → Usage.",
        };
      }
      if (res.status === 429) {
        return {
          ok: false,
          status: 429,
          code: "rate_limited",
          message: "AI Gateway đang quá tải. Thử lại sau giây lát.",
        };
      }
      return {
        ok: false,
        status: res.status,
        code: "upstream_error",
        message: errText.slice(0, 300) || `Lovable gateway ${res.status}`,
      };
    } catch (e) {
      console.error("Lovable gateway threw:", e);
    }
  }

  return {
    ok: false,
    status: 503,
    code: "no_provider",
    message: "Nguồn AI Google đang bận. Vui lòng thử lại sau giây lát. 🙏",
  };

}
