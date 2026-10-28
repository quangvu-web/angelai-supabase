import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// PRD v1.0 — Multiplicative formula config
// RawLightScore = (S × T × H × V × U) / 10^4
// FinalLightScore = Raw × ImpactWeight × TrustMultiplier × ConsistencyMultiplier
const CONFIG = {
  reputation: { alpha: 0.25, w_min: 0.5, w_max: 2.0 },
  consistency: { beta: 0.6, lambda: 30 },
  sequence: { eta: 0.5, kappa: 5 },
  penalty: { theta: 0.8, max_penalty: 0.5 },
};

// Action weights for base_action_score
const ACTION_WEIGHTS = {
  posts: 15, comments: 8, questions: 10,
  journals: 12, logins: 5, help: 20,
};

// Content type multipliers
const TYPE_MULTIPLIER: Record<string, number> = {
  POST_CREATE: 1.0, ANALYSIS_POST: 1.5, SHARE_CONTENT: 0.5,
  COMMENT_CREATE: 0.3, QUESTION_ASK: 0.8, post: 1.0, comment: 0.6,
};

// Level thresholds from pplp_light_levels
const LEVELS = [
  { min: 0, max: 199, name: 'seed' },
  { min: 200, max: 499, name: 'contributor' },
  { min: 500, max: 999, name: 'builder' },
  { min: 1000, max: 1999, name: 'guardian' },
  { min: 2000, max: Infinity, name: 'architect' },
];

function clip(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeConsistencyMultiplier(streak: number): number {
  return 1 + CONFIG.consistency.beta * (1 - Math.exp(-streak / CONFIG.consistency.lambda));
}

function computeSequenceMultiplier(seqCount: number): number {
  return 1 + CONFIG.sequence.eta * Math.tanh(seqCount / CONFIG.sequence.kappa);
}

function computeIntegrityPenalty(avgRisk: number): number {
  return 1 - Math.min(CONFIG.penalty.max_penalty, CONFIG.penalty.theta * avgRisk);
}

// PRD Multiplicative: (S×T×H×V×U)/10^4 on 0-10 scale
function computeMultiplicativeLightScore(pillarS: number, pillarT: number, pillarH: number, pillarC: number, pillarU: number): number {
  const s = pillarS / 10; // convert 0-100 → 0-10
  const t = pillarT / 10;
  const h = pillarH / 10;
  const v = pillarC / 10; // C column → V (Long-term Value) per PRD
  const u = pillarU / 10;
  return (s * t * h * v * u) / 10_000;
}

function determineLevel(totalScore: number): string {
  for (const l of LEVELS) {
    if (totalScore >= l.min && totalScore <= l.max) return l.name;
  }
  return 'architect';
}

async function recordJobRun(
  supabase: any,
  startedAt: number,
  status: 'success' | 'skipped' | 'failed',
  processedCount: number,
  skippedCount = 0,
  errorCount = 0,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from('system_job_runs').insert({
      job_name: 'pplp-compute-daily-scores',
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      status,
      processed_count: processedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      metadata,
    });
  } catch (error) {
    console.warn('[ComputeDailyScores] job run log skipped:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse optional target_date from body or use today (UTC)
    let targetDate: string;
    let processAll = false;
    try {
      const body = await req.json();
      targetDate = body.target_date || new Date().toISOString().split('T')[0];
      processAll = body.process_all === true;
    } catch {
      targetDate = new Date().toISOString().split('T')[0];
    }

    console.log(`[ComputeDailyScores] Processing date: ${targetDate}, process_all: ${processAll}`);

    // 1. Get all users with features_user_day records for this date
    let query = supabase
      .from('features_user_day')
      .select('*')
      .eq('date', targetDate);
    
    // If not process_all, only process users with score = 0 or null
    if (!processAll) {
      query = query.or('daily_light_score.is.null,daily_light_score.eq.0');
    }

    const { data: userDays, error: fetchError } = await query;
    if (fetchError) throw fetchError;
    if (!userDays || userDays.length === 0) {
      await recordJobRun(supabase, startedAt, 'skipped', 0, 1, 0, { target_date: targetDate, reason: 'no_users_to_process' });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'no_users_to_process', message: 'No users to process', date: targetDate }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ComputeDailyScores] Found ${userDays.length} users to process`);

    // Filter out users who haven't accepted PureLove Protocol (legacy profiles.pplp_accepted_at OR new user_light_agreements)
    const userIds = [...new Set(userDays.map(ud => ud.user_id))];
    const [{ data: pplpProfiles }, { data: lightAgreements }] = await Promise.all([
      supabase.from('profiles').select('id').in('id', userIds).not('pplp_accepted_at', 'is', null),
      supabase.from('user_light_agreements').select('user_id').in('user_id', userIds),
    ]);

    const acceptedUserIds = new Set<string>([
      ...((pplpProfiles || []).map((p: any) => p.id)),
      ...((lightAgreements || []).map((a: any) => a.user_id)),
    ]);
    const filteredUserDays = userDays.filter(ud => acceptedUserIds.has(ud.user_id));
    const skippedCount = userDays.length - filteredUserDays.length;

    if (skippedCount > 0) {
      console.log(`[ComputeDailyScores] Skipped ${skippedCount} users without PLP acceptance`);
    }

    if (filteredUserDays.length === 0) {
      await recordJobRun(supabase, startedAt, 'skipped', 0, skippedCount || 1, 0, { target_date: targetDate, reason: 'no_accepted_pplp_users' });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'no_accepted_pplp_users', date: targetDate, processed: 0, skipped_count: skippedCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let errors = 0;

    for (const ud of filteredUserDays) {
      try {
        // --- base_action_score (kept for tracking) ---
        const baseAction =
          (ud.count_posts || 0) * ACTION_WEIGHTS.posts +
          (ud.count_comments || 0) * ACTION_WEIGHTS.comments +
          (ud.count_questions || 0) * ACTION_WEIGHTS.questions +
          (ud.count_journals || 0) * ACTION_WEIGHTS.journals +
          (ud.count_logins || 0) * ACTION_WEIGHTS.logins +
          (ud.count_help || 0) * ACTION_WEIGHTS.help;

        // --- PRD Multiplicative: aggregate per-action pillar scores ---
        const { data: scores } = await supabase
          .from('pplp_scores')
          .select('pillar_s, pillar_t, pillar_h, pillar_c, pillar_u, light_score, action_id')
          .in('action_id', (
            await supabase
              .from('pplp_actions')
              .select('id')
              .eq('actor_id', ud.user_id)
              .gte('created_at', `${targetDate}T00:00:00Z`)
              .lt('created_at', `${targetDate}T23:59:59Z`)
          ).data?.map((a: { id: string }) => a.id) || []);

        // Sum of per-action multiplicative light scores for the day
        let dailyLightSum = 0;
        let contentScore = 0;
        if (scores && scores.length > 0) {
          for (const s of scores) {
            // Use already-computed light_score from pplp-score-action (PRD multiplicative)
            if (s.light_score && s.light_score > 0) {
              dailyLightSum += s.light_score;
            } else {
              // Fallback: compute multiplicative from pillars
              dailyLightSum += computeMultiplicativeLightScore(
                s.pillar_s || 0, s.pillar_t || 0, s.pillar_h || 0, s.pillar_c || 0, s.pillar_u || 0
              );
            }
            // Track content score for reporting
            const pillarSum = (s.pillar_s || 0) + (s.pillar_t || 0) + (s.pillar_h || 0) + (s.pillar_c || 0) + (s.pillar_u || 0);
            contentScore += pillarSum / 500; // normalize for display
          }
        }

        // --- multipliers from features_user_day ---
        const streak = ud.consistency_streak || 0;
        const seqCount = ud.sequence_count || 0;
        const antiFarmRisk = Math.min(1, (ud.anti_farm_risk || 0) / 10);

        const consistencyMul = computeConsistencyMultiplier(streak);
        const sequenceMul = computeSequenceMultiplier(seqCount);
        const integrityPen = computeIntegrityPenalty(antiFarmRisk);

        // --- reputation weight ---
        const passRate = scores && scores.length > 0 ? 1.0 : 0.5;
        const contributionDays = streak;
        const R = contributionDays * passRate * (1 + (streak > 7 ? 0.1 : 0));
        const reputationWeight = clip(CONFIG.reputation.w_min, CONFIG.reputation.w_max,
          1 + CONFIG.reputation.alpha * Math.log(1 + R));

        // --- PRD Final: dailyLight × consistency × sequence × integrity ---
        const finalScore = Math.round((dailyLightSum * consistencyMul * sequenceMul * integrityPen) * 100) / 100;

        // --- Update features_user_day ---
        await supabase
          .from('features_user_day')
          .update({
            base_action_score: baseAction,
            content_score: Math.round(contentScore * 100) / 100,
            reputation_weight: Math.round(reputationWeight * 100) / 100,
            consistency_multiplier: Math.round(consistencyMul * 100) / 100,
            sequence_multiplier: Math.round(sequenceMul * 100) / 100,
            integrity_penalty: Math.round(integrityPen * 100) / 100,
            daily_light_score: finalScore,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', ud.user_id)
          .eq('date', targetDate);

        processed++;
      } catch (userError) {
        console.error(`[ComputeDailyScores] Error processing user ${ud.user_id}:`, userError);
        errors++;
      }
    }

    // 2. Rollup into light_score_ledger (monthly)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all users with non-zero scores this month
    const { data: monthlyData } = await supabase
      .from('features_user_day')
      .select('user_id, daily_light_score, consistency_multiplier, sequence_multiplier, integrity_penalty, reputation_weight')
      .gte('date', periodStart.split('T')[0])
      .lte('date', periodEnd.split('T')[0])
      .gt('daily_light_score', 0);

    if (monthlyData && monthlyData.length > 0) {
      // Aggregate by user
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

      // Determine trend for each user (last 7d vs prior 7d)
      for (const userId of Object.keys(userScores)) {
        const us = userScores[userId];
        const level = determineLevel(us.total);

        // Simple trend: if count > 3, growing; if total < 5, reflecting; else stable
        let trend = 'stable';
        if (us.count >= 5 && us.total > 50) trend = 'growing';
        else if (us.total < 5) trend = 'reflecting';

        await supabase
          .from('light_score_ledger')
          .upsert({
            user_id: userId,
            period: periodLabel,
            period_start: periodStart,
            period_end: periodEnd,
            base_score: Math.round(us.total * 100) / 100,
            final_light_score: Math.round(us.total * 100) / 100,
            reputation_weight: us.lastRW,
            consistency_multiplier: us.lastCM,
            sequence_multiplier: us.lastSM,
            integrity_penalty: us.lastIP,
            level,
            trend,
            rule_version: 'LS-Math-v1.0',
            computed_at: new Date().toISOString(),
          }, { onConflict: 'user_id,period' });
      }

      console.log(`[ComputeDailyScores] Updated ledger for ${Object.keys(userScores).length} users`);
    }

    await recordJobRun(supabase, startedAt, errors > 0 ? 'failed' : 'success', processed, skippedCount, errors, { target_date: targetDate, process_all: processAll });

    return new Response(JSON.stringify({
      success: true,
      date: targetDate,
      processed,
      errors,
      ledger_users: monthlyData ? new Set(monthlyData.map(r => r.user_id)).size : 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ComputeDailyScores] Fatal error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
