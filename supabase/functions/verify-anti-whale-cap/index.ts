// Verify Anti-Whale Cap (3% of userRewardPool) for mint cycles
// - GET: returns reports for matching cycles
// - POST { persist: true }: also writes report rows to anti_whale_cap_reports
// Used by admin UI + monthly cron (1st of month, 02:00 UTC)
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const USER_REWARD_RATIO = 0.70;
const EXPECTED_CAP_RATIO = 0.03;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    let cycleId = url.searchParams.get("cycle_id");
    let month = url.searchParams.get("month");
    let persist = url.searchParams.get("persist") === "true";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        cycleId = body.cycle_id ?? cycleId;
        month = body.month ?? month;
        persist = body.persist ?? persist;
      } catch (_) { /* no body */ }
    }

    // Default for monthly cron: previous month (cron runs 02:00 on day 1).
    if (!cycleId && !month) {
      const now = new Date();
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      month = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
    }

    let query = supabase.from("pplp_mint_cycles").select("*");
    if (cycleId) {
      query = query.eq("id", cycleId);
    } else if (month) {
      const [y, m] = month.split("-").map(Number);
      const nextMonth = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      query = query.gte("start_date", `${month}-01`).lt("start_date", nextMonth);
    }

    const { data: cycles, error } = await query.order("start_date", { ascending: false }).limit(5);
    if (error) throw error;
    if (!cycles?.length) {
      return new Response(JSON.stringify({ error: "No cycle found", persisted: 0 }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reports = cycles.map((c: any) => {
      const totalPool = Number(c.total_mint_pool);
      const userRewardPool = totalPool * USER_REWARD_RATIO;
      const expectedCapPerUser = userRewardPool * EXPECTED_CAP_RATIO;
      const configuredCapRatio = Number(c.max_share_per_user);
      const ratioMatch = Math.abs(configuredCapRatio - EXPECTED_CAP_RATIO) < 1e-9;
      const pctOfTotal = (expectedCapPerUser / totalPool) * 100;

      return {
        cycle_id: c.id,
        cycle_number: c.cycle_number,
        period: `${c.start_date} → ${c.end_date}`,
        status: c.status,
        total_pool: totalPool,
        breakdown: {
          user_reward_pool_70pct: userRewardPool,
          ecosystem_12pct: totalPool * 0.12,
          treasury_10pct: totalPool * 0.10,
          strategic_5pct: totalPool * 0.05,
          resilience_3pct: totalPool * 0.03,
        },
        anti_whale_cap: {
          configured_ratio: configuredCapRatio,
          expected_ratio: EXPECTED_CAP_RATIO,
          ratio_match: ratioMatch,
          applied_to: "userRewardPool (70% of total)",
          max_fun_per_user: expectedCapPerUser,
          max_fun_per_user_formatted: expectedCapPerUser.toLocaleString("en-US"),
          pct_of_total_pool: pctOfTotal.toFixed(2) + "%",
        },
        verification: ratioMatch ? "PASS ✓" : "FAIL ✗ — configured ratio diverges from 3% rule",
      };
    });

    let persisted = 0;
    let skipped_existing = 0;
    if (persist) {
      // Skip cycles that already have a report (idempotent).
      const cycleIds = reports.map((r) => r.cycle_id);
      const { data: existing } = await supabase
        .from("anti_whale_cap_reports")
        .select("cycle_id")
        .in("cycle_id", cycleIds);
      const existingSet = new Set((existing || []).map((e: any) => e.cycle_id));
      const newReports = reports.filter((r) => !existingSet.has(r.cycle_id));
      skipped_existing = reports.length - newReports.length;

      if (newReports.length > 0) {
        const rows = newReports.map((r) => ({
          cycle_id: r.cycle_id,
          cycle_number: r.cycle_number,
          period: r.period,
          status: r.status,
          total_pool: r.total_pool,
          user_reward_pool: r.breakdown.user_reward_pool_70pct,
          configured_ratio: r.anti_whale_cap.configured_ratio,
          expected_ratio: r.anti_whale_cap.expected_ratio,
          max_fun_per_user: r.anti_whale_cap.max_fun_per_user,
          pct_of_total_pool: parseFloat(r.anti_whale_cap.pct_of_total_pool),
          ratio_match: r.anti_whale_cap.ratio_match,
          verification: r.verification,
          raw_report: r,
        }));
        const { error: insErr, count } = await supabase
          .from("anti_whale_cap_reports")
          .insert(rows, { count: "exact" });
        if (insErr) console.error("[verify-anti-whale-cap] insert error:", insErr);
        else persisted = count ?? rows.length;
      }
    }

    return new Response(
      JSON.stringify({ reports, persisted, skipped_existing, generated_at: new Date().toISOString() }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
