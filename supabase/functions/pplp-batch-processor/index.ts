import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchResult {
  action_id: string;
  status: 'success' | 'failed' | 'skipped';
  light_score?: number;
  reward?: number;
  error?: string;
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
      job_name: 'pplp-batch-processor',
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
    console.warn('[PPLP Batch] job run log skipped:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse options
    const { batch_size = 50, dry_run = false, action = 'process' } = await req.json().catch(() => ({}));

    if (action === 'rescore_legacy') {
      console.log(`[PPLP Batch] Starting legacy rescore | batch_size: ${batch_size} | dry_run: ${dry_run}`);

      const { data: legacyActions, error: legacyFetchError } = await supabase
        .from('pplp_actions')
        .select('id, actor_id, status, created_at, pplp_scores!inner(scoring_engine_version)')
        .in('status', ['scored', 'minted', 'rejected'])
        .or('scoring_engine_version.eq.v1.0,scoring_engine_version.is.null', { foreignTable: 'pplp_scores' })
        .order('created_at', { ascending: true })
        .limit(batch_size);

      if (legacyFetchError) {
        console.error('[PPLP Batch] Legacy fetch error:', legacyFetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch legacy scored actions', details: legacyFetchError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!legacyActions || legacyActions.length === 0) {
        return new Response(
          JSON.stringify({ success: true, action: 'rescore_legacy', message: 'No legacy-scored actions to rescore', processed: 0, remaining: 0, results: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const touchedUsers = new Set<string>();
      const results: BatchResult[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (const actionRow of legacyActions as Array<{ id: string; actor_id: string; status: string }>) {
        try {
          if (dry_run) {
            results.push({ action_id: actionRow.id, status: 'skipped', error: 'Dry run - not processed' });
            continue;
          }

          const scoreResponse = await supabase.functions.invoke('pplp-score-action', {
            body: { action_id: actionRow.id, force_rescore: true, skip_side_effects: true }
          });

          if (scoreResponse.error) {
            throw new Error(scoreResponse.error.message || 'Legacy rescore failed');
          }

          const scoreResult = scoreResponse.data;
          if (scoreResult?.success) {
            touchedUsers.add(actionRow.actor_id);
            results.push({
              action_id: actionRow.id,
              status: 'success',
              light_score: scoreResult.light_score,
              reward: scoreResult.final_reward,
            });
            successCount++;
          } else {
            results.push({ action_id: actionRow.id, status: 'failed', error: scoreResult?.error || 'Unknown rescore error' });
            failedCount++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ action_id: actionRow.id, status: 'failed', error: errorMessage });
          failedCount++;
          console.error(`[PPLP Batch] Legacy rescore failed for ${actionRow.id}:`, errorMessage);
        }
      }

      for (const userId of touchedUsers) {
        try {
          await supabase.rpc('recompute_user_light_score', { _user_id: userId });
        } catch (recomputeErr) {
          console.error(`[PPLP Batch] Recompute user light score failed for ${userId}:`, recomputeErr);
        }
      }

      const { count: remainingLegacy } = await supabase
        .from('pplp_actions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['scored', 'minted', 'rejected'])
        .or('scoring_engine_version.eq.v1.0,scoring_engine_version.is.null', { foreignTable: 'pplp_scores' });

      return new Response(
        JSON.stringify({
          success: true,
          action: 'rescore_legacy',
          processed: legacyActions.length,
          success_count: successCount,
          failed_count: failedCount,
          touched_users: touchedUsers.size,
          remaining: remainingLegacy ?? null,
          dry_run,
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== RANDOM AUDIT MODE ==========
    if (action === 'random_audit') {
      console.log('[PPLP Batch] Running random audit...');
      
      const { data: auditCount, error: auditError } = await supabase
        .rpc('schedule_random_audit');
      
      if (auditError) {
        console.error('[PPLP Batch] Random audit error:', auditError);
        return new Response(
          JSON.stringify({ error: 'Random audit failed', details: auditError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Kiểm tra user nào có >= 3 audit flags chưa xử lý → tự động đình chỉ
      const { data: flaggedUsers } = await supabase
        .from('pplp_audits')
        .select('actor_id')
        .eq('result', 'FLAGGED')
        .eq('is_resolved', false);
      
      if (flaggedUsers && flaggedUsers.length > 0) {
        // Đếm flags per user
        const flagCounts: Record<string, number> = {};
        for (const f of flaggedUsers) {
          flagCounts[f.actor_id] = (flagCounts[f.actor_id] || 0) + 1;
        }
        
        let suspendedCount = 0;
        for (const [userId, count] of Object.entries(flagCounts)) {
          if (count >= 3) {
            await supabase.rpc('auto_suspend_high_risk', {
              _user_id: userId,
              _risk_score: 75,
              _signals: JSON.stringify([{ type: 'RANDOM_AUDIT', flags: count }])
            });
            suspendedCount++;
            console.log(`[PPLP Batch] Auto-suspended user ${userId.slice(0, 8)}... with ${count} audit flags`);
          }
        }
        
        console.log(`[PPLP Batch] Random audit complete: ${auditCount} audits scheduled, ${suspendedCount} users auto-suspended`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'random_audit',
          audits_scheduled: auditCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ========== CROSS-ACCOUNT SCAN MODE ==========
    if (action === 'cross_account_scan') {
      console.log('[PPLP Batch] Running cross-account scan...');
      
      const { data: scanResult, error: scanError } = await supabase
        .rpc('run_cross_account_scan');
      
      if (scanError) {
        console.error('[PPLP Batch] Cross-account scan error:', scanError);
        return new Response(
          JSON.stringify({ error: 'Cross-account scan failed', details: scanError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[PPLP Batch] Cross-account scan complete:`, scanResult);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'cross_account_scan',
          ...scanResult,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ========== END CROSS-ACCOUNT SCAN ==========
    // ========== RELEASE PENDING REWARDS MODE ==========
    if (action === 'release_pending_rewards') {
      console.log('[PPLP Batch] Releasing pending rewards...');
      
      const { data: releaseResult, error: releaseError } = await supabase
        .rpc('release_pending_rewards');
      
      if (releaseError) {
        console.error('[PPLP Batch] Release error:', releaseError);
        return new Response(
          JSON.stringify({ error: 'Release failed', details: releaseError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = releaseResult?.[0] || { released_count: 0, total_amount: 0, frozen_count: 0 };
      console.log(`[PPLP Batch] Released ${result.released_count} rewards (${result.total_amount} coins), frozen ${result.frozen_count}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: 'release_pending_rewards',
          ...result,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ========== END RELEASE PENDING REWARDS ==========

    // ========== END RANDOM AUDIT ==========

    console.log(`[PPLP Batch] Starting batch processor | batch_size: ${batch_size} | dry_run: ${dry_run}`);

    // Fetch pending actions
    const { data: pendingActions, error: fetchError } = await supabase
      .from('pplp_actions')
      .select('id, platform_id, action_type, actor_id, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batch_size);

    // Pre-check: reject actions for users who have NOT accepted PPLP charter
    if (!dry_run && pendingActions && pendingActions.length > 0) {
      const actorIds = Array.from(new Set(pendingActions.map((a: any) => a.actor_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, pplp_accepted_at')
        .in('user_id', actorIds);
      const acceptedSet = new Set(
        (profiles || []).filter((p: any) => p.pplp_accepted_at).map((p: any) => p.user_id)
      );
      const blockedActions = pendingActions.filter((a: any) => !acceptedSet.has(a.actor_id));
      if (blockedActions.length > 0) {
        const blockedIds = blockedActions.map((a: any) => a.id);
        await supabase
          .from('pplp_actions')
          .update({ status: 'rejected' })
          .in('id', blockedIds);
        console.log(`[PPLP Batch] Rejected ${blockedActions.length} actions from ${new Set(blockedActions.map((a: any) => a.actor_id)).size} users without PPLP acceptance`);
        // Notify affected users (one per user) to sign charter
        const uniqueBlockedUsers = Array.from(new Set(blockedActions.map((a: any) => a.actor_id)));
        for (const uid of uniqueBlockedUsers) {
          try {
            await supabase.from('notifications').insert({
              user_id: uid,
              type: 'pplp_charter_required',
              title: '⚠️ Cần ký Hiến chương PPLP',
              content: 'Hành động của bạn chưa được chấm điểm vì chưa chấp nhận Hiến chương Ánh Sáng. Vào trang Hiến chương để ký nhé.',
              metadata: { reason: 'PPLP_NOT_ACCEPTED' }
            });
          } catch { /* non-fatal */ }
        }
      }
    }

    if (fetchError) {
      console.error('[PPLP Batch] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending actions', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingActions || pendingActions.length === 0) {
      console.log('[PPLP Batch] No pending actions found');
      await recordJobRun(supabase, startedAt, 'skipped', 0, 1, 0, { action, reason: 'no_pending_actions' });
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: 'no_pending_actions',
          message: 'No pending actions to process',
          processed: 0,
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PPLP Batch] Found ${pendingActions.length} pending actions`);

    const results: BatchResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Process each action
    for (const action of pendingActions) {
      try {
        // Check if action is too old (>24h) - skip stale actions
        const createdAt = new Date(action.created_at);
        const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceCreation > 24) {
          console.log(`[PPLP Batch] Skipping stale action ${action.id} (${hoursSinceCreation.toFixed(1)}h old)`);
          
          // Mark as rejected due to staleness
          if (!dry_run) {
            await supabase
              .from('pplp_actions')
              .update({ status: 'rejected' })
              .eq('id', action.id);
          }
          
          results.push({
            action_id: action.id,
            status: 'skipped',
            error: `Stale action (${hoursSinceCreation.toFixed(1)}h old)`
          });
          skippedCount++;
          continue;
        }

        if (dry_run) {
          results.push({
            action_id: action.id,
            status: 'skipped',
            error: 'Dry run - not processed'
          });
          skippedCount++;
          continue;
        }

        // Call the scoring function
        const scoreResponse = await supabase.functions.invoke('pplp-score-action', {
          body: { action_id: action.id }
        });

        if (scoreResponse.error) {
          throw new Error(scoreResponse.error.message || 'Scoring failed');
        }

        const scoreResult = scoreResponse.data;

        if (scoreResult.success) {
          results.push({
            action_id: action.id,
            status: 'success',
            light_score: scoreResult.light_score,
            reward: scoreResult.final_reward
          });
          successCount++;
          console.log(`[PPLP Batch] ✓ Action ${action.id}: LightScore=${scoreResult.light_score}, Reward=${scoreResult.final_reward}`);
        } else {
          results.push({
            action_id: action.id,
            status: 'failed',
            error: scoreResult.error || 'Unknown scoring error'
          });
          failedCount++;
          console.log(`[PPLP Batch] ✗ Action ${action.id}: ${scoreResult.error}`);
        }

        // Small delay between processing to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          action_id: action.id,
          status: 'failed',
          error: errorMessage
        });
        failedCount++;
        console.error(`[PPLP Batch] Error processing action ${action.id}:`, errorMessage);
      }
    }

    // Calculate stats
    const totalRewards = results
      .filter(r => r.status === 'success' && r.reward)
      .reduce((sum, r) => sum + (r.reward || 0), 0);

    const avgLightScore = results
      .filter(r => r.status === 'success' && r.light_score)
      .reduce((sum, r, _, arr) => sum + (r.light_score || 0) / arr.length, 0);

    const summary = {
      success: true,
      processed: pendingActions.length,
      success_count: successCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      total_rewards_minted: totalRewards,
      avg_light_score: Math.round(avgLightScore * 100) / 100,
      dry_run,
      results
    };

    console.log(`[PPLP Batch] Complete | Success: ${successCount} | Failed: ${failedCount} | Skipped: ${skippedCount} | Rewards: ${totalRewards}`);
    await recordJobRun(supabase, startedAt, 'success', pendingActions.length, skippedCount, failedCount, { action, dry_run });

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PPLP Batch] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Batch processor failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
