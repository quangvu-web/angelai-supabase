import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * PPLP Vesting Release Engine v1.0
 * 
 * Daily job that:
 * 1. Checks active vesting schedules with next_unlock_at <= now
 * 2. Computes unlock amount based on: BaseVesting + ContributionUnlock + UsageUnlock + ConsistencyUnlock
 * 3. Auto-activates eligible amounts into claimable balance
 * 4. Marks dormant accounts (90d inactive → slow vesting mode)
 * 5. Logs all operations
 */

const DORMANT_THRESHOLD_DAYS = 90;
const BASE_UNLOCK_PERCENT_PER_CHECK = 0.125; // 12.5% of locked per 7-day check (fully unlocked in ~8 checks / 56 days)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth: either admin or cron (no auth header = cron job)
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
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

    const now = new Date();
    const nowISO = now.toISOString();

    console.log(`[VestingRelease] Starting vesting release check at ${nowISO}`);

    // ========== STEP 1: Find schedules due for unlock ==========
    const { data: dueSchedules, error: fetchErr } = await supabase
      .from('reward_vesting_schedules')
      .select('*')
      .eq('status', 'active')
      .lte('next_unlock_at', nowISO)
      .order('next_unlock_at', { ascending: true })
      .limit(500);

    if (fetchErr) throw fetchErr;

    if (!dueSchedules || dueSchedules.length === 0) {
      console.log('[VestingRelease] No schedules due for unlock');
      return new Response(JSON.stringify({
        success: true,
        message: 'No vesting schedules due',
        processed: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[VestingRelease] Found ${dueSchedules.length} schedules to process`);

    let totalUnlocked = 0;
    let processedCount = 0;
    let dormantCount = 0;
    let fullyUnlockedCount = 0;

    for (const schedule of dueSchedules) {
      const remaining = schedule.locked_amount - schedule.unlocked_so_far;
      if (remaining <= 0) {
        // Already fully unlocked — mark complete
        await supabase.from('reward_vesting_schedules').update({
          status: 'fully_unlocked',
          fully_unlocked_at: nowISO,
        }).eq('id', schedule.id);
        fullyUnlockedCount++;
        continue;
      }

      // ========== STEP 2: Check user activity for bonus unlock ==========
      const userId = schedule.user_id;
      const checkWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const checkWindowEnd = nowISO.split('T')[0];

      // 2A. Base vesting: time-based unlock
      let baseUnlock = remaining * BASE_UNLOCK_PERCENT_PER_CHECK;

      // 2B. Contribution unlock: did user contribute in last 7 days?
      const { data: recentActivity } = await supabase
        .from('features_user_day')
        .select('daily_light_score')
        .eq('user_id', userId)
        .gte('date', checkWindowStart)
        .lte('date', checkWindowEnd)
        .gt('daily_light_score', 0);

      const activeDays = (recentActivity || []).length;
      const contributionBonus = activeDays >= 3 ? remaining * 0.05 : activeDays >= 1 ? remaining * 0.02 : 0;

      // 2C. Usage unlock: did user use FUN in ecosystem?
      const { count: usageCount } = await supabase
        .from('camly_coin_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('transaction_type', ['spend', 'gift_sent', 'staking'])
        .gte('created_at', checkWindowStart);

      const usageBonus = (usageCount || 0) >= 2 ? remaining * 0.03 : (usageCount || 0) >= 1 ? remaining * 0.01 : 0;

      // 2D. Consistency unlock: streak bonus
      const { data: consistencyData } = await supabase
        .from('daily_login_tracking')
        .select('streak_count')
        .eq('user_id', userId)
        .order('login_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const streak = consistencyData?.streak_count || 0;
      const consistencyBonus = streak >= 14 ? remaining * 0.04 : streak >= 7 ? remaining * 0.02 : 0;

      // Total unlock
      const totalUnlockAmount = Math.min(
        Math.round(baseUnlock + contributionBonus + usageBonus + consistencyBonus),
        remaining
      );

      // ========== STEP 3: Check dormancy ==========
      if (activeDays === 0) {
        // Check last activity date
        const { data: lastActive } = await supabase
          .from('features_user_day')
          .select('date')
          .eq('user_id', userId)
          .gt('daily_light_score', 0)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastActiveDate = lastActive ? new Date(lastActive.date) : new Date(schedule.created_at);
        const daysSinceActive = Math.floor((now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceActive >= DORMANT_THRESHOLD_DAYS) {
          // Switch to dormant — slow vesting mode (unlock at 25% rate)
          const slowUnlock = Math.min(Math.round(remaining * BASE_UNLOCK_PERCENT_PER_CHECK * 0.25), remaining);

          await supabase.from('reward_vesting_schedules').update({
            status: 'dormant',
            dormant_at: nowISO,
            unlocked_so_far: schedule.unlocked_so_far + slowUnlock,
            claimable_amount: schedule.claimable_amount + slowUnlock,
            last_unlock_check_at: nowISO,
            next_unlock_at: new Date(now.getTime() + schedule.unlock_check_interval_days * 24 * 60 * 60 * 1000).toISOString(),
          }).eq('id', schedule.id);

          totalUnlocked += slowUnlock;
          dormantCount++;
          console.log(`[VestingRelease] User ${userId}: DORMANT (${daysSinceActive}d inactive), slow unlock ${slowUnlock}`);
          continue;
        }
      }

      // ========== STEP 4: Apply unlock ==========
      const newUnlockedSoFar = schedule.unlocked_so_far + totalUnlockAmount;
      const newClaimable = schedule.claimable_amount + totalUnlockAmount;
      const isFullyUnlocked = newUnlockedSoFar >= schedule.locked_amount;

      await supabase.from('reward_vesting_schedules').update({
        unlocked_so_far: newUnlockedSoFar,
        claimable_amount: newClaimable,
        last_unlock_check_at: nowISO,
        next_unlock_at: isFullyUnlocked ? null : new Date(now.getTime() + schedule.unlock_check_interval_days * 24 * 60 * 60 * 1000).toISOString(),
        status: isFullyUnlocked ? 'fully_unlocked' : 'active',
        fully_unlocked_at: isFullyUnlocked ? nowISO : null,
      }).eq('id', schedule.id);

      totalUnlocked += totalUnlockAmount;
      processedCount++;
      if (isFullyUnlocked) fullyUnlockedCount++;

      console.log(`[VestingRelease] User ${userId}: unlocked ${totalUnlockAmount} (base=${Math.round(baseUnlock)} + contrib=${Math.round(contributionBonus)} + usage=${Math.round(usageBonus)} + consistency=${Math.round(consistencyBonus)}), remaining=${remaining - totalUnlockAmount}`);
    }

    // ========== STEP 5: Re-activate dormant users who returned ==========
    const { data: dormantSchedules } = await supabase
      .from('reward_vesting_schedules')
      .select('id, user_id, unlock_check_interval_days')
      .eq('status', 'dormant')
      .limit(200);

    let reactivatedCount = 0;
    for (const ds of dormantSchedules || []) {
      const { data: recentAct } = await supabase
        .from('features_user_day')
        .select('date')
        .eq('user_id', ds.user_id)
        .gt('daily_light_score', 0)
        .gte('date', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .limit(1)
        .maybeSingle();

      if (recentAct) {
        await supabase.from('reward_vesting_schedules').update({
          status: 'active',
          dormant_at: null,
          next_unlock_at: new Date(now.getTime() + ds.unlock_check_interval_days * 24 * 60 * 60 * 1000).toISOString(),
        }).eq('id', ds.id);
        reactivatedCount++;
      }
    }

    // ========== STEP 6: Log metrics ==========
    await supabase.from('epoch_metrics').insert({
      epoch_id: `vesting-${nowISO.split('T')[0]}`,
      metric_type: 'vesting_release',
      metric_data: {
        processed: processedCount,
        total_unlocked: totalUnlocked,
        fully_unlocked: fullyUnlockedCount,
        dormant: dormantCount,
        reactivated: reactivatedCount,
        timestamp: nowISO,
      },
    });

    const result = {
      success: true,
      processed: processedCount,
      total_unlocked: totalUnlocked,
      fully_unlocked: fullyUnlockedCount,
      dormant_switched: dormantCount,
      reactivated: reactivatedCount,
    };

    console.log(`[VestingRelease] Done: ${processedCount} processed, ${totalUnlocked} FUN unlocked, ${fullyUnlockedCount} fully unlocked, ${dormantCount} dormant, ${reactivatedCount} reactivated`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[VestingRelease] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
