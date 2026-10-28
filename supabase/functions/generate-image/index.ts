import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { withCloudUsage, logAiProviderUsage } from "../_shared/cost-guards.ts";
import { resolveCaller } from "../_shared/api-key-auth.ts";
import {
  classifyProviderError,
  fetchWithRateLimitRetry,
  fallbackGenerateViaLovable,
  type ImageErrorCode,
} from "../_shared/image-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_IMAGE_LIMIT = 20;

function errorResponse(
  code: ImageErrorCode,
  message: string,
  httpStatus: number,
  extra: Record<string, unknown> = {},
): Response {
  return new Response(
    JSON.stringify({ error: message, code, ...extra }),
    { status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function logImageEvent(params: {
  provider: string;
  model: string;
  status: number;
  userId?: string | null;
  errorCode?: ImageErrorCode | "ok";
  metadata?: Record<string, unknown>;
}) {
  await logAiProviderUsage({
    functionName: "generate-image",
    provider: params.provider,
    model: params.model,
    status: params.status,
    userId: params.userId ?? null,
    metadata: {
      error_code: params.errorCode ?? "ok",
      ...(params.metadata ?? {}),
    },
  });
}

async function uploadBase64(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  base64: string,
  mimeType: string,
  suffix: string,
): Promise<string | null> {
  try {
    const binary = decode(base64);
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpeg";
    const fileName = `${userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${suffix}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("ai-images")
      .upload(fileName, binary, { contentType: mimeType, upsert: false });
    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }
    const { data } = supabaseAdmin.storage.from("ai-images").getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e) {
    console.error("Storage upload threw:", e);
    return null;
  }
}

serve(withCloudUsage("generate-image", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userIdForLog: string | null = null;
  try {
    const { prompt, style, mode = "fast", image_width = 1024, image_height = 1024 } = await req.json();

    const caller = await resolveCaller(req, corsHeaders);
    if (caller instanceof Response) return caller;
    userIdForLog = caller.userId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userId = caller.userId;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // ===== 1) daily_cap check =====
    let effectiveImageLimit = DAILY_IMAGE_LIMIT;
    if (caller.via === "api_key" && caller.apiKeyId) {
      const { data: keyRow } = await supabaseAdmin
        .from("user_api_keys")
        .select("image_daily_limit")
        .eq("id", caller.apiKeyId)
        .maybeSingle();
      if (keyRow?.image_daily_limit && keyRow.image_daily_limit > 0) {
        effectiveImageLimit = keyRow.image_daily_limit;
      }
    }

    const { data: usageCheck } = await supabaseAdmin.rpc("check_ai_usage_only", {
      _user_id: userId,
      _usage_type: "generate_image",
      _daily_limit: effectiveImageLimit,
    });

    if (usageCheck && usageCheck.length > 0 && !usageCheck[0].allowed) {
      await logImageEvent({
        provider: "quota",
        model: "n/a",
        status: 429,
        userId,
        errorCode: "daily_cap",
        metadata: { effective_limit: effectiveImageLimit, via: caller.via },
      });
      return errorResponse(
        "daily_cap",
        `Bạn ơi, hôm nay bạn đã tạo ${effectiveImageLimit} hình ảnh rồi. Quay lại vào ngày mai nhé! 🌸`,
        429,
        {
          limit_reached: true,
          current_count: usageCheck[0].current_count,
          daily_limit: usageCheck[0].daily_limit,
          via: caller.via,
        },
      );
    }

    // ===== 2) Build prompt =====
    const MAX_USER_PROMPT = 800;
    const MAX_TOTAL_PROMPT = 1200;
    const trimmedPrompt = String(prompt ?? "").trim().slice(0, MAX_USER_PROMPT);
    const qualityBoost =
      "ultra sharp, high resolution, 8K UHD, crystal clear, highly detailed, professional quality, sharp focus, intricate details";

    let enhancedPrompt = trimmedPrompt;
    if (style === "spiritual") {
      enhancedPrompt = `${trimmedPrompt}, divine light, ethereal, spiritual, peaceful, heavenly atmosphere, golden rays, angelic, ${qualityBoost}`;
    } else if (style === "realistic") {
      enhancedPrompt = `${trimmedPrompt}, photorealistic, professional photography, DSLR quality, ${qualityBoost}`;
    } else if (style === "artistic") {
      enhancedPrompt = `${trimmedPrompt}, artistic, oil painting style, masterpiece, beautiful composition, ${qualityBoost}`;
    } else {
      enhancedPrompt = `${trimmedPrompt}, ${qualityBoost}`;
    }
    if (enhancedPrompt.length > MAX_TOTAL_PROMPT) enhancedPrompt = enhancedPrompt.slice(0, MAX_TOTAL_PROMPT);

    let finalImageUrl = "";
    let textResponse = "";
    let successProvider = "";
    let successModel = "";

    if (mode === "fast") {
      // ===== 3a) Fast mode: Fal.ai Flux Schnell with retry + Lovable fallback =====
      const FAL_KEY = Deno.env.get("FAL_KEY");
      let primaryClassified: ReturnType<typeof classifyProviderError> | null = null;

      if (FAL_KEY) {
        const { response, attempts, bodyText } = await fetchWithRateLimitRetry(
          "https://fal.run/fal-ai/flux-1/schnell",
          {
            method: "POST",
            headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: enhancedPrompt,
              image_size: { width: image_width, height: image_height },
              num_images: 1,
            }),
          },
          { maxAttempts: 3, baseDelayMs: 600 },
        );

        if (response.ok) {
          const falData = await response.json();
          const falImageUrl = falData.images?.[0]?.url;
          if (falImageUrl) {
            try {
              const imgResp = await fetch(falImageUrl);
              const imgBuffer = new Uint8Array(await imgResp.arrayBuffer());
              const contentType = imgResp.headers.get("content-type") || "image/jpeg";
              const b64 = btoa(String.fromCharCode(...imgBuffer));
              const uploaded = await uploadBase64(supabaseAdmin, userId, b64, contentType, "fast");
              finalImageUrl = uploaded ?? falImageUrl;
            } catch {
              finalImageUrl = falImageUrl;
            }
            successProvider = "fal";
            successModel = "flux-1-schnell";
            textResponse = "Ảnh đã được tạo bằng chế độ Siêu tốc ⚡";
            await logImageEvent({
              provider: "fal",
              model: "flux-1-schnell",
              status: 200,
              userId,
              errorCode: "ok",
              metadata: { attempts, mode },
            });
          }
        } else {
          primaryClassified = classifyProviderError(response.status, bodyText);
          console.warn(`Fal.ai failed after ${attempts} attempt(s):`, response.status, bodyText.slice(0, 200));
          await logImageEvent({
            provider: "fal",
            model: "flux-1-schnell",
            status: response.status,
            userId,
            errorCode: primaryClassified.code,
            metadata: { attempts, mode, provider_message: primaryClassified.providerMessage },
          });
        }
      } else {
        primaryClassified = {
          code: "upstream_down",
          message: "FAL_KEY not configured",
          httpStatus: 502,
        };
      }

      // Fallback to Lovable AI Gateway (moderation errors are NOT retried on fallback)
      if (!finalImageUrl && primaryClassified && primaryClassified.code !== "moderation") {
        console.log("Trying Lovable AI Gateway fallback...");
        const fb = await fallbackGenerateViaLovable(enhancedPrompt);
        if (fb.ok) {
          const uploaded = await uploadBase64(supabaseAdmin, userId, fb.base64, fb.mimeType, "fast-fb");
          finalImageUrl = uploaded ?? `data:${fb.mimeType};base64,${fb.base64}`;
          successProvider = fb.provider;
          successModel = "google/gemini-3.1-flash-image";
          textResponse = "Ảnh đã được tạo bằng chế độ Siêu tốc ⚡ (provider dự phòng)";
          await logImageEvent({
            provider: fb.provider,
            model: "google/gemini-3.1-flash-image",
            status: 200,
            userId,
            errorCode: "ok",
            metadata: { mode, fallback_from: "fal" },
          });
        } else {
          await logImageEvent({
            provider: "lovable_gemini_3_1_flash_image",
            model: "google/gemini-3.1-flash-image",
            status: fb.classified.httpStatus,
            userId,
            errorCode: fb.classified.code,
            metadata: { mode, fallback_from: "fal", provider_message: fb.classified.providerMessage },
          });
        }
      }

      if (!finalImageUrl) {
        const cls = primaryClassified ?? {
          code: "upstream_down" as ImageErrorCode,
          message: "Không có provider khả dụng",
          httpStatus: 502,
        };
        return errorResponse(cls.code, cls.message, cls.httpStatus, {
          provider_status: cls.providerStatus,
          provider_message: cls.providerMessage,
        });
      }
    } else {
      // ===== 3b) Spiritual mode: Google AI Studio with retry + Lovable fallback =====
      const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
      let primaryClassified: ReturnType<typeof classifyProviderError> | null = null;

      const containsVietnamese = /[À-ỹ]/.test(String(prompt ?? ""));
      let spiritualPrompt = enhancedPrompt;
      if (containsVietnamese) {
        spiritualPrompt = `${enhancedPrompt}\n\nIMPORTANT: If image includes Vietnamese words, render exactly with diacritics.`;
      }

      if (GOOGLE_AI_API_KEY) {
        const { response, attempts, bodyText } = await fetchWithRateLimitRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: spiritualPrompt }] }],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            }),
          },
          { maxAttempts: 3, baseDelayMs: 800 },
        );

        if (response.ok) {
          const googleData = await response.json();
          const parts = googleData.candidates?.[0]?.content?.parts || [];
          let base64Data: string | null = null;
          let mimeType = "image/png";
          for (const p of parts) {
            if (p.inlineData) { base64Data = p.inlineData.data; mimeType = p.inlineData.mimeType || "image/png"; }
            if (p.text) textResponse = p.text;
          }
          if (base64Data) {
            const uploaded = await uploadBase64(supabaseAdmin, userId, base64Data, mimeType, "spiritual");
            finalImageUrl = uploaded ?? `data:${mimeType};base64,${base64Data}`;
            successProvider = "google_direct";
            successModel = "gemini-2.0-flash-exp";
            await logImageEvent({
              provider: "google_direct",
              model: "gemini-2.0-flash-exp",
              status: 200,
              userId,
              errorCode: "ok",
              metadata: { attempts, mode },
            });
          } else {
            primaryClassified = {
              code: "moderation",
              message: "Google trả về không có ảnh (có thể bị bộ lọc chặn).",
              httpStatus: 400,
            };
          }
        } else {
          primaryClassified = classifyProviderError(response.status, bodyText);
          console.warn(`Google spiritual failed after ${attempts} attempt(s):`, response.status);
          await logImageEvent({
            provider: "google_direct",
            model: "gemini-2.0-flash-exp",
            status: response.status,
            userId,
            errorCode: primaryClassified.code,
            metadata: { attempts, mode, provider_message: primaryClassified.providerMessage },
          });
        }
      } else {
        primaryClassified = {
          code: "upstream_down",
          message: "GOOGLE_AI_API_KEY not configured",
          httpStatus: 502,
        };
      }

      if (!finalImageUrl && primaryClassified && primaryClassified.code !== "moderation") {
        console.log("Trying Lovable AI Gateway fallback for spiritual...");
        const fb = await fallbackGenerateViaLovable(spiritualPrompt);
        if (fb.ok) {
          const uploaded = await uploadBase64(supabaseAdmin, userId, fb.base64, fb.mimeType, "spiritual-fb");
          finalImageUrl = uploaded ?? `data:${fb.mimeType};base64,${fb.base64}`;
          successProvider = fb.provider;
          successModel = "google/gemini-3.1-flash-image";
          textResponse = "Ảnh linh thiêng (provider dự phòng) ✨";
          await logImageEvent({
            provider: fb.provider,
            model: "google/gemini-3.1-flash-image",
            status: 200,
            userId,
            errorCode: "ok",
            metadata: { mode, fallback_from: "google_direct" },
          });
        } else {
          await logImageEvent({
            provider: "lovable_gemini_3_1_flash_image",
            model: "google/gemini-3.1-flash-image",
            status: fb.classified.httpStatus,
            userId,
            errorCode: fb.classified.code,
            metadata: { mode, fallback_from: "google_direct", provider_message: fb.classified.providerMessage },
          });
        }
      }

      if (!finalImageUrl) {
        const cls = primaryClassified ?? {
          code: "upstream_down" as ImageErrorCode,
          message: "Không có provider khả dụng",
          httpStatus: 502,
        };
        return errorResponse(cls.code, cls.message, cls.httpStatus, {
          provider_status: cls.providerStatus,
          provider_message: cls.providerMessage,
        });
      }
    }

    // ===== 4) Success → increment quota =====
    await supabaseAdmin.rpc("increment_ai_usage", {
      _user_id: userId,
      _usage_type: "generate_image",
    });

    return new Response(
      JSON.stringify({
        imageUrl: finalImageUrl,
        description: textResponse,
        prompt: enhancedPrompt,
        mode,
        provider: successProvider,
        model: successModel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Generate image internal error:", error);
    const msg = error instanceof Error ? error.message : "Không thể tạo hình ảnh.";
    await logImageEvent({
      provider: "internal",
      model: "n/a",
      status: 500,
      userId: userIdForLog,
      errorCode: "internal_error",
      metadata: { message: msg.slice(0, 300) },
    });
    return errorResponse("internal_error", msg, 500);
  }
}));
