// Cron 00:00 UTC+7 — sinh 5 quest mỗi ngày cho user active 7 ngày qua
// Cũng hỗ trợ chế độ single-user: gọi có Authorization Bearer JWT để gán quest cho user hiện tại
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Single-user mode: nếu có JWT, chỉ gán cho user đó
    const authHeader = req.headers.get("Authorization");
    let singleUserId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) singleUserId = userData.user.id;
    }

    let users: { user_id: string }[] = [];
    if (singleUserId) {
      users = [{ user_id: singleUserId }];
    } else {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .gte("updated_at", since)
        .limit(5000);
      users = data ?? [];
    }

    const { data: templates } = await supabase
      .from("quest_templates")
      .select("id, code, weight, dimension, phase")
      .eq("active", true)
      .eq("phase", 1)
      .gt("weight", 0);

    if (!templates?.length || !users?.length) {
      return new Response(JSON.stringify({ success: true, assigned: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }))
      .toISOString().slice(0, 10);

    let assigned = 0;
    for (const u of users) {
      // Skip nếu user đã có quest hôm nay
      const { count } = await supabase
        .from("user_daily_quests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.user_id)
        .eq("assigned_date", today);
      if ((count ?? 0) > 0) continue;

      const pool = [...templates];
      const picks: typeof templates = [];
      for (let i = 0; i < 5 && pool.length; i++) {
        const totalW = pool.reduce((s, t) => s + Number(t.weight), 0);
        let r = Math.random() * totalW;
        let idx = 0;
        for (let j = 0; j < pool.length; j++) {
          r -= Number(pool[j].weight);
          if (r <= 0) { idx = j; break; }
        }
        picks.push(pool[idx]);
        pool.splice(idx, 1);
      }
      const rows = picks.map((t) => ({
        user_id: u.user_id,
        template_id: t.id,
        assigned_date: today,
        status: "pending",
      }));
      const { error } = await supabase
        .from("user_daily_quests")
        .upsert(rows, { onConflict: "user_id,template_id,assigned_date", ignoreDuplicates: true });
      if (!error) assigned += rows.length;
    }

    const mode = singleUserId ? "single" : "cron";
    await supabase.from("quest_rotate_runs").insert({
      user_id: singleUserId,
      mode,
      assigned_count: assigned,
      users_count: users.length,
      success: true,
    });

    return new Response(JSON.stringify({ success: true, users: users.length, assigned, mode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    try {
      await supabase.from("quest_rotate_runs").insert({
        mode: "cron",
        success: false,
        error_text: String(e),
      });
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
