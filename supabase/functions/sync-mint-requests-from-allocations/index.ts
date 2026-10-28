// sync-mint-requests-from-allocations
// Đọc pplp_mint_allocations cho 1 cycle, upsert pplp_mint_requests theo amount khớp.
// Idempotent: dùng deterministic UUID cho action_id, onConflict=action_id.
// Áp dụng sau khi process-mint-cycle / re-run cycle để mint_requests luôn = fun_allocated.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  );
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deterministicUuid(seed: string): Promise<string> {
  const hex = (await sha256Hex(seed)).slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { cycle_id, dry_run = false } = await req.json().catch(() => ({}));
    if (!cycle_id) {
      return new Response(JSON.stringify({ error: 'cycle_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: cycle, error: cycleErr } = await supabase
      .from('pplp_mint_cycles').select('*').eq('id', cycle_id).maybeSingle();
    if (cycleErr || !cycle) {
      return new Response(JSON.stringify({ error: 'cycle not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Paginate allocations (eligible only, fun_allocated > 0)
    const allocations: Array<{ user_id: string; fun_allocated: number; user_light_contribution: number }> = [];
    const PAGE = 1000;
    let offset = 0;
    while (true) {
      const { data: page } = await supabase
        .from('pplp_mint_allocations')
        .select('user_id, fun_allocated, user_light_contribution')
        .eq('cycle_id', cycle_id)
        .eq('eligible', true)
        .gt('fun_allocated', 0)
        .range(offset, offset + PAGE - 1);
      if (!page || page.length === 0) break;
      allocations.push(...page);
      if (page.length < PAGE) break;
      offset += PAGE;
    }

    if (allocations.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No eligible allocations', synced: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get wallet addresses in batches
    const userIds = allocations.map(a => a.user_id);
    const walletMap = new Map<string, string>();
    for (let i = 0; i < userIds.length; i += 100) {
      const slice = userIds.slice(i, i + 100);
      const { data: wallets } = await supabase
        .from('user_wallet_addresses')
        .select('user_id, wallet_address')
        .in('user_id', slice);
      (wallets || []).forEach((w: any) => {
        if (!walletMap.has(w.user_id)) walletMap.set(w.user_id, w.wallet_address);
      });
    }

    const period = (cycle.start_date as string).substring(0, 7);
    const actionHash = '0x' + (await sha256Hex('FUN_EPOCH_REWARD'));

    // Load active pool config once for distribution logging (99/1 split)
    const { data: poolConfig } = await supabase
      .from('fun_pool_config')
      .select('pool_name, retention_rate, tier_order')
      .eq('is_active', true)
      .order('tier_order', { ascending: true });
    const tiers = (poolConfig && poolConfig.length > 0) ? poolConfig : [
      { pool_name: 'genesis_community', retention_rate: 0.01, tier_order: 1 },
      { pool_name: 'fun_platform', retention_rate: 0.0099, tier_order: 2 },
      { pool_name: 'fun_partners', retention_rate: 0.0098, tier_order: 3 },
    ];
    const retainFactor = tiers.reduce((acc: number, t: any) => acc * (1 - Number(t.retention_rate)), 1);

    function computeDistribution(userAmount: number) {
      const total = Math.round(userAmount / retainFactor);
      let remaining = total;
      const out: Record<string, number> = {};
      for (const t of tiers as any[]) {
        const tierAmt = Math.floor(remaining * Number(t.retention_rate));
        out[t.pool_name] = tierAmt;
        remaining -= tierAmt;
      }
      return {
        total_reward: total,
        user_amount: remaining,
        genesis_amount: out['genesis_community'] || 0,
        platform_amount: out['fun_platform'] || 0,
        partners_amount: out['fun_partners'] || 0,
      };
    }

    const summary = {
      created: 0, updated: 0, unchanged: 0, skipped_minted: 0, skipped_no_wallet: 0, errors: 0, logs_written: 0,
    };
    const noWalletUsers: string[] = [];

    for (const alloc of allocations) {
      const recipient = walletMap.get(alloc.user_id);
      // Skip users without a linked wallet (DB trigger sẽ reject zero address).
      if (!recipient) {
        summary.skipped_no_wallet++;
        noWalletUsers.push(alloc.user_id);
        continue;
      }
      const actionId = await deterministicUuid(`epoch-mint:${cycle_id}:${alloc.user_id}`);
      const evidenceHash = '0x' + (await sha256Hex(
        `epoch:${period}:user:${alloc.user_id}:light:${alloc.user_light_contribution}`
      ));

      // Check if mint_request already exists & its status
      const { data: existing } = await supabase
        .from('pplp_mint_requests')
        .select('id, amount, status')
        .eq('action_id', actionId)
        .maybeSingle();

      if (existing && ['minted', 'signed', 'approved'].includes(existing.status)) {
        // Already processed — do not overwrite. Track discrepancy.
        summary.skipped_minted++;
        continue;
      }

      if (existing && Number(existing.amount) === alloc.fun_allocated && ['pending_sig', 'signing'].includes(existing.status)) {
        summary.unchanged++;
        continue;
      }

      if (dry_run) {
        if (existing) summary.updated++; else summary.created++;
        continue;
      }

      // Ensure pplp_actions row exists
      const { error: actionErr } = await supabase.from('pplp_actions').upsert({
        id: actionId,
        platform_id: 'angel_ai',
        action_type: 'epoch_mint_reward',
        actor_id: alloc.user_id,
        metadata: {
          cycle_id,
          period,
          light_contribution: alloc.user_light_contribution,
          source: 'sync-mint-requests-from-allocations',
        },
        status: 'scored',
        evidence_hash: evidenceHash,
        policy_version: '1.0.0',
        scored_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (actionErr) {
        console.error(`[Sync] action upsert error ${alloc.user_id}:`, actionErr);
        summary.errors++;
        continue;
      }

      const { error: mrErr } = await supabase.from('pplp_mint_requests').upsert({
        action_id: actionId,
        actor_id: alloc.user_id,
        recipient_address: recipient,
        amount: alloc.fun_allocated,
        action_hash: actionHash,
        evidence_hash: evidenceHash,
        policy_version: 1,
        nonce: 0,
        status: 'pending_sig',
        signature: null,
        signer_address: null,
        tx_hash: null,
        minted_at: null,
        multisig_required_groups: ['will', 'wisdom', 'love'],
        multisig_completed_groups: [],
        multisig_signatures: {},
        mint_destination: 'angel_ai',
        fun_profile_sync_status: null,
      }, { onConflict: 'action_id' });

      if (mrErr) {
        console.error(`[Sync] mint_request upsert error ${alloc.user_id}:`, mrErr);
        summary.errors++;
        continue;
      }

      if (existing) {
        summary.updated++;
      } else {
        summary.created++;
      }

      // Write fun_distribution_logs (99/1 split) — idempotent per mint_request_id
      try {
        const mintReqId = existing?.id ?? (await supabase
          .from('pplp_mint_requests')
          .select('id')
          .eq('action_id', actionId)
          .maybeSingle()).data?.id;

        if (mintReqId) {
          const { data: existingLog } = await supabase
            .from('fun_distribution_logs')
            .select('id')
            .eq('mint_request_id', mintReqId)
            .maybeSingle();

          if (!existingLog) {
            const dist = computeDistribution(Number(alloc.fun_allocated));
            const totalRewardSafe = dist.total_reward > 0 ? dist.total_reward : Number(alloc.fun_allocated);
            const { error: logErr } = await supabase.from('fun_distribution_logs').insert({
              action_id: actionId,
              actor_id: alloc.user_id,
              mint_request_id: mintReqId,
              total_reward: dist.total_reward,
              user_amount: dist.user_amount,
              user_percentage: Number(((dist.user_amount / totalRewardSafe) * 100).toFixed(4)),
              genesis_amount: dist.genesis_amount,
              genesis_percentage: Number(((dist.genesis_amount / totalRewardSafe) * 100).toFixed(4)),
              platform_amount: dist.platform_amount,
              platform_percentage: Number(((dist.platform_amount / totalRewardSafe) * 100).toFixed(4)),
              partners_amount: dist.partners_amount,
              partners_percentage: Number(((dist.partners_amount / totalRewardSafe) * 100).toFixed(4)),
            });
            if (logErr) {
              console.error(`[Sync] distribution_log insert error ${alloc.user_id}:`, logErr);
            } else {
              summary.logs_written++;
            }
          }
        }
      } catch (logEx) {
        console.error(`[Sync] distribution_log exception ${alloc.user_id}:`, logEx);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      cycle_id,
      total_allocations: allocations.length,
      dry_run,
      ...summary,
      no_wallet_users: noWalletUsers,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[Sync] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
