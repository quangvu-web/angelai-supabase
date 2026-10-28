// Quest claim — verify evidence (AI scoring) → call RPC claim_quest_reward
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body { quest_id: string; evidence_text?: string; evidence_ref?: string }

async function scoreEvidence(text: string): Promise<number> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || !text || text.length < 5) return 1.0;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Bạn chấm tính chân thật của 1 đoạn evidence từ 0.0 đến 1.0. Chỉ trả về 1 số JSON: {\"score\":0.x}." },
          { role: "user", content: text.slice(0, 1000) },
        ],
      }),
    });
    if (!res.ok) return 0.8;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const match = raw.match(/0?\.\d+|1\.0|0|1/);
    return match ? Math.max(0, Math.min(1, parseFloat(match[0]))) : 0.8;
  } catch { return 0.8; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    const body = (await req.json()) as Body;
    if (!body.quest_id) return new Response(JSON.stringify({ error: "quest_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const aiScore = body.evidence_text ? await scoreEvidence(body.evidence_text) : 1.0;

    const { data, error } = await supabase.rpc("claim_quest_reward", {
      p_quest_id: body.quest_id,
      p_evidence_ref: body.evidence_ref ?? body.evidence_text ?? null,
      p_ai_score: aiScore,
      p_risk_score: 0,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes?.user?.id;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Pet XP gain (proportional to base xp of the quest)
    let pet_xp: any = null;
    if (uid) {
      const xpDelta = Math.max(5, Math.round(((data as any)?.xp_awarded ?? 10) / 4));
      const r = await admin.rpc("pet_gain_xp", { p_user_id: uid, p_xp: xpDelta, p_source: "quest", p_source_ref: body.quest_id });
      pet_xp = r.data;
    }

    // Box ticket on streak milestone
    let granted_box: { tier: string; ticket_id: string } | null = null;
    const streakTierMap: Record<number, string> = { 7: "common", 14: "rare", 30: "epic", 60: "legendary", 90: "cosmic", 180: "cosmic" };
    const newStreak = (data as any)?.new_streak;
    if (newStreak && streakTierMap[newStreak] && uid) {
      const { data: tid } = await admin.rpc("grant_box_ticket", {
        p_user_id: uid,
        p_tier_code: streakTierMap[newStreak],
        p_source: `streak_${newStreak}`,
        p_source_ref: body.quest_id,
      });
      if (tid) granted_box = { tier: streakTierMap[newStreak], ticket_id: tid as string };
    }

    return new Response(JSON.stringify({ ...data, ai_score: aiScore, granted_box, pet_xp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
