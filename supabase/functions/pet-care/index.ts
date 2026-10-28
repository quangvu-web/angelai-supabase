// Pet daily care — feed / play / meditate, mỗi action 1 lần/ngày (UTC)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Action = "feed" | "play" | "meditate";

const ACTION_CONFIG: Record<Action, { xp: number; stat: "energy" | "mood" | "aura"; delta: number; emoji: string; label: string }> = {
  feed:     { xp: 10, stat: "energy", delta: 8,  emoji: "🍙", label: "Cho ăn" },
  play:     { xp: 8,  stat: "mood",   delta: 8,  emoji: "🎈", label: "Chơi đùa" },
  meditate: { xp: 12, stat: "aura",   delta: 3,  emoji: "✨", label: "Toả ánh sáng" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await supa.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);

    const { action } = (await req.json()) as { action: Action };
    if (!action || !ACTION_CONFIG[action]) return json({ error: "invalid action" }, 400);

    const { data: pet } = await supa.from("pets").select("*").eq("user_id", uid).maybeSingle();
    if (!pet) return json({ error: "no pet" }, 404);

    const cfg = ACTION_CONFIG[action];
    const today = new Date().toISOString().slice(0, 10);
    const sourceRef = `care:${action}:${today}`;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Dedup: đã chăm sóc action này hôm nay chưa
    const { data: existing } = await admin
      .from("pet_xp_ledger")
      .select("id")
      .eq("user_id", uid)
      .eq("source", "care")
      .eq("source_ref", sourceRef)
      .maybeSingle();
    if (existing) return json({ error: "Hôm nay bạn đã thực hiện hành động này rồi. Quay lại vào ngày mai nhé ✨", code: "already_done" }, 429);

    // Cộng XP qua RPC
    const xpRes = await admin.rpc("pet_gain_xp", { p_user_id: uid, p_xp: cfg.xp, p_source: "care", p_source_ref: sourceRef });
    if (xpRes.error) return json({ error: xpRes.error.message }, 500);

    // Cập nhật stat (cap 100)
    const newStatVal = Math.min(100, (pet[cfg.stat] ?? 0) + cfg.delta);
    const patch: Record<string, unknown> = { [cfg.stat]: newStatVal };
    if (action === "feed") patch.last_fed_at = new Date().toISOString();
    await admin.from("pets").update(patch).eq("id", pet.id);

    return json({
      ok: true,
      action,
      label: cfg.label,
      emoji: cfg.emoji,
      xp_gained: cfg.xp,
      stat: cfg.stat,
      stat_new: newStatVal,
      xp: xpRes.data ?? null,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
