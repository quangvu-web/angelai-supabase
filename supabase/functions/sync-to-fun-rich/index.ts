import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Map Angel AI action types to FUN Profile light_actions types (Tầng Database)
const ACTION_TYPE_MAP: Record<string, string> = {
  'QUESTION_ASK': 'question_ask',
  'FEEDBACK_GIVE': 'feedback_give',
  'VISION_CREATE': 'vision_create',
  'POST_CREATE': 'post_create',
  'CONTENT_CREATE': 'content_create',
  'COMMENT_CREATE': 'comment_create',
  'JOURNAL_WRITE': 'journal_write',
  'GRATITUDE_PRACTICE': 'gratitude_practice',
  'HELP_COMMUNITY': 'help_community',
  'SHARE_CONTENT': 'share_content',
  'IDEA_SUBMIT': 'idea_submit',
  'DONATE_SUPPORT': 'donate_support',
};

const MAX_BATCH_SIZE = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
      console.error('[SyncFunRich] Neither FUN_PROFILE_INGEST_KEY nor ANGEL_AI_INGEST_KEY configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Parse optional body params
    let sourceRequestId: string | undefined;
    let forMint = false;
    try {
      const body = await req.json();
      sourceRequestId = body?.source_request_id;
      forMint = body?.for_mint === true;
    } catch {
      // No body or invalid JSON — that's fine
    }

    // Get FUN Profile ID from fun_id_links
    const { data: linkData } = await supabase
      .from('fun_id_links')
      .select('fun_profile_user_id')
      .eq('angel_user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const funProfileId = linkData?.fun_profile_user_id;
    if (!funProfileId) {
      return new Response(JSON.stringify({ 
        error: 'Chưa liên kết FUN Profile. Vui lòng liên kết FUN ID trước.',
        code: 'NO_FUN_LINK'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch unsynced scored actions (with scores)
    const { data: unsyncedActions, error: fetchError } = await supabase
      .from('pplp_actions')
      .select('id, action_type, evidence_hash, metadata, created_at, pplp_scores(light_score, final_reward)')
      .eq('actor_id', user.id)
      .eq('status', 'scored')
      .eq('synced_to_fun_rich', false)
      .order('created_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('[SyncFunRich] Fetch error:', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch actions' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!unsyncedActions || unsyncedActions.length === 0) {
      return new Response(JSON.stringify({ 
        status: 'no_actions',
        message: 'Không có hành động nào cần đồng bộ.',
        synced: 0, failed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Build batch payload ──
    // Split into chunks of MAX_BATCH_SIZE
    let totalSynced = 0;
    let totalFailed = 0;
    let totalDuplicates = 0;
    let totalLightScore = 0;
    const allErrors: string[] = [];
    const syncedActionIds: string[] = [];

    for (let i = 0; i < unsyncedActions.length; i += MAX_BATCH_SIZE) {
      const chunk = unsyncedActions.slice(i, i + MAX_BATCH_SIZE);

      const batchActions = chunk.map(action => {
        // FUN Profile validates uppercase action_type, then converts to lowercase internally
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
          evidence_hash: action.id, // Always use UUID, not hex evidence_hash
          source_platform: 'angel_ai',
          metadata: {
            content_preview: contentPreview,
            source: 'angel_ai',
            source_platform: 'angel_ai',
            original_action_id: action.id,
            created_at: action.created_at,
            for_mint: forMint,
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
          body: JSON.stringify({
            source_request_id: sourceRequestId || undefined,
            actions: batchActions,
          }),
        });

        const result = await res.json();

        if (res.ok && result.success) {
          const summary = result.summary || {};
          totalSynced += summary.ingested || 0;
          totalDuplicates += summary.duplicates || 0;
          totalFailed += summary.errors || 0;
          totalLightScore += summary.total_light_score || 0;

          // Mark successfully ingested actions as synced
          const ingestedResults = (result.results || []).filter((r: any) => r.status === 'ingested' || r.status === 'duplicate');
          for (const r of ingestedResults) {
            // Find original action by evidence_hash
            const originalAction = chunk.find(a => a.id === r.evidence_hash);
            if (originalAction) {
              syncedActionIds.push(originalAction.id);
            }
          }
        } else {
          // Batch-level failure — count all as failed
          totalFailed += chunk.length;
          allErrors.push(`Batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}: ${result.error || res.statusText}`);
        }
      } catch (err) {
        totalFailed += chunk.length;
        allErrors.push(`Batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}: ${String(err)}`);
      }
    }

    // Mark synced actions in DB
    if (syncedActionIds.length > 0) {
      const now = new Date().toISOString();
      // Update in chunks to avoid query size limits
      for (let i = 0; i < syncedActionIds.length; i += 50) {
        const idChunk = syncedActionIds.slice(i, i + 50);
        await supabase
          .from('pplp_actions')
          .update({ synced_to_fun_rich: true, synced_at: now })
          .in('id', idChunk);
      }
    }

    // Update mint request sync status if source_request_id provided
    if (sourceRequestId) {
      const syncStatus = totalSynced > 0 ? 'synced' : (totalFailed > 0 ? 'failed' : 'pending');
      const syncNote = `📊 Batch sync: ${totalSynced} ingested, ${totalDuplicates} duplicates, ${totalFailed} failed. Total Light Score: ${totalLightScore}.`;
      
      await supabase
        .from('pplp_mint_requests')
        .update({ 
          fun_profile_sync_status: syncStatus,
          destination_note: supabase.rpc ? undefined : syncNote, // Will be appended via separate update
        })
        .eq('id', sourceRequestId);

      // Update destination_note separately (append to existing)
      const { data: existingReq } = await supabase
        .from('pplp_mint_requests')
        .select('destination_note')
        .eq('id', sourceRequestId)
        .maybeSingle();

      if (existingReq) {
        await supabase
          .from('pplp_mint_requests')
          .update({ 
            destination_note: `${existingReq.destination_note || ''} | ${syncNote}`,
            fun_profile_sync_status: syncStatus,
          })
          .eq('id', sourceRequestId);
      }
    }

    console.log(`[SyncFunRich] User ${user.id}: batch_synced=${totalSynced}, duplicates=${totalDuplicates}, failed=${totalFailed}, light_score=${totalLightScore}, source=${sourceRequestId || 'manual'}`);

    return new Response(JSON.stringify({
      status: 'completed',
      total: unsyncedActions.length,
      synced: totalSynced,
      duplicates: totalDuplicates,
      failed: totalFailed,
      total_light_score: totalLightScore,
      source_request_id: sourceRequestId || null,
      errors: allErrors.length > 0 ? allErrors : undefined,
      redirect_url: 'https://fun.rich/wallet/fun_money',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[SyncFunRich] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
