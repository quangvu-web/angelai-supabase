import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// pplp-epoch-health: Daily health metrics + anti-farming + epoch snapshots
// Scheduler: run daily via cron
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let targetDate: string;
    try {
      const body = await req.json();
      targetDate = body.target_date || new Date().toISOString().split('T')[0];
    } catch {
      targetDate = new Date().toISOString().split('T')[0];
    }

    console.log(`[EpochHealth] Processing date: ${targetDate}`);

    // ===== STEP 1: Compute anti-farming factors for all active users =====
    const { data: activeUsers } = await supabase
      .from('features_user_day')
      .select('user_id')
      .eq('date', targetDate)
      .gt('daily_light_score', 0);

    let antiFarmProcessed = 0;
    let antiFarmErrors = 0;

    for (const { user_id } of activeUsers || []) {
      try {
        await supabase.rpc('compute_anti_farming_factors', {
          _user_id: user_id,
          _date: targetDate,
        });
        antiFarmProcessed++;
      } catch (e) {
        console.error(`[EpochHealth] Anti-farm error for ${user_id}:`, e);
        antiFarmErrors++;
      }
    }

    console.log(`[EpochHealth] Anti-farming: processed=${antiFarmProcessed}, errors=${antiFarmErrors}`);

    // ===== STEP 2: Create epoch snapshots (3 layers) =====
    const today = new Date(targetDate);
    const dayOfWeek = today.getDay(); // 0=Sun

    // Micro epoch: every 7 days (on Sunday)
    if (dayOfWeek === 0) {
      await createEpochSnapshots(supabase, targetDate, 'micro', 7);
    }

    // Validation epoch: every 14 days (on 1st and 15th-ish)
    const dayOfMonth = today.getDate();
    if (dayOfMonth === 1 || dayOfMonth === 15) {
      await createEpochSnapshots(supabase, targetDate, 'validation', 14);
    }

    // Mint epoch snapshots created by pplp-epoch-allocate (28d)

    // ===== STEP 3: Compute health metrics =====
    const { data: healthResult, error: healthErr } = await supabase.rpc('compute_health_metrics', {
      _date: targetDate,
    });

    if (healthErr) {
      console.error(`[EpochHealth] Health metrics error:`, healthErr);
    } else {
      console.log(`[EpochHealth] Health metrics:`, JSON.stringify(healthResult));

      // Check safe mode
      if (healthResult?.safe_mode_active) {
        console.warn(`[EpochHealth] ⚠️ SAFE MODE TRIGGERED: ${healthResult.safe_mode_reason}`);
        // Update epoch_config to signal safe mode
        await supabase.from('epoch_config').upsert({
          config_key: 'safe_mode',
          config_value: {
            active: true,
            reason: healthResult.safe_mode_reason,
            triggered_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'config_key' });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: targetDate,
      anti_farming: { processed: antiFarmProcessed, errors: antiFarmErrors },
      health: healthResult || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[EpochHealth] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================================
// Create epoch snapshots for a given window
// ============================================================
async function createEpochSnapshots(
  supabase: ReturnType<typeof createClient>,
  endDate: string,
  epochType: string,
  windowDays: number,
) {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(start.getDate() - windowDays);
  const startStr = start.toISOString().split('T')[0];
  const epochId = `${epochType}-${startStr}-to-${endDate}`;

  console.log(`[EpochHealth] Creating ${epochType} snapshots: ${startStr} → ${endDate}`);

  // Get all users with activity in this window
  const { data: userData } = await supabase
    .from('features_user_day')
    .select('user_id, daily_light_score, timing_adjusted_score, burst_penalty, late_window_weight, cross_window_bonus, consistency_multiplier, integrity_penalty')
    .gte('date', startStr)
    .lte('date', endDate)
    .gt('daily_light_score', 0);

  if (!userData || userData.length === 0) return;

  // Aggregate by user
  const userAgg = new Map<string, {
    rawCount: number; score: number; timingScore: number;
    avgBurst: number; avgLate: number; avgCross: number;
    avgTrust: number; avgFraud: number;
  }>();

  for (const row of userData) {
    const uid = row.user_id;
    const prev = userAgg.get(uid) || {
      rawCount: 0, score: 0, timingScore: 0,
      avgBurst: 0, avgLate: 0, avgCross: 0, avgTrust: 0, avgFraud: 0,
    };
    prev.rawCount++;
    prev.score += row.daily_light_score || 0;
    prev.timingScore += row.timing_adjusted_score || row.daily_light_score || 0;
    prev.avgBurst += row.burst_penalty || 1;
    prev.avgLate += row.late_window_weight || 1;
    prev.avgCross += row.cross_window_bonus || 1;
    prev.avgTrust += row.consistency_multiplier || 1;
    prev.avgFraud += row.integrity_penalty ? (1 - (row.integrity_penalty || 1)) : 0;
    userAgg.set(uid, prev);
  }

  // Batch upsert snapshots
  const snapshots = [...userAgg.entries()].map(([userId, agg]) => ({
    user_id: userId,
    epoch_id: epochId,
    epoch_type: epochType,
    window_start: startStr,
    window_end: endDate,
    raw_activity_count: agg.rawCount,
    deduped_activity_count: agg.rawCount, // dedup done upstream
    preview_score: epochType === 'micro' ? Math.round(agg.score * 100) / 100 : 0,
    validated_score: epochType === 'validation' ? Math.round(agg.score * 100) / 100 : 0,
    finalized_score: epochType === 'mint' ? Math.round(agg.score * 100) / 100 : 0,
    trust_factor: Math.round((agg.avgTrust / agg.rawCount) * 1000) / 1000,
    fraud_factor: Math.round((agg.avgFraud / agg.rawCount) * 1000) / 1000,
    burst_penalty: Math.round((agg.avgBurst / agg.rawCount) * 1000) / 1000,
    late_window_suppression: Math.round((agg.avgLate / agg.rawCount) * 1000) / 1000,
    cross_window_bonus: Math.round((agg.avgCross / agg.rawCount) * 1000) / 1000,
    timing_adjusted_score: Math.round(agg.timingScore * 100) / 100,
    updated_at: new Date().toISOString(),
  }));

  // Upsert in batches of 100
  for (let i = 0; i < snapshots.length; i += 100) {
    const batch = snapshots.slice(i, i + 100);
    const { error } = await supabase
      .from('epoch_snapshots')
      .upsert(batch, { onConflict: 'user_id,epoch_id,epoch_type' });
    if (error) {
      console.error(`[EpochHealth] Snapshot upsert error (batch ${i}):`, error);
    }
  }

  console.log(`[EpochHealth] Created ${snapshots.length} ${epochType} snapshots`);
}
