import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Admin Bulk Sync — đồng bộ tất cả actions chưa sync của tất cả linked users sang FUN Profile.
 * Chạy bằng service_role hoặc admin auth. Không cần user đăng nhập.
 * 
 * POST body (optional):
 *   { "dry_run": true }        — chỉ đếm, không gửi
 *   { "actor_ids": ["uuid"] }  — chỉ sync cho user cụ thể
 *   { "limit_per_user": 200 }  — giới hạn actions mỗi user (default 500)
 */

const MAX_BATCH_SIZE = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUN_RICH_INGEST_URL = Deno.env.get('FUN_PROFILE_INGEST_URL') || 'https://bhtsnervqiwchluwuxki.supabase.co/functions/v1/pplp-ingest-actions';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const ingestKey = Deno.env.get('FUN_PROFILE_INGEST_KEY') || Deno.env.get('ANGEL_AI_INGEST_KEY');

    if (!ingestKey) {
      return new Response(JSON.stringify({ error: 'Missing ingest key config' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin auth check — require service_role or admin user
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Check admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    // If no auth header, rely on verify_jwt=false + service key (cron/internal call)

    // Parse body
    let dryRun = false;
    let filterActorIds: string[] | null = null;
    let limitPerUser = 500;
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true;
      filterActorIds = body?.actor_ids || null;
      limitPerUser = body?.limit_per_user || 500;
    } catch { /* no body */ }

    // Get all active fun_id_links
    let linksQuery = supabase
      .from('fun_id_links')
      .select('angel_user_id, fun_profile_user_id')
      .eq('status', 'active')
      .not('fun_profile_user_id', 'is', null);

    if (filterActorIds && filterActorIds.length > 0) {
      linksQuery = linksQuery.in('angel_user_id', filterActorIds);
    }

    const { data: links, error: linksError } = await linksQuery;
    if (linksError || !links) {
      return new Response(JSON.stringify({ error: 'Failed to fetch links', detail: linksError?.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BulkSync] Starting for ${links.length} linked users, dry_run=${dryRun}`);

    const results: Record<string, any> = {};
    let grandTotalSynced = 0;
    let grandTotalFailed = 0;
    let grandTotalDuplicates = 0;
    let grandTotalActions = 0;

    for (const link of links) {
      const angelUserId = link.angel_user_id;
      const funProfileId = link.fun_profile_user_id;

      // Fetch unsynced scored actions
      const { data: actions, error: fetchErr } = await supabase
        .from('pplp_actions')
        .select('id, action_type, evidence_hash, metadata, created_at, pplp_scores(light_score, final_reward)')
        .eq('actor_id', angelUserId)
        .in('status', ['scored', 'minted'])
        .eq('synced_to_fun_rich', false)
        .order('created_at', { ascending: true })
        .limit(limitPerUser);

      if (fetchErr || !actions || actions.length === 0) {
        if (fetchErr) console.warn(`[BulkSync] Fetch error for ${angelUserId}:`, fetchErr.message);
        continue;
      }

      grandTotalActions += actions.length;

      if (dryRun) {
        results[angelUserId] = { fun_profile_id: funProfileId, actions_to_sync: actions.length };
        continue;
      }

      // Send in batches
      let userSynced = 0;
      let userFailed = 0;
      let userDuplicates = 0;
      const syncedIds: string[] = [];

      for (let i = 0; i < actions.length; i += MAX_BATCH_SIZE) {
        const chunk = actions.slice(i, i + MAX_BATCH_SIZE);

        const batchActions = chunk.map(action => {
          const mappedType = action.action_type.toUpperCase();
          const score = Array.isArray(action.pplp_scores)
            ? action.pplp_scores[0]
            : action.pplp_scores;
          const contentPreview = typeof (action.metadata as Record<string, unknown>)?.content === 'string'
            ? ((action.metadata as Record<string, unknown>).content as string).slice(0, 200)
            : '';

          return {
            fun_profile_id: funProfileId,
            action_type: mappedType,
            light_score: score?.light_score || 0,
            evidence_hash: action.id,
            source_platform: 'angel_ai',
            metadata: {
              content_preview: contentPreview,
              source: 'angel_ai',
              source_platform: 'angel_ai',
              original_action_id: action.id,
              created_at: action.created_at,
            },
          };
        });

        try {
          const res = await fetch(FUN_RICH_INGEST_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ingestKey,
            },
            body: JSON.stringify({ actions: batchActions }),
          });

          const result = await res.json();

          console.log(`[BulkSync] Batch response for ${angelUserId}: status=${res.status}, body=${JSON.stringify(result).slice(0, 500)}`);

          if (res.ok && result.success) {
            const summary = result.summary || {};
            userSynced += summary.ingested || 0;
            userDuplicates += summary.duplicates || 0;
            userFailed += summary.errors || 0;

            // Collect synced IDs
            const ingestedResults = (result.results || []).filter(
              (r: any) => r.status === 'ingested' || r.status === 'duplicate'
            );
            for (const r of ingestedResults) {
              const orig = chunk.find(a => a.id === r.evidence_hash);
              if (orig) syncedIds.push(orig.id);
            }
          } else {
            userFailed += chunk.length;
            console.warn(`[BulkSync] Batch failed for ${angelUserId}: ${result.error || res.statusText}`);
          }
        } catch (err) {
          userFailed += chunk.length;
          console.error(`[BulkSync] Network error for ${angelUserId}:`, err);
        }
      }

      // Mark synced
      if (syncedIds.length > 0) {
        const now = new Date().toISOString();
        for (let i = 0; i < syncedIds.length; i += 50) {
          const idChunk = syncedIds.slice(i, i + 50);
          await supabase
            .from('pplp_actions')
            .update({ synced_to_fun_rich: true, synced_at: now })
            .in('id', idChunk);
        }
      }

      grandTotalSynced += userSynced;
      grandTotalFailed += userFailed;
      grandTotalDuplicates += userDuplicates;

      results[angelUserId] = {
        fun_profile_id: funProfileId,
        total: actions.length,
        synced: userSynced,
        duplicates: userDuplicates,
        failed: userFailed,
        marked_synced: syncedIds.length,
      };

      console.log(`[BulkSync] User ${angelUserId}: ${userSynced} synced, ${userDuplicates} dups, ${userFailed} failed`);
    }

    const response = {
      status: dryRun ? 'dry_run' : 'completed',
      linked_users: links.length,
      total_actions: grandTotalActions,
      total_synced: grandTotalSynced,
      total_duplicates: grandTotalDuplicates,
      total_failed: grandTotalFailed,
      per_user: results,
    };

    console.log(`[BulkSync] Done: ${grandTotalSynced} synced, ${grandTotalDuplicates} dups, ${grandTotalFailed} failed across ${links.length} users`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[BulkSync] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
