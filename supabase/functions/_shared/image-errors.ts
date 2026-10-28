// Shared error classification + retry + fallback for image generation.
//
// 5 error codes surfaced to callers:
//  - daily_cap        : per-user or per-key daily quota reached (HTTP 429)
//  - rate_limited     : upstream provider 429 after all retries (HTTP 429)
//  - moderation       : prompt rejected by safety filter (HTTP 400)
//  - upstream_down    : provider 5xx / network down after fallback (HTTP 502)
//  - internal_error   : bug in our code (HTTP 500)

export type ImageErrorCode =
  | "daily_cap"
  | "rate_limited"
  | "moderation"
  | "upstream_down"
  | "internal_error";

export interface ClassifiedError {
  code: ImageErrorCode;
  message: string;
  httpStatus: number;
  providerStatus?: number;
  providerMessage?: string;
}

const MODERATION_HINTS = [
  "safety",
  "blocked",
  "block_reason",
  "content_policy",
  "moderation",
  "harm",
  "prohibited",
  "recitation",
];

export function classifyProviderError(
  status: number,
  bodyText: string,
): ClassifiedError {
  const lower = (bodyText || "").toLowerCase();
  const looksModeration = MODERATION_HINTS.some((h) => lower.includes(h));

  if (status === 429) {
    return {
      code: "rate_limited",
      message: "Xưởng vẽ đang bận. Bạn thử lại sau vài giây nhé.",
      httpStatus: 429,
      providerStatus: status,
      providerMessage: bodyText.slice(0, 300),
    };
  }
  if ((status === 400 || status === 403) && looksModeration) {
    return {
      code: "moderation",
      message: "Prompt bị bộ lọc an toàn từ chối. Bạn thử viết cách khác nhé.",
      httpStatus: 400,
      providerStatus: status,
      providerMessage: bodyText.slice(0, 300),
    };
  }
  if (status >= 500 || status === 408 || status === 0) {
    return {
      code: "upstream_down",
      message: "Nhà cung cấp vẽ ảnh đang trục trặc. Bạn thử lại sau ít phút nhé.",
      httpStatus: 502,
      providerStatus: status,
      providerMessage: bodyText.slice(0, 300),
    };
  }
  return {
    code: "upstream_down",
    message: "Nhà cung cấp trả về lỗi không xác định.",
    httpStatus: 502,
    providerStatus: status,
    providerMessage: bodyText.slice(0, 300),
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRateLimitRetry(
  input: string,
  init: RequestInit,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<{ response: Response; attempts: number; bodyText: string }> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 600;
  let lastResp: Response | null = null;
  let lastBody = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let resp: Response;
    try {
      resp = await fetch(input, init);
    } catch (e) {
      lastBody = e instanceof Error ? e.message : String(e);
      lastResp = new Response(lastBody, { status: 0 });
      break;
    }
    if (resp.ok) {
      return { response: resp, attempts: attempt, bodyText: "" };
    }
    if (resp.status !== 429) {
      lastResp = resp;
      lastBody = await resp.text().catch(() => "");
      return { response: resp, attempts: attempt, bodyText: lastBody };
    }
    lastResp = resp;
    lastBody = await resp.text().catch(() => "");
    if (attempt < maxAttempts) {
      const delay = baseDelay * Math.pow(2, attempt - 1); // 600, 1200, 2400
      await sleep(delay);
    }
  }
  return { response: lastResp!, attempts: maxAttempts, bodyText: lastBody };
}

// Fallback image generator via Lovable AI Gateway (google/gemini-3.1-flash-image).
// Returns base64 PNG on success, or null when unavailable/failed.
export async function fallbackGenerateViaLovable(
  prompt: string,
): Promise<
  | { ok: true; base64: string; mimeType: string; provider: "lovable_gemini_3_1_flash_image" }
  | { ok: false; classified: ClassifiedError }
> {
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_KEY) {
    return {
      ok: false,
      classified: {
        code: "upstream_down",
        message: "Provider dự phòng chưa cấu hình (LOVABLE_API_KEY).",
        httpStatus: 502,
      },
    };
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return { ok: false, classified: classifyProviderError(res.status, bodyText) };
    }
    const j = await res.json();
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) {
      return {
        ok: false,
        classified: {
          code: "upstream_down",
          message: "Provider dự phòng không trả về ảnh.",
          httpStatus: 502,
        },
      };
    }
    return { ok: true, base64: b64, mimeType: "image/png", provider: "lovable_gemini_3_1_flash_image" };
  } catch (e) {
    return {
      ok: false,
      classified: {
        code: "upstream_down",
        message: e instanceof Error ? e.message : "Fallback provider threw.",
        httpStatus: 502,
      },
    };
  }
}
