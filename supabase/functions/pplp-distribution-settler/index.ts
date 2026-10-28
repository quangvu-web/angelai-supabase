// PPLP Distribution Settler
// Processes pending fun_distribution_logs by crediting platform/genesis/partners shares
// into treasury_vaults and marking the log as 'settled'.
//
// Mapping:
//   platform_amount  -> infrastructure vault
//   genesis_amount   -> reward_reserve vault (Founder/Genesis pool)
//   partners_amount  -> community_growth vault (Partner & community programs)
//   user_amount      -> already credited via pplp_mint_requests (no-op here)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAULT_MAPPING = {
  platform_amount: "infrastructure",
  genesis_amount: "reward_reserve",
  partners_amount: "community_growth",
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let batchSize = 500;
    let dryRun = false;
    try {
      const body = await req.json();
      batchSize = Number(body?.batch_size) || 500;
      dryRun = !!body?.dry_run;
    } catch { /* default */ }

    console.log(`[Settler] start | batch_size=${batchSize} | dry_run=${dryRun}`);

    // Load vault IDs once
    const { data: vaults, error: vaultsErr } = await supabase
      .from("treasury_vaults")
      .select("id, vault_name, balance");
    if (vaultsErr) throw vaultsErr;
    const vaultMap = new Map<string, { id: string; balance: number }>();
    for (const v of vaults || []) {
      vaultMap.set(v.vault_name, { id: v.id, balance: Number(v.balance) || 0 });
    }

    // Fetch pending logs in chronological order
    const { data: logs, error: fetchErr } = await supabase
      .from("fun_distribution_logs")
      .select("id, actor_id, total_reward, user_amount, genesis_amount, platform_amount, partners_amount, mint_request_id")
      .eq("fund_processing_status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (fetchErr) throw fetchErr;

    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No pending logs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate amounts per vault to minimize updates
    const vaultDeltas: Record<string, number> = {
      infrastructure: 0,
      reward_reserve: 0,
      community_growth: 0,
    };
    const settledIds: string[] = [];
    let totalSettledFun = 0;

    for (const log of logs) {
      vaultDeltas.infrastructure += Number(log.platform_amount) || 0;
      vaultDeltas.reward_reserve += Number(log.genesis_amount) || 0;
      vaultDeltas.community_growth += Number(log.partners_amount) || 0;
      totalSettledFun += Number(log.total_reward) || 0;
      settledIds.push(log.id);
    }

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        would_settle: settledIds.length,
        vault_deltas: vaultDeltas,
        total_fun: totalSettledFun,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update vault balances
    const vaultUpdates: Array<{ name: string; new_balance: number; delta: number }> = [];
    for (const [vaultName, delta] of Object.entries(vaultDeltas)) {
      if (delta === 0) continue;
      const vault = vaultMap.get(vaultName);
      if (!vault) {
        console.warn(`[Settler] Vault not found: ${vaultName}`);
        continue;
      }
      const newBalance = vault.balance + delta;
      const { error: updErr } = await supabase
        .from("treasury_vaults")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", vault.id);
      if (updErr) {
        console.error(`[Settler] Failed to update vault ${vaultName}:`, updErr);
        throw updErr;
      }
      vaultUpdates.push({ name: vaultName, new_balance: newBalance, delta });
    }

    // Mark logs as settled
    const { error: markErr } = await supabase
      .from("fun_distribution_logs")
      .update({
        fund_processing_status: "settled",
        fund_processed_at: new Date().toISOString(),
      })
      .in("id", settledIds);
    if (markErr) throw markErr;

    console.log(`[Settler] ✓ Settled ${settledIds.length} logs | vaults updated: ${vaultUpdates.length}`);

    return new Response(JSON.stringify({
      success: true,
      processed: settledIds.length,
      total_fun_settled: totalSettledFun,
      vault_updates: vaultUpdates,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[Settler] Fatal:", err);
    return new Response(JSON.stringify({
      error: "settler_failed",
      details: err?.message || String(err),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
