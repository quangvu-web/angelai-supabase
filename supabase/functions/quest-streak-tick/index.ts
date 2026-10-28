// Cron 00:30 UTC+7 — break streak nếu user không claim hôm qua (trừ grace day)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const monthKey = today.slice(0, 7);

  // Lấy streak chưa update hôm qua
  const { data: streaks } = await supabase
    .from("user_quest_streaks")
    .select("user_id, current_streak, last_claim_date, grace_used_month, grace_month_key")
    .lt("last_claim_date", today)
    .gt("current_streak", 0);

  let broken = 0, graced = 0;
  for (const s of streaks || []) {
    if (s.last_claim_date === yesterday) continue; // ok
    const sameMonth = s.grace_month_key === monthKey;
    if (sameMonth && (s.grace_used_month ?? 0) < 1) {
      // dùng grace day
      await supabase.from("user_quest_streaks").update({
        grace_used_month: (s.grace_used_month ?? 0) + 1,
        grace_month_key: monthKey,
        last_claim_date: yesterday,
        updated_at: new Date().toISOString(),
      }).eq("user_id", s.user_id);
      graced++;
    } else {
      await supabase.from("user_quest_streaks").update({
        current_streak: 0,
        multiplier: 1.0,
        grace_month_key: monthKey,
        grace_used_month: 0,
        updated_at: new Date().toISOString(),
      }).eq("user_id", s.user_id);
      broken++;
    }
  }

  return new Response(JSON.stringify({ success: true, broken, graced }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
