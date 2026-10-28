// Single gateway: classify intent → pick model from ai_routing_policy → stream → log.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { streamText, type UIMessage } from "npm:ai";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const gateway = createOpenAICompatible({
  name: "lovable",
  baseURL: "https://ai.gateway.lovable.dev/v1",
  headers: { "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
});

const RX_CODE = /\b(code|function|typescript|javascript|python|sql|bug|stack trace|api|class|component)\b/i;
const RX_SPIRITUAL = /\b(linh hồn|tâm linh|thiền|ý nghĩa|vũ trụ|soul|spirit|meditat|enlighten|consciousness|karma|dharma)\b/i;
const RX_IMAGE = /\b(image|picture|photo|draw|paint|generate.*image|ảnh|hình)\b/i;

function quickClassify(text: string): string {
  if (RX_IMAGE.test(text)) return "image";
  if (RX_CODE.test(text)) return "code";
  if (RX_SPIRITUAL.test(text)) return "spiritual";
  return "default";
}

async function loadPolicy(admin: ReturnType<typeof createClient>, intent: string) {
  const { data } = await admin
    .from("ai_routing_policy")
    .select("intent, model, fallback_model")
    .eq("active", true)
    .in("intent", [intent, "default"])
    .order("priority", { ascending: true });
  const exact = data?.find((r: any) => r.intent === intent);
  const fallback = data?.find((r: any) => r.intent === "default");
  return exact ?? fallback ?? { intent: "default", model: "google/gemini-3-flash-preview", fallback_model: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional auth — try to extract user_id from JWT for logging
  let userId: string | null = null;
  let clientId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    try {
      const { data } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
      userId = data?.claims?.sub ?? null;
      clientId = (data?.claims as any)?.client_id ?? null;
    } catch { /* ignore — public access */ }
  }

  let body: { messages?: UIMessage[]; hint_intent?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const messages = body.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "no_messages" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const lastText = (() => {
    const last = messages[messages.length - 1];
    const parts = (last as any).parts ?? [];
    const t = parts.find((p: any) => p.type === "text");
    return t?.text ?? (last as any).content ?? "";
  })();

  const intent = body.hint_intent || quickClassify(String(lastText));
  const policy = await loadPolicy(admin, intent);

  // Accept both UIMessage ({ parts: [...] }) and plain ({ role, content }) shapes
  const modelMessages = messages
    .map((m: any) => {
      const role = m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user";
      const text = Array.isArray(m.parts)
        ? m.parts.filter((p: any) => p?.type === "text").map((p: any) => p.text).join("\n")
        : typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.filter((p: any) => p?.type === "text").map((p: any) => p.text).join("\n")
            : "";
      return { role, content: String(text ?? "").trim() };
    })
    .filter((m: any) => m.content.length > 0);

  if (modelMessages.length === 0) {
    return new Response(JSON.stringify({ error: "no_text_content" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  const t0 = Date.now();
  let modelUsed = policy.model;
  let fallbackTriggered = false;
  let status = "ok";
  let errMsg: string | null = null;

  const tryStream = (modelId: string) => streamText({
    model: gateway(modelId),
    system: "You are Angel A.I., the universal assistant for FUN Ecosystem. Be peer-to-peer (VI: mình - bạn; EN: I - you). Stay concise unless asked otherwise.",
    messages: modelMessages,
    abortSignal: req.signal,
    onFinish: (res) => {
      admin.from("ai_routing_log").insert({
        user_id: userId, client_id: clientId, intent,
        model_used: modelUsed, latency_ms: Date.now() - t0,
        tokens_in: (res.usage as any)?.inputTokens ?? null,
        tokens_out: (res.usage as any)?.outputTokens ?? null,
        status, fallback_triggered: fallbackTriggered, error_message: errMsg,
      }).then(() => {});
    },
  });

  try {
    const result = tryStream(modelUsed);
    return result.toUIMessageStreamResponse({ headers: corsHeaders });
  } catch (e: any) {
    errMsg = e?.message ?? String(e);
    if (policy.fallback_model) {
      try {
        fallbackTriggered = true;
        modelUsed = policy.fallback_model;
        status = "fallback";
        const result = tryStream(modelUsed);
        return result.toUIMessageStreamResponse({ headers: corsHeaders });
      } catch (e2: any) {
        status = "error";
        errMsg = e2?.message ?? String(e2);
      }
    } else {
      status = "error";
    }
    admin.from("ai_routing_log").insert({
      user_id: userId, client_id: clientId, intent,
      model_used: modelUsed, latency_ms: Date.now() - t0,
      status, fallback_triggered: fallbackTriggered, error_message: errMsg,
    }).then(() => {});
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
