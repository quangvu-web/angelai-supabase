import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// ADAPTIVE MINT ENGINE v1.0
// FinalMint = clamp(Min, (Base + Contribution + Ecosystem) × DisciplineModulator, Max)
// ============================================================

const ANTI_WHALE_CAP = 0.03; // 3% per user

// Default config fallbacks (used if epoch_config table read fails)
const DEFAULTS = {
  system_stage: { stage: 1, label: 'bootstrap' },
  base_expansion: { base_rate: 500_000, epoch_length_factor: 1.0, stage_factors: { '1': 1.2, '2': 1.0, '3': 0.7 } },
  contribution_weights: { alpha: 0.5, beta: 0.3, gamma: 0.2 },
  ecosystem_weights: { delta: 0.4, epsilon: 0.35, zeta: 0.25 },
  discipline_modulator: { min: 0.80, max: 1.15, weights: { liquidity: 0.3, fraud_pressure: 0.3, claim_efficiency: 0.2, utility_retention: 0.2 } },
  mint_guardrails: { min_epoch_mint: 100_000, max_epoch_mint: 5_000_000, per_user_max_ratio: 0.03 },
  allocation_buckets: { user_reward: 0.70, ecosystem: 0.12, treasury: 0.10, strategic_growth: 0.05, resilience_reserve: 0.03 },
  normalization: { light_score: 'log', contribution_value: 'sqrt', scale_factor: 1000 },
};

// ============================================================
// HELPER: Load config from epoch_config table
// ============================================================
async function loadConfig(supabase: ReturnType<typeof createClient>): Promise<Record<string, unknown>> {
  const config: Record<string, unknown> = { ...DEFAULTS };
  try {
    const { data } = await supabase.from('epoch_config').select('config_key, config_value');
    if (data) {
      for (const row of data) {
        config[row.config_key] = row.config_value;
      }
    }
  } catch (e) {
    console.warn('[AdaptiveMint] Failed to load epoch_config, using defaults:', e);
  }
  return config;
}

// ============================================================
// HELPER: Nonlinear normalization
// ============================================================
function normalize(value: number, method: string, scaleFactor: number): number {
  if (value <= 0) return 0;
  if (method === 'log') return Math.log(1 + value) * scaleFactor;
  if (method === 'sqrt') return Math.sqrt(1 + value) * scaleFactor;
  return value; // linear fallback
}

// ============================================================
// HELPER: Compute DisciplineModulator
// ============================================================
function computeDisciplineModulator(
  metrics: { locked_ratio: number; fraud_pressure: number; claim_efficiency: number; utility_retention: number },
  config: { min: number; max: number; weights: Record<string, number> },
): number {
  // Each sub-score is 0-1 where 1 = ideal
  // locked_ratio: higher = more disciplined → good
  // fraud_pressure: lower = better → invert
  // claim_efficiency: higher = people actually use claims → good
  // utility_retention: higher = FUN stays in ecosystem → good

  const w = config.weights;
  const raw =
    (metrics.locked_ratio * (w.liquidity || 0.3)) +
    ((1 - metrics.fraud_pressure) * (w.fraud_pressure || 0.3)) +
    (metrics.claim_efficiency * (w.claim_efficiency || 0.2)) +
    (metrics.utility_retention * (w.utility_retention || 0.2));

  // Map raw score (0-1) to modulator range
  const range = config.max - config.min;
  return Math.max(config.min, Math.min(config.max, config.min + raw * range));
}

// ============================================================
// HELPER: Gather ecosystem metrics from DB
// ============================================================
async function gatherEcosystemMetrics(
  supabase: ReturnType<typeof createClient>,
  epochStart: string,
  epochEnd: string,
) {
  // 1. Active quality users (users with daily_light_score > 0 on at least 3 distinct days)
  const { data: activeData } = await supabase
    .from('features_user_day')
    .select('user_id, date')
    .gte('date', epochStart)
    .lte('date', epochEnd)
    .gt('daily_light_score', 0);

  const userDayCount = new Map<string, number>();
  for (const row of activeData || []) {
    userDayCount.set(row.user_id, (userDayCount.get(row.user_id) || 0) + 1);
  }
  const activeQualityUsers = [...userDayCount.values()].filter(d => d >= 3).length;

  // 2. Ecosystem usage index: count of distinct action types used
  const { data: actionTypes } = await supabase
    .from('pplp_actions')
    .select('action_type')
    .gte('created_at', epochStart)
    .lte('created_at', epochEnd);

  const uniqueActionTypes = new Set((actionTypes || []).map(a => a.action_type));
  const utilityDiversityIndex = Math.min(uniqueActionTypes.size / 30, 1.0); // Normalize to 0-1 (30 action types max)

  // 3. Usage index: total scored actions / expected baseline
  const totalActions = (actionTypes || []).length;
  const usageIndex = Math.min(totalActions / 10000, 1.0); // Normalize: 10k actions = 1.0

  return { activeQualityUsers, utilityDiversityIndex, usageIndex };
}

// ============================================================
// HELPER: Gather discipline metrics
// ============================================================
async function gatherDisciplineMetrics(
  supabase: ReturnType<typeof createClient>,
) {
  // Locked ratio: how much FUN is still locked vs total minted
  const { data: mintReqs } = await supabase
    .from('pplp_mint_requests')
    .select('amount, status');

  let totalMinted = 0;
  let totalLocked = 0;
  for (const r of mintReqs || []) {
    const amt = r.amount || 0;
    if (r.status === 'minted' || r.status === 'confirmed') totalMinted += amt;
    if (['pending', 'pending_sig', 'signed', 'approved'].includes(r.status)) totalLocked += amt;
  }
  const locked_ratio = (totalMinted + totalLocked) > 0 ? totalLocked / (totalMinted + totalLocked) : 0.5;

  // Fraud pressure: ratio of flagged users
  const { count: totalAlerts } = await supabase
    .from('fraud_alerts')
    .select('*', { count: 'exact', head: true })
    .eq('is_reviewed', false);

  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const fraud_pressure = (totalUsers || 1) > 0 ? Math.min((totalAlerts || 0) / (totalUsers || 1), 1.0) : 0;

  // Claim efficiency: ratio of claimed/used vs total allocated
  const claim_efficiency = totalMinted > 0 ? Math.min(totalMinted / (totalMinted + totalLocked + 1), 1.0) : 0.5;

  // Utility retention: approximated by ratio of users who stayed active after claiming
  const utility_retention = 0.7; // TODO: compute from actual data in future iterations

  return { locked_ratio, fraud_pressure, claim_efficiency, utility_retention };
}

// ============================================================
// HELPER: Compute service impact score (pillar-based)
// ============================================================
async function computeServiceImpactScore(
  supabase: ReturnType<typeof createClient>,
  epochStart: string,
  epochEnd: string,
): Promise<number> {
  // Sum of service-related pillar scores from pplp_scores
  const { data } = await supabase
    .from('pplp_scores')
    .select('pillar_service, pillar_helping, pillar_giving')
    .gte('created_at', epochStart)
    .lte('created_at', epochEnd);

  let total = 0;
  for (const row of data || []) {
    total += (row.pillar_service || 0) + (row.pillar_helping || 0) + (row.pillar_giving || 0);
  }
  return total;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller: allow service role (internal cron / pplp-epoch-reset) OR admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Parse target period
    let cycleId: string | null = null;
    try {
      const body = await req.json();
      cycleId = body.cycle_id || null;
    } catch { /* no body */ }

    // Get the cycle to allocate
    let cycle: Record<string, unknown> | null = null;
    if (cycleId) {
      const { data } = await supabase
        .from('pplp_mint_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();
      cycle = data;
    } else {
      const { data } = await supabase
        .from('pplp_mint_cycles')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      cycle = data;
    }

    if (!cycle) {
      return new Response(JSON.stringify({ error: 'No cycle found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const epochStart = (cycle.start_date as string).split('T')[0];
    const epochEnd = (cycle.end_date as string).split('T')[0];
    const period = epochStart.substring(0, 7);

    console.log(`[AdaptiveMint] Processing cycle #${cycle.cycle_number} (${period})`);

    // ===== LOAD CONFIG =====
    const config = await loadConfig(supabase);
    const stageConfig = config.system_stage as typeof DEFAULTS.system_stage;
    const baseConfig = config.base_expansion as typeof DEFAULTS.base_expansion;
    const contribWeights = config.contribution_weights as typeof DEFAULTS.contribution_weights;
    const ecoWeights = config.ecosystem_weights as typeof DEFAULTS.ecosystem_weights;
    const discConfig = config.discipline_modulator as typeof DEFAULTS.discipline_modulator;
    const guardrails = config.mint_guardrails as typeof DEFAULTS.mint_guardrails;
    const buckets = config.allocation_buckets as typeof DEFAULTS.allocation_buckets;
    const normConfig = config.normalization as typeof DEFAULTS.normalization;

    // ========== STEP 1: Aggregate Light Scores (v2.5: prefer user_light_scores) ==========
    // Try user_light_scores first (v2.5 3-layer), fallback to features_user_day
    const { data: lightScoreUsers } = await supabase
      .from('user_light_scores')
      .select('user_id, total_light_raw')
      .gt('total_light_raw', 0);

    const userScores = new Map<string, number>();
    let totalLight = 0;

    if (lightScoreUsers && lightScoreUsers.length > 0) {
      // v2.5 path: use 3-layer total_light_raw
      for (const row of lightScoreUsers) {
        const score = row.total_light_raw || 0;
        if (score > 0) {
          userScores.set(row.user_id, score);
          totalLight += score;
        }
      }
      console.log(`[AdaptiveMint] Using v2.5 user_light_scores: ${userScores.size} users, total light: ${totalLight}`);
    } else {
      // Fallback: legacy features_user_day
      const { data: dailyScores, error: scoreErr } = await supabase
        .from('features_user_day')
        .select('user_id, daily_light_score')
        .gte('date', epochStart)
        .lte('date', epochEnd)
        .gt('daily_light_score', 0);

      if (scoreErr) throw scoreErr;

      if (!dailyScores || dailyScores.length === 0) {
        await supabase.from('pplp_mint_cycles').update({
          status: 'distributed', total_mint_pool: 0, total_light_contribution: 0,
          updated_at: new Date().toISOString(),
        }).eq('id', cycle.id);

        return new Response(JSON.stringify({
          success: true, message: 'No contributions in this epoch', allocated_users: 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      for (const row of dailyScores) {
        const score = row.daily_light_score || 0;
        userScores.set(row.user_id, (userScores.get(row.user_id) || 0) + score);
        totalLight += score;
      }
      console.log(`[AdaptiveMint] Fallback features_user_day: ${userScores.size} users, total light: ${totalLight}`);
    }

    if (userScores.size === 0) {
      await supabase.from('pplp_mint_cycles').update({
        status: 'distributed', total_mint_pool: 0, total_light_contribution: 0,
        updated_at: new Date().toISOString(),
      }).eq('id', cycle.id);

      return new Response(JSON.stringify({
        success: true, message: 'No contributions in this epoch', allocated_users: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ========== STEP 2: ADAPTIVE MINT CALCULATION ==========

    // 2A. Base Expansion
    const stageFactor = (baseConfig.stage_factors as Record<string, number>)[String(stageConfig.stage)] || 1.0;
    const baseExpansion = baseConfig.base_rate * baseConfig.epoch_length_factor * stageFactor;

    console.log(`[AdaptiveMint] BaseExpansion = ${baseConfig.base_rate} × ${baseConfig.epoch_length_factor} × ${stageFactor} = ${baseExpansion}`);

    // 2B. Contribution Expansion
    // Get total verified contribution value (sum of pillar scores)
    const { data: contribData } = await supabase
      .from('pplp_scores')
      .select('pillar_repentance, pillar_gratitude, pillar_service, pillar_helping, pillar_giving')
      .gte('created_at', epochStart)
      .lte('created_at', epochEnd);

    let totalContributionValue = 0;
    for (const row of contribData || []) {
      totalContributionValue +=
        (row.pillar_repentance || 0) + (row.pillar_gratitude || 0) +
        (row.pillar_service || 0) + (row.pillar_helping || 0) + (row.pillar_giving || 0);
    }

    const serviceImpact = await computeServiceImpactScore(supabase, epochStart, epochEnd);

    const normalizedLS = normalize(totalLight, normConfig.light_score, normConfig.scale_factor);
    const normalizedCV = normalize(totalContributionValue, normConfig.contribution_value, normConfig.scale_factor);
    const normalizedSIS = normalize(serviceImpact, 'sqrt', normConfig.scale_factor);

    const contributionExpansion =
      contribWeights.alpha * normalizedLS +
      contribWeights.beta * normalizedCV +
      contribWeights.gamma * normalizedSIS;

    console.log(`[AdaptiveMint] ContributionExpansion = α(${contribWeights.alpha})×${Math.round(normalizedLS)} + β(${contribWeights.beta})×${Math.round(normalizedCV)} + γ(${contribWeights.gamma})×${Math.round(normalizedSIS)} = ${Math.round(contributionExpansion)}`);

    // 2C. Ecosystem Expansion
    const ecoMetrics = await gatherEcosystemMetrics(supabase, epochStart, epochEnd);
    const ecosystemExpansion =
      ecoWeights.delta * ecoMetrics.usageIndex * normConfig.scale_factor +
      ecoWeights.epsilon * ecoMetrics.activeQualityUsers +
      ecoWeights.zeta * ecoMetrics.utilityDiversityIndex * normConfig.scale_factor;

    console.log(`[AdaptiveMint] EcosystemExpansion = δ×usage(${ecoMetrics.usageIndex.toFixed(3)}) + ε×qualityUsers(${ecoMetrics.activeQualityUsers}) + ζ×diversity(${ecoMetrics.utilityDiversityIndex.toFixed(3)}) = ${Math.round(ecosystemExpansion)}`);

    // 2D. Discipline Modulator
    const discMetrics = await gatherDisciplineMetrics(supabase);
    const disciplineModulator = computeDisciplineModulator(discMetrics, discConfig);

    console.log(`[AdaptiveMint] DisciplineModulator = ${disciplineModulator.toFixed(4)} (locked=${discMetrics.locked_ratio.toFixed(3)}, fraud=${discMetrics.fraud_pressure.toFixed(3)}, claim=${discMetrics.claim_efficiency.toFixed(3)}, retention=${discMetrics.utility_retention.toFixed(3)})`);

    // 2E. Final Mint
    const rawMint = (baseExpansion + contributionExpansion + ecosystemExpansion) * disciplineModulator;
    const finalMint = Math.round(
      Math.max(guardrails.min_epoch_mint, Math.min(rawMint, guardrails.max_epoch_mint))
    );

    console.log(`[AdaptiveMint] RawMint = (${Math.round(baseExpansion)} + ${Math.round(contributionExpansion)} + ${Math.round(ecosystemExpansion)}) × ${disciplineModulator.toFixed(4)} = ${Math.round(rawMint)}`);
    console.log(`[AdaptiveMint] FinalMint = clamp(${guardrails.min_epoch_mint}, ${Math.round(rawMint)}, ${guardrails.max_epoch_mint}) = ${finalMint}`);

    // ===== LOG EPOCH METRICS =====
    const epochId = `Epoch-${period}`;
    const metricsToLog = [
      { epoch_id: epochId, metric_type: 'base', metric_data: { base_rate: baseConfig.base_rate, epoch_length_factor: baseConfig.epoch_length_factor, stage_factor: stageFactor, result: baseExpansion } },
      { epoch_id: epochId, metric_type: 'contribution', metric_data: { total_light: totalLight, total_contribution_value: totalContributionValue, service_impact: serviceImpact, normalized_ls: normalizedLS, normalized_cv: normalizedCV, normalized_sis: normalizedSIS, alpha: contribWeights.alpha, beta: contribWeights.beta, gamma: contribWeights.gamma, result: contributionExpansion } },
      { epoch_id: epochId, metric_type: 'ecosystem', metric_data: { ...ecoMetrics, delta: ecoWeights.delta, epsilon: ecoWeights.epsilon, zeta: ecoWeights.zeta, result: ecosystemExpansion } },
      { epoch_id: epochId, metric_type: 'discipline', metric_data: { ...discMetrics, modulator: disciplineModulator } },
      { epoch_id: epochId, metric_type: 'final', metric_data: { raw_mint: rawMint, final_mint: finalMint, min: guardrails.min_epoch_mint, max: guardrails.max_epoch_mint, clamped: rawMint !== finalMint } },
    ];
    await supabase.from('epoch_metrics').insert(metricsToLog);

    // ========== STEP 3: Allocation Buckets ==========
    const userRewardPool = Math.round(finalMint * buckets.user_reward);
    const ecosystemPool = Math.round(finalMint * buckets.ecosystem);
    const treasuryPool = Math.round(finalMint * buckets.treasury);
    const strategicPool = Math.round(finalMint * buckets.strategic_growth);
    const resiliencePool = Math.round(finalMint * buckets.resilience_reserve);

    console.log(`[AdaptiveMint] Buckets: UserReward=${userRewardPool}, Ecosystem=${ecosystemPool}, Treasury=${treasuryPool}, Strategic=${strategicPool}, Resilience=${resiliencePool}`);

    // Log bucket allocation as metric
    await supabase.from('epoch_metrics').insert({
      epoch_id: epochId,
      metric_type: 'allocation_buckets',
      metric_data: { user_reward: userRewardPool, ecosystem: ecosystemPool, treasury: treasuryPool, strategic_growth: strategicPool, resilience_reserve: resiliencePool, total: finalMint },
    });

    // ========== STEP 4: Eligibility Check ==========
    const eligibleUsers = new Map<string, number>();
    const ineligibleUsers: Array<{ user_id: string; contribution: number; reason: string }> = [];

    for (const [userId, score] of userScores) {
      const { data: eligibilityResult } = await supabase.rpc('check_mint_eligibility', {
        _user_id: userId,
        _epoch_start: epochStart,
        _epoch_end: epochEnd,
      });

      const eligibility = Array.isArray(eligibilityResult) ? eligibilityResult[0] : eligibilityResult;

      if (eligibility && eligibility.eligible) {
        eligibleUsers.set(userId, score);
      } else {
        ineligibleUsers.push({
          user_id: userId,
          contribution: score,
          reason: eligibility?.reason || 'UNKNOWN',
        });
      }
    }

    let eligibleTotal = 0;
    for (const [, score] of eligibleUsers) {
      eligibleTotal += score;
    }

    console.log(`[AdaptiveMint] Eligible: ${eligibleUsers.size}, Ineligible: ${ineligibleUsers.length}, UserRewardPool: ${userRewardPool}`);

    // ========== STEP 5: Anti-Whale + Allocate from UserRewardPool ==========
    const allocations = applyAntiWhaleCap(eligibleUsers, eligibleTotal, userRewardPool, ANTI_WHALE_CAP);

    // ========== STEP 6: Insert pplp_mint_allocations ==========
    const allocationRecords = [
      ...allocations.map(a => ({
        cycle_id: cycle!.id as string,
        user_id: a.userId,
        user_light_contribution: a.contribution,
        allocation_ratio: a.ratio,
        fun_allocated: a.allocated,
        status: 'pending',
        eligible: true,
        ineligibility_reason: null,
      })),
      ...ineligibleUsers.map(u => ({
        cycle_id: cycle!.id as string,
        user_id: u.user_id,
        user_light_contribution: u.contribution,
        allocation_ratio: 0,
        fun_allocated: 0,
        status: 'ineligible',
        eligible: false,
        ineligibility_reason: u.reason,
      })),
    ];

    if (allocationRecords.length > 0) {
      for (let i = 0; i < allocationRecords.length; i += 200) {
        const chunk = allocationRecords.slice(i, i + 200);
        const { error: allocErr } = await supabase
          .from('pplp_mint_allocations')
          .upsert(chunk, { onConflict: 'cycle_id,user_id' });
        if (allocErr) console.error('[AdaptiveMint] Allocation insert error:', allocErr);
      }
    }

    // ========== STEP 7: Create batch mint requests ==========
    let mintRequestsCreated = 0;
    for (const alloc of allocations) {
      if (alloc.allocated <= 0) continue;

      const { data: wallet } = await supabase
        .from('user_wallet_addresses')
        .select('wallet_address')
        .eq('user_id', alloc.userId)
        .limit(1)
        .maybeSingle();

      const recipientAddress = wallet?.wallet_address || '0x' + '0'.repeat(40);

      // Generate deterministic UUID
      const actionIdBytes = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
          `epoch-mint:${cycle!.id}:${alloc.userId}`
        ))
      );
      const hex = Array.from(actionIdBytes.slice(0, 16))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const deterministicUuid = [
        hex.slice(0, 8),
        hex.slice(8, 12),
        '4' + hex.slice(13, 16),
        ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
        hex.slice(20, 32),
      ].join('-');

      const actionHash = '0x' + Array.from(
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode('FUN_EPOCH_REWARD'))
        )
      ).map(b => b.toString(16).padStart(2, '0')).join('');

      const evidenceHash = '0x' + Array.from(
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
            `epoch:${period}:user:${alloc.userId}:light:${alloc.contribution}`
          ))
        )
      ).map(b => b.toString(16).padStart(2, '0')).join('');

      // Ensure pplp_actions record exists
      const { error: actionErr } = await supabase
        .from('pplp_actions')
        .upsert({
          id: deterministicUuid,
          platform_id: 'angel_ai',
          action_type: 'epoch_mint_reward',
          actor_id: alloc.userId,
          metadata: {
            cycle_id: cycle!.id,
            period,
            light_contribution: alloc.contribution,
            mint_engine: 'adaptive_v1',
            final_mint: finalMint,
            user_reward_pool: userRewardPool,
          },
          status: 'scored',
          evidence_hash: evidenceHash,
          policy_version: '1.0.0',
          scored_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (actionErr) {
        console.error(`[AdaptiveMint] Action insert error for ${alloc.userId}:`, actionErr);
        continue;
      }

      // Create mint request
      const { error: mrErr } = await supabase
        .from('pplp_mint_requests')
        .upsert({
          action_id: deterministicUuid,
          actor_id: alloc.userId,
          recipient_address: recipientAddress,
          amount: alloc.allocated,
          action_hash: actionHash,
          evidence_hash: evidenceHash,
          policy_version: 1,
          nonce: 0,
          status: 'pending',
          signature: null,
          signer_address: null,
          tx_hash: null,
          minted_at: null,
        }, { onConflict: 'action_id' });

      if (mrErr) {
        console.error(`[AdaptiveMint] Mint request error for ${alloc.userId}:`, mrErr);
      } else {
        mintRequestsCreated++;
      }
    }

    // ========== STEP 8: Create Vesting Schedules (15% instant, 85% locked) ==========
    const vestingConfig = config.vesting_params as typeof DEFAULTS.vesting_params;
    const instantPortion = vestingConfig?.instant_portion ?? 0.15;
    const lockedPortion = vestingConfig?.locked_portion ?? 0.85;
    const baseVestingDays = vestingConfig?.base_vesting_days ?? 28;
    const unlockInterval = vestingConfig?.unlock_check_interval_days ?? 7;

    let vestingCreated = 0;
    const vestingRecords = allocations
      .filter(a => a.allocated > 0)
      .map(a => ({
        user_id: a.userId,
        epoch_id: epochId,
        cycle_id: cycle!.id as string,
        total_amount: a.allocated,
        instant_amount: Math.round(a.allocated * instantPortion),
        locked_amount: Math.round(a.allocated * lockedPortion),
        claimable_amount: Math.round(a.allocated * instantPortion), // instant portion is immediately claimable
        status: 'active',
        base_vesting_days: baseVestingDays,
        unlock_check_interval_days: unlockInterval,
        next_unlock_at: new Date(Date.now() + unlockInterval * 24 * 60 * 60 * 1000).toISOString(),
      }));

    // Batch insert vesting schedules
    for (let i = 0; i < vestingRecords.length; i += 200) {
      const chunk = vestingRecords.slice(i, i + 200);
      const { error: vestErr } = await supabase
        .from('reward_vesting_schedules')
        .upsert(chunk, { onConflict: 'user_id,epoch_id' });
      if (vestErr) {
        console.error('[AdaptiveMint] Vesting insert error:', vestErr);
      } else {
        vestingCreated += chunk.length;
      }
    }

    console.log(`[AdaptiveMint] Created ${vestingCreated} vesting schedules (${Math.round(instantPortion * 100)}% instant, ${Math.round(lockedPortion * 100)}% locked)`);

    // ========== STEP 9: Route Treasury Flows ==========
    const treasuryFlows = [
      { destination_vault: 'reward_reserve', amount: ecosystemPool, reason: 'Epoch ecosystem pool allocation' },
      { destination_vault: 'infrastructure', amount: Math.round(treasuryPool * 0.5), reason: 'Epoch treasury → infrastructure' },
      { destination_vault: 'community_growth', amount: Math.round(treasuryPool * 0.5), reason: 'Epoch treasury → community growth' },
      { destination_vault: 'strategic', amount: strategicPool, reason: 'Epoch strategic growth allocation' },
      { destination_vault: 'stability', amount: resiliencePool, reason: 'Epoch resilience reserve allocation' },
    ].filter(f => f.amount > 0);

    for (const flow of treasuryFlows) {
      await supabase.from('treasury_flows').insert({
        source_vault: 'mint',
        destination_vault: flow.destination_vault,
        amount: flow.amount,
        reason: flow.reason,
        epoch_id: epochId,
        metadata: { cycle_id: cycle!.id, final_mint: finalMint },
      });

      // Update vault balance
      const { data: vault } = await supabase
        .from('treasury_vaults')
        .select('balance')
        .eq('vault_name', flow.destination_vault)
        .single();

      if (vault) {
        await supabase.from('treasury_vaults').update({
          balance: (vault.balance || 0) + flow.amount,
        }).eq('vault_name', flow.destination_vault);
      }
    }

    console.log(`[AdaptiveMint] Routed ${treasuryFlows.length} treasury flows totaling ${treasuryFlows.reduce((s, f) => s + f.amount, 0)} FUN`);

    // ========== STEP 10: Update cycle status ==========
    await supabase.from('pplp_mint_cycles').update({
      status: 'distributed',
      total_mint_pool: finalMint,
      total_light_contribution: eligibleTotal,
      updated_at: new Date().toISOString(),
    }).eq('id', cycle.id);

    // ========== STEP 11: Transparency Snapshot ==========
    const { data: rule } = await supabase
      .from('scoring_rules')
      .select('rule_version')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const { count: mentorChains } = await supabase
      .from('pplp_behavior_sequences')
      .select('*', { count: 'exact', head: true })
      .eq('sequence_type', 'mentorship')
      .eq('status', 'completed')
      .gte('completed_at', cycle.start_date as string)
      .lte('completed_at', cycle.end_date as string);

    const { count: valueLoops } = await supabase
      .from('pplp_behavior_sequences')
      .select('*', { count: 'exact', head: true })
      .eq('sequence_type', 'value_creation')
      .eq('status', 'completed')
      .gte('completed_at', cycle.start_date as string)
      .lte('completed_at', cycle.end_date as string);

    await supabase.from('transparency_snapshots').insert({
      epoch_id: epochId,
      total_light_system: eligibleTotal,
      total_fun_minted: finalMint,
      allocation_by_level: computeLevelBreakdown(allocations),
      mentor_chains_completed: mentorChains || 0,
      value_loops_completed: valueLoops || 0,
      active_users: allocations.length,
      rule_version: rule?.rule_version || 'LS-Math-v1.0',
    });

    const result = {
      success: true,
      engine: 'adaptive_v1',
      cycle_id: cycle.id,
      cycle_number: cycle.cycle_number,
      period,
      mint_calculation: {
        base_expansion: Math.round(baseExpansion),
        contribution_expansion: Math.round(contributionExpansion),
        ecosystem_expansion: Math.round(ecosystemExpansion),
        discipline_modulator: Math.round(disciplineModulator * 10000) / 10000,
        raw_mint: Math.round(rawMint),
        final_mint: finalMint,
      },
      allocation_buckets: {
        user_reward: userRewardPool,
        ecosystem: ecosystemPool,
        treasury: treasuryPool,
        strategic_growth: strategicPool,
        resilience_reserve: resiliencePool,
      },
      vesting: {
        schedules_created: vestingCreated,
        instant_portion: `${Math.round(instantPortion * 100)}%`,
        locked_portion: `${Math.round(lockedPortion * 100)}%`,
        base_vesting_days: baseVestingDays,
        unlock_interval_days: unlockInterval,
      },
      treasury_flows: treasuryFlows.map(f => ({ vault: f.destination_vault, amount: f.amount })),
      total_light: eligibleTotal,
      eligible_users: allocations.length,
      ineligible_users: ineligibleUsers.length,
      mint_requests_created: mintRequestsCreated,
      anti_whale_cap: ANTI_WHALE_CAP,
      top_allocations: allocations
        .sort((a, b) => b.allocated - a.allocated)
        .slice(0, 10)
        .map(a => ({ user_id: a.userId, fun: a.allocated, ratio: a.ratio })),
    };

    console.log(`[AdaptiveMint] Done: ${mintRequestsCreated} mint requests, FinalMint=${finalMint} FUN (Base=${Math.round(baseExpansion)} + Contrib=${Math.round(contributionExpansion)} + Eco=${Math.round(ecosystemExpansion)}) × Disc=${disciplineModulator.toFixed(4)}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AdaptiveMint] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ========== Anti-Whale Cap with Iterative Redistribution ==========
function applyAntiWhaleCap(
  userScores: Map<string, number>,
  totalContribution: number,
  mintPool: number,
  maxShare: number,
): Array<{ userId: string; contribution: number; ratio: number; allocated: number }> {
  if (totalContribution <= 0 || mintPool <= 0) return [];

  const shares = new Map<string, number>();
  const capped = new Set<string>();

  for (const [userId, score] of userScores) {
    shares.set(userId, score / totalContribution);
  }

  for (let iter = 0; iter < 10; iter++) {
    let excess = 0;
    let uncappedTotal = 0;

    for (const [userId, share] of shares) {
      if (capped.has(userId)) continue;
      if (share > maxShare) {
        excess += (share - maxShare) * mintPool;
        shares.set(userId, maxShare);
        capped.add(userId);
      } else {
        uncappedTotal += userScores.get(userId) || 0;
      }
    }

    if (excess <= 0) break;

    for (const [userId] of shares) {
      if (capped.has(userId)) continue;
      const contribution = userScores.get(userId) || 0;
      const bonus = uncappedTotal > 0 ? (contribution / uncappedTotal) * excess / mintPool : 0;
      shares.set(userId, (shares.get(userId) || 0) + bonus);
    }
  }

  const result: Array<{ userId: string; contribution: number; ratio: number; allocated: number }> = [];
  for (const [userId, share] of shares) {
    const allocated = Math.floor(mintPool * share);
    if (allocated > 0) {
      result.push({
        userId,
        contribution: userScores.get(userId) || 0,
        ratio: Math.round(share * 10000) / 10000,
        allocated,
      });
    }
  }

  return result;
}

// ========== Compute allocation breakdown by light level ==========
function computeLevelBreakdown(
  allocations: Array<{ contribution: number; allocated: number }>,
): Record<string, number> {
  const levels = { seed: 0, contributor: 0, builder: 0, guardian: 0, architect: 0 };
  for (const a of allocations) {
    if (a.contribution >= 2000) levels.architect += a.allocated;
    else if (a.contribution >= 1000) levels.guardian += a.allocated;
    else if (a.contribution >= 500) levels.builder += a.allocated;
    else if (a.contribution >= 200) levels.contributor += a.allocated;
    else levels.seed += a.allocated;
  }
  return levels;
}
