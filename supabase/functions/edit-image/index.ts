import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  logAiProviderUsage,
  withCloudUsage,
} from "../_shared/cost-guards.ts";
import { resolveCaller } from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_EDIT_LIMIT = 20;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(withCloudUsage("edit-image", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl, instruction, style } = await req.json();
    if (!imageUrl || !instruction) {
      return json({ error: "imageUrl and instruction are required" }, 400);
    }

    const caller = await resolveCaller(req, corsHeaders);
    if (caller instanceof Response) return caller;

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    let effectiveEditLimit = DAILY_EDIT_LIMIT;
    if (caller.via === "api_key" && caller.apiKeyId) {
      const { data: keyRow } = await supabase
        .from("user_api_keys")
        .select("image_daily_limit")
        .eq("id", caller.apiKeyId)
        .maybeSingle();
      if (keyRow?.image_daily_limit && keyRow.image_daily_limit > 0) {
        effectiveEditLimit = keyRow.image_daily_limit;
      }
    }

    const { data: usageCheck, error: usageError } = await supabase.rpc("check_ai_usage_only", {
      _user_id: caller.userId,
      _usage_type: "edit_image",
      _daily_limit: effectiveEditLimit,
    });


    const usageRow = Array.isArray(usageCheck) ? usageCheck[0] : usageCheck;
    if (usageError) {
      console.error("Usage check error:", usageError);
    } else if (usageRow && !usageRow.allowed) {
      return json({
        error: `Daily image edit limit reached (${effectiveEditLimit}/day). Please try again tomorrow.`,
        limit_reached: true,
        current_count: usageRow.current_count,
        daily_limit: usageRow.daily_limit ?? effectiveEditLimit,
        via: caller.via,
      }, 429);
    }

    const qualityBoost = "ultra sharp, high resolution, detailed, professional quality, sharp focus";
    const stylePrompts: Record<string, string> = {
      spiritual: "divine light, ethereal, spiritual, peaceful, heavenly atmosphere, golden rays",
      realistic: "photorealistic, professional photography, DSLR quality",
      artistic: "artistic, oil painting style, masterpiece, beautiful composition",
    };
    const enhancedInstruction = `${instruction}. ${stylePrompts[style] ? `Style: ${stylePrompts[style]}, ` : ""}${qualityBoost}`;

    let imageBase64: string;
    let imageMimeType: string;
    if (String(imageUrl).startsWith("data:image/")) {
      const matches = String(imageUrl).match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) throw new Error("Invalid base64 image format");
      imageMimeType = `image/${matches[1]}`;
      imageBase64 = matches[2];
    } else {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error("Failed to download source image");
      const imgBuffer = await imgResponse.arrayBuffer();
      imageMimeType = imgResponse.headers.get("content-type") || "image/jpeg";
      imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));
    }

    const editPrompt = `You are an expert image editor. Edit this image according to the following instruction:
${enhancedInstruction}

Rules:
1. Keep the original composition and main elements as much as possible.
2. Only modify what is specifically requested.
3. Maintain the quality and resolution.
4. Apply changes naturally.
5. You are editing the existing image, not creating a new one.`;

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: editPrompt },
              { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
            ],
          }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
    );

    await logAiProviderUsage({
      functionName: "edit-image",
      provider: "google_direct",
      model: "gemini-2.0-flash-exp",
      status: googleResponse.status,
      userId: caller.userId,
      estimatedInputTokens: Math.ceil(editPrompt.length / 4),
      metadata: { style, imageMimeType },
    });

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error("Google AI edit error:", googleResponse.status, errorText);
      if (googleResponse.status === 429) {
        return json({ error: "Too many requests. Please try again later." }, 429);
      }
      throw new Error("Failed to edit image via Google AI Studio");
    }

    const googleData = await googleResponse.json();
    const parts = googleData.candidates?.[0]?.content?.parts || [];
    let resultBase64: string | null = null;
    let resultMimeType = "image/png";
    let textResponse = "";

    for (const part of parts) {
      if (part.inlineData) {
        resultBase64 = part.inlineData.data;
        resultMimeType = part.inlineData.mimeType || "image/png";
      }
      if (part.text) textResponse = part.text;
    }
    if (!resultBase64) throw new Error("Could not edit image. Please try another instruction.");

    let finalImageUrl = `data:${resultMimeType};base64,${resultBase64}`;
    try {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const binaryData = decode(resultBase64);
      const ext = resultMimeType.includes("png") ? "png" : resultMimeType.includes("webp") ? "webp" : "jpeg";
      const fileName = `${caller.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-edited.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("ai-images")
        .upload(fileName, binaryData, { contentType: resultMimeType, upsert: false });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
      } else {
        const { data: publicUrlData } = supabaseAdmin.storage.from("ai-images").getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;
      }
    } catch (storageError) {
      console.error("Storage operation error:", storageError);
    }

    try {
      await supabase.rpc("increment_ai_usage", {
        _user_id: caller.userId,
        _usage_type: "edit_image",
      });
    } catch (incErr) {
      console.error("Failed to increment usage:", incErr);
    }

    return json({ imageUrl: finalImageUrl, description: textResponse, instruction: enhancedInstruction });
  } catch (error) {
    console.error("Edit image error:", error);
    return json({
      error: error instanceof Error ? error.message : "Could not edit image. Please try again.",
    }, 500);
  }
}));
