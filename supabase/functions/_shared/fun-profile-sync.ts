/**
 * FUN Profile Sync Helper
 * 
 * Sends scored actions from Angel AI to FUN Profile (FUN.RICH) 
 * for cross-platform Light Economy integration.
 * 
 * Supports batch mode (up to 50 actions per request) for efficient sync.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

export interface SyncToFunProfileParams {
  fun_profile_id: string;
  action_type: string;
  light_score: number;
  evidence_hash: string;
  content_preview?: string;
  original_action_id?: string;
  created_at?: string;
}

export interface BatchSyncParams {
  actions: SyncToFunProfileParams[];
  source_request_id?: string;
}

export interface SyncResult {
  success: boolean;
  synced?: number;
  duplicates?: number;
  failed?: number;
  total_light_score?: number;
  error?: string;
}

/**
 * Send a batch of actions to FUN Profile's ingest API.
 * Uses FUN_PROFILE_INGEST_KEY and FUN_PROFILE_INGEST_URL secrets.
 * Max 50 actions per batch (enforced by FUN Profile).
 */
export async function batchSyncToFunProfile(params: BatchSyncParams): Promise<SyncResult> {
  const url = Deno.env.get('FUN_PROFILE_INGEST_URL');
  const key = Deno.env.get('FUN_PROFILE_INGEST_KEY') || Deno.env.get('ANGEL_AI_INGEST_KEY');

  if (!url || !key) {
    console.warn('[FunProfileSync] Missing FUN_PROFILE_INGEST_URL or ingest key');
    return { success: false, error: 'Missing configuration' };
  }

  const batchActions = params.actions.map(a => ({
    fun_profile_id: a.fun_profile_id,
    action_type: a.action_type.toUpperCase(),
    light_score: a.light_score,
    evidence_hash: a.evidence_hash,
    source_platform: 'angel_ai',
    metadata: {
      content_preview: a.content_preview || '',
      source: 'angel_ai',
      source_platform: 'angel_ai',
      original_action_id: a.original_action_id,
      created_at: a.created_at || new Date().toISOString(),
    },
  }));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify({
        source_request_id: params.source_request_id,
        actions: batchActions,
      }),
    });

    const result = await res.json();

    if (res.ok && result.success) {
      const summary = result.summary || {};
      console.log(`[FunProfileSync] ✅ Batch synced: ${summary.ingested || 0} ingested, ${summary.duplicates || 0} dups, ${summary.errors || 0} errors`);
      return {
        success: true,
        synced: summary.ingested || 0,
        duplicates: summary.duplicates || 0,
        failed: summary.errors || 0,
        total_light_score: summary.total_light_score || 0,
      };
    } else {
      console.warn(`[FunProfileSync] ❌ Batch failed: ${result.error || res.statusText}`);
      return { success: false, error: result.error || res.statusText };
    }
  } catch (err) {
    console.error('[FunProfileSync] Error:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Send a single action to FUN Profile (backward compatible wrapper).
 */
export async function syncActionToFunProfile(params: SyncToFunProfileParams): Promise<SyncResult> {
  return batchSyncToFunProfile({ actions: [params] });
}

/**
 * Look up the FUN Profile ID for an Angel AI user.
 */
export async function getFunProfileId(
  supabase: SupabaseClient,
  angelUserId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('fun_id_links')
    .select('fun_profile_user_id')
    .eq('angel_user_id', angelUserId)
    .eq('status', 'active')
    .maybeSingle();

  return data?.fun_profile_user_id || null;
}

/**
 * Auto-sync a scored action to FUN Profile if the user has a linked account.
 */
export async function autoSyncToFunProfile(
  supabase: SupabaseClient,
  actorId: string,
  actionId: string,
  actionType: string,
  lightScore: number,
  contentPreview?: string
): Promise<void> {
  try {
    const funProfileId = await getFunProfileId(supabase, actorId);
    if (!funProfileId) return;

    const result = await syncActionToFunProfile({
      fun_profile_id: funProfileId,
      action_type: actionType,
      light_score: lightScore,
      evidence_hash: actionId,
      content_preview: contentPreview,
      original_action_id: actionId,
    });

    if (result.success) {
      await supabase
        .from('pplp_actions')
        .update({ synced_to_fun_rich: true, synced_at: new Date().toISOString() })
        .eq('id', actionId);
    }
  } catch (err) {
    console.warn('[FunProfileSync] Auto-sync failed (non-fatal):', err);
  }
}
