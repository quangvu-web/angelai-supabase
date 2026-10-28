import { aiChat } from "../_shared/ai-gateway.ts";
import {
  costCorsHeaders,
  jsonResponse,
  logAiProviderUsage,
  rateLimitCostlyAction,
  requireAuthenticatedUser,
  withCloudUsage,
} from "../_shared/cost-guards.ts";

const DAILY_ANALYZE_IMAGE_LIMIT = 20;
const MAX_IMAGES = 5;

Deno.serve(withCloudUsage("analyze-image", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: costCorsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const auth = await requireAuthenticatedUser(req);
  if (auth instanceof Response) return auth;

  const limit = await rateLimitCostlyAction({
    userId: auth.userId,
    action: "analyze_image",
    limit: DAILY_ANALYZE_IMAGE_LIMIT,
    increment: true,
  });
  if (limit instanceof Response) return limit;

  let body: { imageUrl?: string; imageUrls?: string[]; question?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const urls: string[] = [];
  if (Array.isArray(body.imageUrls)) {
    for (const url of body.imageUrls) {
      if (typeof url === "string" && (url.startsWith("http") || url.startsWith("data:image/"))) {
        urls.push(url);
      }
    }
  }
  if (typeof body.imageUrl === "string" && body.imageUrl && !urls.includes(body.imageUrl)) {
    urls.push(body.imageUrl);
  }

  const boundedUrls = urls.slice(0, MAX_IMAGES);
  if (boundedUrls.length === 0) {
    return jsonResponse({ error: "At least one image is required." }, 400);
  }

  const multiHint = boundedUrls.length > 1
    ? `\n\nThe user attached ${boundedUrls.length} images. Refer to them as Image 1, Image 2, etc.`
    : "";

  const userContent = [
    {
      type: "text",
      text: (body.question || "Please describe this image and answer the user's question about it.") + multiHint,
    },
    ...boundedUrls.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const result = await aiChat({
    messages: [
      {
        role: "system",
        content:
          "You are Angel AI for FUN Ecosystem. Analyze images clearly, warmly, and responsibly. Do not claim supernatural authority. Answer in the user's language. Avoid markdown unless needed.",
      },
      { role: "user", content: userContent },
    ],
    cfModel: "google-ai-studio/gemini-2.5-flash",
    lovableModel: "google/gemini-2.5-flash",
    maxTokens: 1500,
  });

  if (!result.ok) {
    await logAiProviderUsage({
      functionName: "analyze-image",
      provider: result.code === "payment_required" ? "lovable" : "unknown",
      model: "gemini-2.5-flash",
      status: result.status,
      userId: auth.userId,
      metadata: { image_count: boundedUrls.length },
    });
    return jsonResponse({ error: result.message }, result.status);
  }

  await logAiProviderUsage({
    functionName: "analyze-image",
    provider: result.provider,
    model: result.provider === "cloudflare" ? "google-ai-studio/gemini-2.5-flash" : "google/gemini-2.5-flash",
    status: 200,
    userId: auth.userId,
    estimatedInputTokens: Math.ceil(JSON.stringify(userContent).length / 4),
    estimatedOutputTokens: Math.ceil(result.text.length / 4),
    metadata: { image_count: boundedUrls.length },
  });

  return jsonResponse({ content: result.text, provider: result.provider });
}));
