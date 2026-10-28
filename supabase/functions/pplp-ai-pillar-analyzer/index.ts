import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type AnalyzeMode = 'quick' | 'deep';

type QuickResult = {
  mode: 'quick';
  score: number;
  is_positive: boolean;
  short_message: string;
};

type DeepResult = {
  mode: 'deep';
  pillars: { repentance: number; gratitude: number; service: number; helping: number; giving: number };
  pillars_legacy: { truth: number; sustain: number; heal: number; service: number; unity: number };
  nlp_features: { gratitude_score: number; repentance_score: number; ego_signal: number; authenticity: number; love_tone: number; depth: number };
  ego_risk: number;
  explanation: string;
};

interface AnalyzeRequest {
  content: string;
  content_type?: string;
  context?: string;
  mode?: AnalyzeMode; // default 'deep' for backward compat
}

const DEFAULT_RESULT = {
  pillars: { repentance: 0, gratitude: 0, service: 0, helping: 0, giving: 0 },
  pillars_legacy: { truth: 0, sustain: 0, heal: 0, service: 0, unity: 0 },
  nlp_features: { gratitude_score: 0, repentance_score: 0, ego_signal: 0, authenticity: 0, love_tone: 0, depth: 0 },
  ego_risk: 0,
  explanation: "",
  mode: 'deep' as AnalyzeMode,
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v || 0));

// ────────────────────────────────────────────────────────────────────
// QUICK MODE — ~1s, returns minimal score for instant UX feedback
// ────────────────────────────────────────────────────────────────────
async function runQuick(content: string, contentType: string, apiKey: string) {
  const sys = `Bạn là bộ chấm nhanh PPLP cho hệ sinh thái FUN.
Trả về duy nhất 1 lần gọi tool với:
- score: 0–100 (chất lượng tổng thể của nội dung dựa trên 5 trụ Sám Hối / Biết Ơn / Phụng Sự / Giúp Đỡ / Trao Tặng)
- is_positive: true nếu nội dung mang giá trị thật (không spam, không ego cao)
- short_message: 1 câu tiếng Việt (≤ 20 từ) tóm tắt nhận định, giọng trung tính ngang hàng (xưng "mình"/"bạn", KHÔNG dùng "Cha"/"Con").`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Phân tích nhanh ${contentType}:\n\n${content.slice(0, 1500)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "quick_score",
          parameters: {
            type: "object",
            properties: {
              score: { type: "number", description: "Tổng điểm 0–100" },
              is_positive: { type: "boolean" },
              short_message: { type: "string" },
            },
            required: ["score", "is_positive", "short_message"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "quick_score" } },
    }),
  });

  if (!r.ok) {
    return { ok: false as const, status: r.status, text: await r.text() };
  }
  const data = await r.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) return { ok: false as const, status: 500, text: "no tool call" };
  const a = JSON.parse(tc.function.arguments);
  return {
    ok: true as const,
    result: {
      mode: 'quick' as const,
      score: clamp(a.score, 0, 100),
      is_positive: !!a.is_positive,
      short_message: String(a.short_message || "").slice(0, 200),
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// DEEP MODE — full v2.0 5-pillar + NLP analysis (legacy behavior)
// ────────────────────────────────────────────────────────────────────
async function runDeep(content: string, contentType: string, context: string | undefined, apiKey: string) {
  const systemPrompt = `You are the PPLP (PureLove Protocol) AI Analyzer for the FUN ecosystem — a Human Value Recognition Engine.

## YOUR MISSION
Analyze content against 5 Pillars of Light to measure REAL human value — not quantity, but QUALITY and genuine transformation.

## 5 PILLARS OF LIGHT (score each 0, 1, or 2):

1. **Sám Hối (Repentance)** — Does the content show genuine self-reflection, acknowledgment of mistakes, humility, willingness to grow?
   - 0 = absent, 1 = present, 2 = deeply expressed with real transformation

2. **Biết Ơn (Gratitude)** — Does it express authentic gratitude, appreciation for life/others/lessons?
   - 0 = absent, 1 = present, 2 = deeply felt and specific gratitude

3. **Phụng Sự (Service)** — Does it serve a higher purpose, contribute lasting value, serve the community selflessly?
   - 0 = absent, 1 = present, 2 = active service with clear impact

4. **Giúp Đỡ (Helping)** — Does it directly help others, provide solutions, support, guidance?
   - 0 = absent, 1 = present, 2 = concrete help with verifiable benefit

5. **Trao Tặng (Giving)** — Does it involve giving (time, knowledge, resources, love) without expecting return?
   - 0 = absent, 1 = present, 2 = generous giving with impact evidence

## NLP FEATURES (each 0.0 to 1.0):
- **gratitude_score**, **repentance_score**, **ego_signal** (HIGH = bad), **authenticity**, **love_tone**, **depth**

## CRITICAL RULES:
- 1 post with real transformation > 100 spam posts
- No Proof → No Score (empty claims score 0)
- High ego → scores decrease
- Helping others genuinely → scores increase strongly
- Fraud/manipulation → exponential penalty

## TONE FOR explanation FIELD:
Viết bằng tiếng Việt, giọng ngang hàng (xưng "mình"/"bạn"), KHÔNG dùng "Cha"/"Con". Sâu sắc, cô đọng, 2–4 câu.

Respond ONLY with the tool call.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this ${contentType}:\n\n${content.slice(0, 3000)}${context ? `\n\nContext: ${context}` : ''}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "analyze_pplp_v2",
          description: "Return v2.0 pillar scores, NLP features, and ego risk",
          parameters: {
            type: "object",
            properties: {
              repentance: { type: "number" },
              gratitude: { type: "number" },
              service: { type: "number" },
              helping: { type: "number" },
              giving: { type: "number" },
              gratitude_score: { type: "number" },
              repentance_score: { type: "number" },
              ego_signal: { type: "number" },
              authenticity: { type: "number" },
              love_tone: { type: "number" },
              depth: { type: "number" },
              explanation: { type: "string" },
            },
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "analyze_pplp_v2" } },
    }),
  });

  if (!response.ok) {
    return { ok: false as const, status: response.status, text: await response.text() };
  }

  const aiResult = await response.json();
  const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { ok: false as const, status: 500, text: "no tool call" };

  const a = JSON.parse(toolCall.function.arguments);
  return {
    ok: true as const,
    result: {
      mode: 'deep' as const,
      pillars: {
        repentance: clamp(a.repentance, 0, 2),
        gratitude: clamp(a.gratitude, 0, 2),
        service: clamp(a.service, 0, 2),
        helping: clamp(a.helping, 0, 2),
        giving: clamp(a.giving, 0, 2),
      },
      pillars_legacy: {
        truth: clamp(a.repentance, 0, 2),
        sustain: clamp(a.gratitude, 0, 2),
        heal: clamp(a.helping, 0, 2),
        service: clamp(a.service, 0, 2),
        unity: clamp(a.giving, 0, 2),
      },
      nlp_features: {
        gratitude_score: clamp(a.gratitude_score, 0, 1),
        repentance_score: clamp(a.repentance_score, 0, 1),
        ego_signal: clamp(a.ego_signal, 0, 1),
        authenticity: clamp(a.authenticity, 0, 1),
        love_tone: clamp(a.love_tone, 0, 1),
        depth: clamp(a.depth, 0, 1),
      },
      ego_risk: clamp(a.ego_signal, 0, 1),
      explanation: a.explanation || "",
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { content, content_type, context, mode = 'deep' }: AnalyzeRequest = await req.json();
    const contentType = content_type || 'content';

    if (!content || content.trim().length < 10) {
      return new Response(
        JSON.stringify({ ...DEFAULT_RESULT, mode, explanation: "Content too short to analyze" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const exec = mode === 'quick'
      ? await runQuick(content, contentType, LOVABLE_API_KEY)
      : await runDeep(content, contentType, context, LOVABLE_API_KEY);

    if (!exec.ok) {
      if (exec.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (exec.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error("AI gateway error:", exec.status, exec.text);
      // Fallback defaults
      if (mode === 'quick') {
        return new Response(JSON.stringify({
          mode: 'quick', score: 50, is_positive: true,
          short_message: "Hệ thống chấm tạm thời chưa truy cập được, dùng điểm mặc định.",
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        ...DEFAULT_RESULT,
        pillars: { repentance: 1, gratitude: 1, service: 1, helping: 1, giving: 1 },
        pillars_legacy: { truth: 1, sustain: 1, heal: 1, service: 1, unity: 1 },
        ego_risk: 0.1,
        explanation: "AI analysis unavailable, default scores applied",
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (exec.result.mode === 'quick') {
      const r = exec.result;
      console.log(`[PPLP AI quick] score=${r.score} positive=${r.is_positive}`);
    } else {
      const r = exec.result;
      console.log(`[PPLP AI deep] R${r.pillars.repentance} G${r.pillars.gratitude} S${r.pillars.service} H${r.pillars.helping} Gi${r.pillars.giving} | Ego ${r.ego_risk}`);
    }

    return new Response(JSON.stringify(exec.result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("PPLP AI Analyzer error:", error);
    return new Response(JSON.stringify({
      ...DEFAULT_RESULT,
      pillars: { repentance: 1, gratitude: 1, service: 1, helping: 1, giving: 1 },
      pillars_legacy: { truth: 1, sustain: 1, heal: 1, service: 1, unity: 1 },
      ego_risk: 0.1,
      explanation: "Analysis error, defaults applied",
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
