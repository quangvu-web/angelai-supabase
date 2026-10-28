import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine target period
    const { targetYear, targetMonth } = await parseTargetPeriod(req);

    const periodLabel = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    const periodStart = new Date(targetYear, targetMonth, 1).toISOString();
    const periodEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59).toISOString();

    const newMonth = targetMonth + 1 > 11 ? 0 : targetMonth + 1;
    const newYear = targetMonth + 1 > 11 ? targetYear + 1 : targetYear;
    const newPeriodLabel = `${newYear}-${String(newMonth + 1).padStart(2, '0')}`;
    const newStart = new Date(newYear, newMonth, 1).toISOString();
    const newEnd = new Date(newYear, newMonth + 1, 0, 23, 59, 59).toISOString();

    console.log(`[EpochReset] Finalizing: ${periodLabel}, Opening: ${newPeriodLabel}`);

    // ========== STEP 1: Create mint_epoch record ==========
    const epochId = await createMintEpoch(supabase, periodLabel, periodStart, periodEnd);

    // ========== STEP 2: Finalize light_score_ledger ==========
    const { ledgerCount, userLightScores } = await finalizeLedger(supabase, periodLabel, periodStart, periodEnd);
    console.log(`[EpochReset] Finalized ledger for ${ledgerCount} users`);

    // ========== STEP 3: Write mint_allocations ==========
    if (epochId && Object.keys(userLightScores).length > 0) {
      await writeMintAllocations(supabase, epochId, userLightScores, periodLabel);
    }

    // ========== STEP 4: Reset user_light_totals ==========
    const { error: resetError } = await supabase
      .from('user_light_totals')
      .update({ total_points: 0 })
      .neq('total_points', 0);
    if (resetError) console.error('[EpochReset] Reset error:', resetError);
    else console.log('[EpochReset] Reset total_points to 0');

    // ========== STEP 5: Trigger epoch allocation (Adaptive Mint Engine) ==========
    const { data: openCycle } = await supabase
      .from('pplp_mint_cycles')
      .select('id')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let allocateResult = null;
    if (openCycle) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/pplp-epoch-allocate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ cycle_id: openCycle.id }),
        });
        allocateResult = await resp.json();
        console.log(`[EpochReset] Adaptive allocation result:`, JSON.stringify(allocateResult).slice(0, 500));
      } catch (e) {
        console.error('[EpochReset] Allocation failed (continuing):', e);
      }
    }

    // ========== STEP 5b: Sync adaptive allocation back to legacy mint_epochs + mint_allocations ==========
    if (epochId) {
      await syncAdaptiveToLegacy(supabase, epochId, periodStart, periodEnd);
    }

    // ========== STEP 6: Create mint-layer epoch snapshots ==========
    await createMintEpochSnapshots(supabase, periodStart.split('T')[0], periodEnd.split('T')[0]);

    // ========== STEP 7: Trigger vesting release ==========
    try {
      const vestResp = await fetch(`${supabaseUrl}/functions/v1/pplp-vesting-release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({}),
      });
      const vestResult = await vestResp.json();
      console.log(`[EpochReset] Vesting release result:`, JSON.stringify(vestResult).slice(0, 300));
    } catch (e) {
      console.error('[EpochReset] Vesting release failed:', e);
    }

    // ========== STEP 8: Finalize epoch + cycle rotation ==========
    if (epochId) {
      await supabase.from('mint_epochs')
        .update({ status: 'finalized', finalized_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', epochId);
    }

    await supabase.from('pplp_mint_cycles')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('status', 'open');

    const { data: lastCycle } = await supabase
      .from('pplp_mint_cycles')
      .select('cycle_number')
      .order('cycle_number', { ascending: false })
      .limit(1);

    const nextCycleNumber = (lastCycle && lastCycle.length > 0) ? lastCycle[0].cycle_number + 1 : 1;

    const { error: cycleError } = await supabase
      .from('pplp_mint_cycles')
      .insert({
        cycle_number: nextCycleNumber,
        cycle_type: 'monthly',
        start_date: newStart,
        end_date: newEnd,
        status: 'open',
        total_mint_pool: 0, // Will be computed by adaptive engine
        total_light_contribution: 0,
        max_share_per_user: 0.03,
      });

    if (cycleError) console.error('[EpochReset] Cycle create error:', cycleError);
    else console.log(`[EpochReset] Created cycle #${nextCycleNumber} for ${newPeriodLabel}`);

    // ========== STEP 9: Trigger health check ==========
    try {
      await fetch(`${supabaseUrl}/functions/v1/pplp-epoch-health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ target_date: new Date().toISOString().split('T')[0] }),
      });
      console.log('[EpochReset] Health check triggered');
    } catch (e) {
      console.error('[EpochReset] Health check failed:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      engine: 'adaptive_v1',
      finalized_period: periodLabel,
      new_period: newPeriodLabel,
      ledger_users: ledgerCount,
      new_cycle_number: nextCycleNumber,
      epoch_id: epochId,
      adaptive_allocation: allocateResult ? {
        final_mint: allocateResult.mint_calculation?.final_mint,
        eligible_users: allocateResult.eligible_users,
        vesting_created: allocateResult.vesting?.schedules_created,
      } : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[EpochReset] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================================
// Helper: Parse target period from request
// ============================================================
async function parseTargetPeriod(req: Request): Promise<{ targetYear: number; targetMonth: number }> {
  try {
    const body = await req.json();
    if (body.year && body.month) {
      return { targetYear: body.year, targetMonth: body.month - 1 };
    }
  } catch { /* no body */ }
  const now = new Date();
  return {
    targetYear: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    targetMonth: now.getMonth() === 0 ? 11 : now.getMonth() - 1,
  };
}

// ============================================================
// Helper: Create mint_epoch record
// ============================================================
async function createMintEpoch(
  supabase: ReturnType<typeof createClient>,
  periodLabel: string, periodStart: string, periodEnd: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('mint_epochs')
    .upsert({
      epoch_label: periodLabel,
      period_start: periodStart,
      period_end: periodEnd,
      mint_pool_amount: 0, // Adaptive engine will compute
      status: 'draft',
      rules_version: 'AdaptiveMint-v1.0',
    }, { onConflict: 'epoch_label' })
    .select()
    .single();

  if (error) console.error('[EpochReset] Epoch create error:', error);
  return data?.id || null;
}

// ============================================================
// Helper: Finalize light_score_ledger
// ============================================================
async function finalizeLedger(
  supabase: ReturnType<typeof createClient>,
  periodLabel: string, periodStart: string, periodEnd: string,
) {
  const { data: monthlyData } = await supabase
    .from('features_user_day')
    .select('user_id, daily_light_score, consistency_multiplier, sequence_multiplier, integrity_penalty, reputation_weight')
    .gte('date', periodStart.split('T')[0])
    .lte('date', periodEnd.split('T')[0])
    .gt('daily_light_score', 0);

  let ledgerCount = 0;
  const userLightScores: Record<string, number> = {};

  if (!monthlyData || monthlyData.length === 0) return { ledgerCount, userLightScores };

  const userScores: Record<string, { total: number; count: number; lastCM: number; lastSM: number; lastIP: number; lastRW: number }> = {};
  for (const row of monthlyData) {
    if (!userScores[row.user_id]) {
      userScores[row.user_id] = { total: 0, count: 0, lastCM: 1, lastSM: 1, lastIP: 1, lastRW: 1 };
    }
    userScores[row.user_id].total += row.daily_light_score || 0;
    userScores[row.user_id].count++;
    userScores[row.user_id].lastCM = row.consistency_multiplier || 1;
    userScores[row.user_id].lastSM = row.sequence_multiplier || 1;
    userScores[row.user_id].lastIP = row.integrity_penalty || 1;
    userScores[row.user_id].lastRW = row.reputation_weight || 1;
  }

  for (const userId of Object.keys(userScores)) {
    const us = userScores[userId];
    userLightScores[userId] = Math.round(us.total * 100) / 100;

    let level = 'seed';
    if (us.total >= 2000) level = 'architect';
    else if (us.total >= 1000) level = 'guardian';
    else if (us.total >= 500) level = 'builder';
    else if (us.total >= 200) level = 'contributor';

    let trend = 'stable';
    if (us.count >= 5 && us.total > 50) trend = 'growing';
    else if (us.total < 5) trend = 'reflecting';

    await supabase.from('light_score_ledger').upsert({
      user_id: userId, period: periodLabel, period_start: periodStart, period_end: periodEnd,
      base_score: Math.round(us.total * 100) / 100,
      final_light_score: Math.round(us.total * 100) / 100,
      reputation_weight: us.lastRW, consistency_multiplier: us.lastCM,
      sequence_multiplier: us.lastSM, integrity_penalty: us.lastIP,
      level, trend, rule_version: 'AdaptiveMint-v1.0',
      computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,period' });
    ledgerCount++;
  }

  return { ledgerCount, userLightScores };
}

// ============================================================
// Helper: Write mint_allocations (legacy table)
// ============================================================
async function writeMintAllocations(
  supabase: ReturnType<typeof createClient>,
  epochId: string, userLightScores: Record<string, number>, periodLabel: string,
) {
  const totalLight = Object.values(userLightScores).reduce((a, b) => a + b, 0);
  const allocations = Object.entries(userLightScores).map(([userId, score]) => ({
    epoch_id: epochId,
    user_id: userId,
    eligible: score >= 10,
    light_score: score,
    contribution_ratio: totalLight > 0 ? Math.round((score / totalLight) * 10000) / 10000 : 0,
    allocation_amount: 0, // Actual allocation done by adaptive engine
    reason_codes: score >= 10 ? ['ELIGIBLE'] : ['BELOW_LMIN'],
  }));

  for (let i = 0; i < allocations.length; i += 100) {
    const chunk = allocations.slice(i, i + 100);
    const { error } = await supabase.from('mint_allocations').upsert(chunk, { onConflict: 'epoch_id,user_id' });
    if (error) console.error('[EpochReset] mint_allocations error:', error);
  }
  console.log(`[EpochReset] Wrote ${allocations.length} mint_allocations for ${periodLabel}`);
}

// ============================================================
// Helper: Create mint-layer epoch snapshots
// ============================================================
async function createMintEpochSnapshots(
  supabase: ReturnType<typeof createClient>,
  startDate: string, endDate: string,
) {
  const epochId = `mint-${startDate}-to-${endDate}`;
  console.log(`[EpochReset] Creating mint snapshots: ${startDate} → ${endDate}`);

  const { data: userData } = await supabase
    .from('features_user_day')
    .select('user_id, daily_light_score, timing_adjusted_score, burst_penalty, late_window_weight, cross_window_bonus, consistency_multiplier, integrity_penalty')
    .gte('date', startDate)
    .lte('date', endDate)
    .gt('daily_light_score', 0);

  if (!userData || userData.length === 0) return;

  const userAgg = new Map<string, { rawCount: number; score: number; timingScore: number; avgBurst: number; avgLate: number; avgCross: number; avgTrust: number; avgFraud: number }>();

  for (const row of userData) {
    const prev = userAgg.get(row.user_id) || { rawCount: 0, score: 0, timingScore: 0, avgBurst: 0, avgLate: 0, avgCross: 0, avgTrust: 0, avgFraud: 0 };
    prev.rawCount++;
    prev.score += row.daily_light_score || 0;
    prev.timingScore += row.timing_adjusted_score || row.daily_light_score || 0;
    prev.avgBurst += row.burst_penalty || 1;
    prev.avgLate += row.late_window_weight || 1;
    prev.avgCross += row.cross_window_bonus || 1;
    prev.avgTrust += row.consistency_multiplier || 1;
    prev.avgFraud += row.integrity_penalty ? (1 - (row.integrity_penalty || 1)) : 0;
    userAgg.set(row.user_id, prev);
  }

  // Get vesting data for each user
  const snapshots = await Promise.all([...userAgg.entries()].map(async ([userId, agg]) => {
    const { data: vesting } = await supabase
      .from('reward_vesting_schedules')
      .select('instant_amount, locked_amount')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      user_id: userId,
      epoch_id: epochId,
      epoch_type: 'mint',
      window_start: startDate,
      window_end: endDate,
      raw_activity_count: agg.rawCount,
      deduped_activity_count: agg.rawCount,
      finalized_score: Math.round(agg.score * 100) / 100,
      preview_score: 0,
      validated_score: 0,
      trust_factor: Math.round((agg.avgTrust / agg.rawCount) * 1000) / 1000,
      fraud_factor: Math.round((agg.avgFraud / agg.rawCount) * 1000) / 1000,
      burst_penalty: Math.round((agg.avgBurst / agg.rawCount) * 1000) / 1000,
      late_window_suppression: Math.round((agg.avgLate / agg.rawCount) * 1000) / 1000,
      cross_window_bonus: Math.round((agg.avgCross / agg.rawCount) * 1000) / 1000,
      timing_adjusted_score: Math.round(agg.timingScore * 100) / 100,
      instant_amount: vesting?.instant_amount || 0,
      locked_amount: vesting?.locked_amount || 0,
      updated_at: new Date().toISOString(),
    };
  }));

  for (let i = 0; i < snapshots.length; i += 100) {
    const batch = snapshots.slice(i, i + 100);
    const { error } = await supabase.from('epoch_snapshots').upsert(batch, { onConflict: 'user_id,epoch_id,epoch_type' });
    if (error) console.error(`[EpochReset] Snapshot error (batch ${i}):`, error);
  }
  console.log(`[EpochReset] Created ${snapshots.length} mint snapshots`);
}

// ============================================================
// Helper: Sync adaptive allocation → legacy mint_epochs + mint_allocations
// Bridges the two-layer epoch system so legacy tables reflect adaptive engine output.
// ============================================================
async function syncAdaptiveToLegacy(
  supabase: ReturnType<typeof createClient>,
  epochId: string,
  periodStart: string,
  periodEnd: string,
) {
  // Find adaptive cycle that overlaps this period
  const startDate = periodStart.split('T')[0];
  const endDate = periodEnd.split('T')[0];

  const { data: cycle } = await supabase
    .from('pplp_mint_cycles')
    .select('id, total_mint_pool, total_light_contribution')
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cycle) {
    console.log('[EpochReset] No adaptive cycle found for sync');
    return;
  }

  // Pull adaptive allocations for this cycle
  const { data: adaptiveAllocs } = await supabase
    .from('pplp_mint_allocations')
    .select('user_id, fun_allocated, user_light_contribution, allocation_ratio, eligible')
    .eq('cycle_id', cycle.id);

  const allocs = adaptiveAllocs || [];
  const userCount = allocs.filter((a: any) => a.eligible !== false && Number(a.fun_allocated) > 0).length;
  const totalLight = Number(cycle.total_light_contribution) || 0;
  const mintPool = Number(cycle.total_mint_pool) || 0;

  // 1. Sync mint_epochs aggregate fields
  await supabase.from('mint_epochs')
    .update({
      mint_pool_amount: mintPool,
      total_light: totalLight,
      user_count: userCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', epochId);

  // 2. Sync per-user allocation_amount + contribution_ratio into mint_allocations
  if (allocs.length > 0) {
    const updates = allocs.map((a: any) => ({
      epoch_id: epochId,
      user_id: a.user_id,
      eligible: a.eligible !== false && Number(a.fun_allocated) > 0,
      light_score: Number(a.user_light_contribution) || 0,
      contribution_ratio: Number(a.allocation_ratio) || 0,
      allocation_amount: Number(a.fun_allocated) || 0,
      reason_codes: (a.eligible !== false && Number(a.fun_allocated) > 0) ? ['ELIGIBLE'] : ['INELIGIBLE'],
    }));

    for (let i = 0; i < updates.length; i += 100) {
      const chunk = updates.slice(i, i + 100);
      const { error } = await supabase
        .from('mint_allocations')
        .upsert(chunk, { onConflict: 'epoch_id,user_id' });
      if (error) console.error('[EpochReset] sync mint_allocations error:', error);
    }
  }

  console.log(`[EpochReset] Synced adaptive → legacy: pool=${mintPool}, users=${userCount}, light=${totalLight}, allocs=${allocs.length}`);
}
