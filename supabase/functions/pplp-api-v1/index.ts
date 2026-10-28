import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ========== Helpers ==========
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status: number, details?: unknown) {
  return jsonResponse({ code, message, details }, status);
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ========== Auth ==========
async function authenticateRequest(req: Request): Promise<{ userId: string; supabase: ReturnType<typeof createClient> } | Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceSupabase = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse('UNAUTHORIZED', 'Bearer token required', 401);
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Check if this is a service role key (for admin/system calls)
  if (token === serviceRoleKey) {
    return { userId: 'service_role', supabase: serviceSupabase };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claims, error } = await userClient.auth.getUser(token);
  if (error || !claims.user) {
    return errorResponse('UNAUTHORIZED', 'Invalid token', 401);
  }

  return { userId: claims.user.id, supabase: serviceSupabase };
}

// ========== Route Parser ==========
interface RouteMatch {
  operation: string;
  params: Record<string, string>;
}

function matchRoute(method: string, pathname: string): RouteMatch | null {
  // Strip the function prefix: /pplp-api-v1/...
  const path = pathname.replace(/^\/pplp-api-v1\/?/, '/');

  const routes: Array<{ method: string; pattern: RegExp; operation: string; paramNames: string[] }> = [
    { method: 'POST', pattern: /^\/actions\/?$/, operation: 'submitAction', paramNames: [] },
    { method: 'GET', pattern: /^\/actions\/([^/]+)\/?$/, operation: 'getAction', paramNames: ['actionId'] },
    { method: 'POST', pattern: /^\/actions\/([^/]+)\/proofs\/?$/, operation: 'attachProof', paramNames: ['actionId'] },
    { method: 'POST', pattern: /^\/actions\/([^/]+)\/validate\/?$/, operation: 'validateAction', paramNames: ['actionId'] },
    { method: 'POST', pattern: /^\/actions\/([^/]+)\/mint\/?$/, operation: 'mintAction', paramNames: ['actionId'] },
    { method: 'GET', pattern: /^\/users\/([^/]+)\/light-profile\/?$/, operation: 'getUserLightProfile', paramNames: ['userId'] },
    { method: 'POST', pattern: /^\/events\/?$/, operation: 'createEvent', paramNames: [] },
    { method: 'POST', pattern: /^\/events\/([^/]+)\/groups\/?$/, operation: 'createGroup', paramNames: ['eventId'] },
    { method: 'POST', pattern: /^\/events\/([^/]+)\/groups\/([^/]+)\/attendance\/?$/, operation: 'submitAttendance', paramNames: ['eventId', 'groupId'] },
  ];

  for (const route of routes) {
    if (route.method !== method) continue;
    const match = path.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
      return { operation: route.operation, params };
    }
  }
  return null;
}

// ========== Operation Handlers ==========

// POST /v1/actions — Submit a user action
async function handleSubmitAction(body: Record<string, unknown>, userId: string, supabase: ReturnType<typeof createClient>) {
  const { user_id, action_type, title, description, source_platform, source_url, metadata } = body;

  if (!action_type || !title) {
    return errorResponse('VALIDATION_ERROR', 'action_type and title are required', 400);
  }

  // Validate action_type against action_types lookup table
  const { data: actionTypeDef, error: atError } = await supabase
    .from('action_types')
    .select('code, pillar_group, base_impact_score')
    .eq('code', action_type as string)
    .eq('is_active', true)
    .single();

  if (atError || !actionTypeDef) {
    return errorResponse('INVALID_ACTION_TYPE', `Unknown or inactive action_type: ${action_type}`, 400);
  }

  const actorId = (user_id && typeof user_id === 'string') ? user_id : userId;

  // Get active policy
  const { data: policy } = await supabase
    .from('pplp_policies')
    .select('version')
    .eq('is_active', true)
    .single();

  const { data: action, error } = await supabase
    .from('pplp_actions')
    .insert({
      platform_id: source_platform || 'ANGEL_AI',
      action_type: action_type as string,
      actor_id: actorId,
      metadata: {
        title,
        description: description || null,
        source_url: source_url || null,
        source_platform: source_platform || null,
        pillar_group: actionTypeDef.pillar_group,
        base_impact_score: actionTypeDef.base_impact_score,
        ...(metadata as Record<string, unknown> || {}),
      },
      impact: {},
      integrity: { source_verified: true },
      policy_version: policy?.version || '1.0',
      policy_snapshot: { version: policy?.version || '1.0' },
      status: 'pending',
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    console.error('[API-v1] submitAction error:', error);
    return errorResponse('INSERT_FAILED', error.message, 500);
  }

  // ===== Auto-Proof for on-platform actions =====
  const ON_PLATFORM_ACTIONS = new Set([
    'QUESTION_ASK', 'JOURNAL_WRITE', 'GRATITUDE_PRACTICE', 'DAILY_RITUAL',
    'CONTENT_CREATE', 'CONTENT_REVIEW', 'CONTENT_SHARE', 'COMMENT_CREATE',
    'POST_ENGAGEMENT', 'DONATE', 'CAMPAIGN_SUPPORT', 'CAMPAIGN_CREATE',
    'GOV_VOTE', 'GOV_PROPOSAL', 'POLICY_REVIEW', 'BUG_BOUNTY',
    'PRODUCT_REVIEW', 'PROFILE_COMPLETE', 'KYC_VERIFY',
    'LEARN_COMPLETE', 'QUIZ_PASS', 'COURSE_CREATE', 'PROJECT_SUBMIT',
    'MENTOR_HELP', 'DISPUTE_RESOLVE', 'REFERRAL_INVITE',
    'STAKE_LOCK', 'LIQUIDITY_PROVIDE', 'REPUTATION_EARN',
  ]);

  let autoProofAttached = false;
  if (ON_PLATFORM_ACTIONS.has(action_type as string)) {
    try {
      const proofMeta: Record<string, unknown> = {
        auto_generated: true,
        action_type: action_type,
        actor_id: actorId,
        timestamp: new Date().toISOString(),
        source_platform: source_platform || 'ANGEL_AI',
      };
      // Include relevant metadata as proof evidence
      if ((metadata as Record<string, unknown>)?.question_id) proofMeta.question_id = (metadata as Record<string, unknown>).question_id;
      if ((metadata as Record<string, unknown>)?.journal_id) proofMeta.journal_id = (metadata as Record<string, unknown>).journal_id;
      if ((metadata as Record<string, unknown>)?.post_id) proofMeta.post_id = (metadata as Record<string, unknown>).post_id;
      if ((metadata as Record<string, unknown>)?.comment_id) proofMeta.comment_id = (metadata as Record<string, unknown>).comment_id;
      if ((metadata as Record<string, unknown>)?.transaction_id) proofMeta.transaction_id = (metadata as Record<string, unknown>).transaction_id;
      if (source_url) proofMeta.source_url = source_url;
      if (title) proofMeta.title = title;

      const { error: proofError } = await supabase
        .from('proofs')
        .insert({
          action_id: action.id,
          proof_type: 'system_log',
          proof_url: source_url || `system://action/${action.id}`,
          external_ref: null,
          metadata: proofMeta,
          status: 'pending',
        });

      if (proofError) {
        console.warn('[API-v1] Auto-proof insert failed:', proofError);
      } else {
        autoProofAttached = true;
        console.log(`[API-v1] Auto-proof attached for ${action_type} action ${action.id}`);
      }
    } catch (e) {
      console.warn('[API-v1] Auto-proof error:', e);
    }
  }

  // Auto-trigger scoring
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    await fetch(`${supabaseUrl}/functions/v1/pplp-score-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ action_id: action.id }),
    });
  } catch (e) {
    console.warn('[API-v1] Auto-scoring failed:', e);
  }

  const responseStatus = autoProofAttached ? 'submitted' : 'proof_pending';

  return jsonResponse({
    action_id: action.id,
    status: responseStatus,
    auto_proof: autoProofAttached,
    created_at: action.created_at,
  }, 201);
}

// GET /v1/actions/:actionId — Get action detail
async function handleGetAction(actionId: string, supabase: ReturnType<typeof createClient>) {
  if (!isUUID(actionId)) return errorResponse('INVALID_ID', 'Invalid action ID format', 400);

  const { data: action, error } = await supabase
    .from('pplp_actions')
    .select('*')
    .eq('id', actionId)
    .single();

  if (error || !action) return errorResponse('NOT_FOUND', 'Action not found', 404);

  // Fetch proofs
  const { data: proofs } = await supabase
    .from('proofs')
    .select('id, action_id, proof_type, proof_url, external_ref, created_at')
    .eq('action_id', actionId);

  const metadata = action.metadata as Record<string, unknown> || {};

  return jsonResponse({
    action_id: action.id,
    status: mapActionStatus(action.status),
    created_at: action.created_at,
    user_id: action.actor_id,
    action_type: action.action_type,
    title: metadata.title || action.action_type,
    description: metadata.description || null,
    source_platform: metadata.source_platform || action.platform_id,
    source_url: metadata.source_url || null,
    metadata: metadata,
    proofs: (proofs || []).map(p => ({
      proof_id: p.id,
      action_id: p.action_id,
      proof_type: p.proof_type,
      proof_url: p.proof_url,
      external_ref: p.external_ref,
      created_at: p.created_at,
    })),
  });
}

// POST /v1/actions/:actionId/proofs — Attach proof
async function handleAttachProof(actionId: string, body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  if (!isUUID(actionId)) return errorResponse('INVALID_ID', 'Invalid action ID format', 400);

  const { proof_type, proof_url, external_ref, metadata } = body;
  if (!proof_type) return errorResponse('VALIDATION_ERROR', 'proof_type is required', 400);

  const validProofTypes = ['link', 'video', 'image', 'document', 'onchain_tx', 'system_log', 'manual_attestation'];
  if (!validProofTypes.includes(proof_type as string)) {
    return errorResponse('VALIDATION_ERROR', `proof_type must be one of: ${validProofTypes.join(', ')}`, 400);
  }

  // Verify action exists
  const { data: action } = await supabase.from('pplp_actions').select('id').eq('id', actionId).single();
  if (!action) return errorResponse('NOT_FOUND', 'Action not found', 404);

  // Check for duplicate proof (same action + same URL)
  if (proof_url) {
    const { data: existing } = await supabase
      .from('proofs')
      .select('id')
      .eq('action_id', actionId)
      .eq('proof_url', proof_url as string)
      .maybeSingle();
    if (existing) return errorResponse('DUPLICATE', 'This proof URL is already attached to this action', 409);
  }

  const { data: proof, error } = await supabase
    .from('proofs')
    .insert({
      action_id: actionId,
      proof_type: proof_type as string,
      proof_url: (proof_url as string) || null,
      external_ref: (external_ref as string) || null,
      metadata: metadata || {},
      status: 'pending',
    })
    .select('id, action_id, proof_type, proof_url, external_ref, created_at')
    .single();

  if (error) {
    console.error('[API-v1] attachProof error:', error);
    return errorResponse('INSERT_FAILED', error.message, 500);
  }

  return jsonResponse({
    proof_id: proof.id,
    action_id: proof.action_id,
    proof_type: proof.proof_type,
    proof_url: proof.proof_url,
    external_ref: proof.external_ref,
    created_at: proof.created_at,
  }, 201);
}

// POST /v1/actions/:actionId/validate — Trigger validation
async function handleValidateAction(actionId: string, body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  if (!isUUID(actionId)) return errorResponse('INVALID_ID', 'Invalid action ID format', 400);

  const { data: action } = await supabase.from('pplp_actions').select('id, status').eq('id', actionId).single();
  if (!action) return errorResponse('NOT_FOUND', 'Action not found', 404);

  if (!['pending', 'submitted', 'proof_pending'].includes(action.status)) {
    return errorResponse('INVALID_STATE', `Action is in '${action.status}' state and cannot be validated`, 409);
  }

  // Call pplp-score-action
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const scoreResponse = await fetch(`${supabaseUrl}/functions/v1/pplp-score-action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      action_id: actionId,
      force_manual_review: body.force_manual_review || false,
      notes: body.notes || null,
    }),
  });

  const scoreResult = await scoreResponse.json();

  // Fetch updated scores
  const { data: scores } = await supabase
    .from('pplp_scores')
    .select('pillar_s, pillar_t, pillar_h, pillar_c, pillar_u, light_score, quality_multiplier, impact_multiplier, integrity_multiplier')
    .eq('action_id', actionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Calculate consistency_multiplier from streak
  const { data: streakData } = await supabase
    .from('daily_login_tracking')
    .select('streak_count')
    .eq('user_id', (await supabase.from('pplp_actions').select('actor_id').eq('id', actionId).single()).data?.actor_id || '')
    .order('login_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const streakDays = streakData?.streak_count || 0;
  const consistencyMultiplier = Math.round((1.0 + Math.min(streakDays * 0.01, 0.2)) * 100) / 100;

  // Normalize explanation to { notes: [...] } format
  const rawExplanation = scoreResult.explanation || {};
  const explanation = Array.isArray(rawExplanation?.notes)
    ? rawExplanation
    : { notes: typeof rawExplanation === 'string' ? [rawExplanation] : rawExplanation.notes ? [rawExplanation.notes] : Object.keys(rawExplanation).length > 0 ? [JSON.stringify(rawExplanation)] : [] };

  return jsonResponse({
    action_id: actionId,
    validation_status: scoreResult.decision === 'pass' ? 'validated' : scoreResult.error === 'TRUTH_GATE_FLAGGED' ? 'flagged' : scoreResult.decision === 'fail' ? 'rejected' : 'pending',
    pplp_scores: scores ? {
      serving_life: (scores.pillar_s || 0) / 10,
      transparent_truth: (scores.pillar_t || 0) / 10,
      healing_love: (scores.pillar_h || 0) / 10,
      long_term_value: (scores.pillar_c || 0) / 10,
      unity_over_separation: (scores.pillar_u || 0) / 10,
    } : null,
    raw_light_score: scoreResult.light_score || 0,
    impact_weight: scores?.impact_multiplier || 1.0,
    trust_multiplier: scores?.integrity_multiplier || 1.0,
    consistency_multiplier: consistencyMultiplier,
    final_light_score: scoreResult.light_score || 0,
    ai_score: scoreResult.ai_score || null,
    community_score: scoreResult.community_score || null,
    trust_signal_score: scoreResult.trust_signal_score || null,
    flags: scoreResult.fail_reasons || [],
    explanation,
  });
}

// POST /v1/actions/:actionId/mint — Mint FUN for validated action
async function handleMintAction(actionId: string, body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  if (!isUUID(actionId)) return errorResponse('INVALID_ID', 'Invalid action ID format', 400);

  const { data: action } = await supabase
    .from('pplp_actions')
    .select('id, status, actor_id')
    .eq('id', actionId)
    .single();
  if (!action) return errorResponse('NOT_FOUND', 'Action not found', 404);

  if (!['scored', 'validated'].includes(action.status)) {
    return errorResponse('INVALID_STATE', `Action must be validated before minting. Current status: ${action.status}`, 409);
  }

  // Call pplp-claim-fun
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const claimResponse = await fetch(`${supabaseUrl}/functions/v1/pplp-claim-fun`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({
      action_id: actionId,
      user_id: action.actor_id,
      release_mode: body.release_mode || 'instant',
      claim_percent: body.claim_percent || 100,
    }),
  });

  const claimResult = await claimResponse.json();

  if (!claimResponse.ok) {
    return errorResponse('MINT_FAILED', claimResult.error || 'Mint failed', claimResponse.status);
  }

  const releaseMode = (body.release_mode as string) || 'instant';
  const claimPercent = typeof body.claim_percent === 'number' ? body.claim_percent : 100;
  const userAmount = claimResult.user_amount || 0;

  let claimableNow = userAmount;
  let lockedAmount = 0;

  if (releaseMode === 'partial_lock' && claimPercent < 100) {
    claimableNow = Math.round(userAmount * (claimPercent / 100));
    lockedAmount = userAmount - claimableNow;
  } else if (releaseMode === 'full_lock') {
    claimableNow = 0;
    lockedAmount = userAmount;
  }

  return jsonResponse({
    action_id: actionId,
    mint_record_id: claimResult.mint_request_id || claimResult.id || null,
    light_score: claimResult.light_score || 0,
    mint_amount_total: claimResult.total_reward || 0,
    mint_amount_user: userAmount,
    mint_amount_platform: claimResult.platform_amount || 0,
    release_mode: releaseMode,
    claimable_now: claimableNow,
    locked_amount: lockedAmount,
    tx_hash: claimResult.tx_hash || null,
    status: claimResult.success ? 'minted' : 'pending',
  });
}

// GET /v1/users/:userId/light-profile
async function handleGetUserLightProfile(userId: string, supabase: ReturnType<typeof createClient>) {
  if (!isUUID(userId)) return errorResponse('INVALID_ID', 'Invalid user ID format', 400);

  // Fetch latest ledger entry
  const { data: ledger } = await supabase
    .from('light_score_ledger')
    .select('level, trend, final_light_score, period')
    .eq('user_id', userId)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch streak
  const { data: loginData } = await supabase
    .from('daily_login_tracking')
    .select('streak_count')
    .eq('user_id', userId)
    .order('login_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch total minted FUN
  const { data: mintData } = await supabase
    .from('fun_distribution_logs')
    .select('user_amount')
    .eq('actor_id', userId);

  const totalFunMinted = (mintData || []).reduce((sum, r) => sum + (r.user_amount || 0), 0);

  // Fetch recent actions count (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentActions } = await supabase
    .from('pplp_actions')
    .select('*', { count: 'exact', head: true })
    .eq('actor_id', userId)
    .gte('created_at', thirtyDaysAgo);

  // Fetch pillar averages from recent scores
  const { data: scores } = await supabase
    .from('pplp_scores')
    .select('pillar_s, pillar_t, pillar_h, pillar_c, pillar_u')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  let pillarSummary = null;
  if (scores && scores.length > 0) {
    const count = scores.length;
    pillarSummary = {
      serving_life_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_s || 0), 0) / count / 10) * 100) / 100,
      transparent_truth_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_t || 0), 0) / count / 10) * 100) / 100,
      healing_love_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_h || 0), 0) / count / 10) * 100) / 100,
      long_term_value_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_c || 0), 0) / count / 10) * 100) / 100,
      unity_over_separation_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_u || 0), 0) / count / 10) * 100) / 100,
    };
  }

  // Calculate trust level from history
  const trustLevel = Math.min(10, (loginData?.streak_count || 0) * 0.1 + (recentActions || 0) * 0.05 + (scores?.length || 0) * 0.02);

  return jsonResponse({
    user_id: userId,
    trust_level: Math.round(trustLevel * 100) / 100,
    total_light_score: ledger?.final_light_score || 0,
    total_fun_minted: totalFunMinted,
    streak_days: loginData?.streak_count || 0,
    recent_actions: recentActions || 0,
    pillar_summary: pillarSummary,
  });
}

// POST /v1/events — Create event
async function handleCreateEvent(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { event_type, title, host_user_id, started_at, ended_at, source_platform, zoom_meeting_id, livestream_links, metadata } = body;

  if (!event_type || !title || !host_user_id || !started_at || !ended_at || !source_platform) {
    return errorResponse('VALIDATION_ERROR', 'event_type, title, host_user_id, started_at, ended_at, and source_platform are required', 400);
  }

  const validEventTypes = ['ZOOM_GROUP_MEDITATION', 'LIVESTREAM_SESSION', 'IN_PERSON_GROUP', 'COMMUNITY_EVENT'];
  if (!validEventTypes.includes(event_type as string)) {
    return errorResponse('VALIDATION_ERROR', `event_type must be one of: ${validEventTypes.join(', ')}`, 400);
  }

  // Calculate duration
  const startMs = new Date(started_at as string).getTime();
  const endMs = new Date(ended_at as string).getTime();
  const durationMinutes = Math.round((endMs - startMs) / 60000);

  const { data: event, error } = await supabase
    .from('attendance_events')
    .insert({
      event_type: (event_type as string).toLowerCase(),
      title: title as string,
      host_user_id: host_user_id as string,
      event_date: started_at as string,
      duration_minutes: durationMinutes > 0 ? durationMinutes : 60,
      zoom_link: zoom_meeting_id ? `https://zoom.us/j/${zoom_meeting_id}` : null,
      meeting_id: zoom_meeting_id as string || null,
      livestream_link: Array.isArray(livestream_links) && livestream_links.length > 0
        ? (livestream_links[0] as Record<string, unknown>).url as string
        : null,
      metadata: {
        source_platform,
        started_at,
        ended_at,
        livestream_links: livestream_links || [],
        ...(metadata as Record<string, unknown> || {}),
      },
      status: 'active',
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    console.error('[API-v1] createEvent error:', error);
    return errorResponse('INSERT_FAILED', error.message, 500);
  }

  return jsonResponse({
    event_id: event.id,
    status: 'created',
    created_at: event.created_at,
  }, 201);
}

// POST /v1/events/:eventId/groups — Create group
async function handleCreateGroup(eventId: string, body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  if (!isUUID(eventId)) return errorResponse('INVALID_ID', 'Invalid event ID format', 400);

  const { group_name, leader_user_id, estimated_participants, metadata } = body;
  if (!group_name || !leader_user_id) {
    return errorResponse('VALIDATION_ERROR', 'group_name and leader_user_id are required', 400);
  }

  // Verify event exists
  const { data: event } = await supabase.from('attendance_events').select('id').eq('id', eventId).single();
  if (!event) return errorResponse('NOT_FOUND', 'Event not found', 404);

  const { data: group, error } = await supabase
    .from('pplp_groups')
    .insert({
      event_id: eventId,
      group_name: group_name as string,
      leader_user_id: leader_user_id as string,
      estimated_participants: (estimated_participants as number) || 1,
      metadata: metadata || {},
    })
    .select('id, event_id, group_name, leader_user_id, estimated_participants, created_at')
    .single();

  if (error) {
    console.error('[API-v1] createGroup error:', error);
    return errorResponse('INSERT_FAILED', error.message, 500);
  }

  return jsonResponse({
    group_id: group.id,
    event_id: group.event_id,
    group_name: group.group_name,
    leader_user_id: group.leader_user_id,
    estimated_participants: group.estimated_participants,
    created_at: group.created_at,
  }, 201);
}

// POST /v1/events/:eventId/groups/:groupId/attendance — Submit attendance
async function handleSubmitAttendance(
  eventId: string,
  groupId: string,
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
) {
  if (!isUUID(eventId)) return errorResponse('INVALID_ID', 'Invalid event ID', 400);
  if (!isUUID(groupId)) return errorResponse('INVALID_ID', 'Invalid group ID', 400);

  const { user_id, check_in_at, check_out_at, attendance_mode, optional_signals } = body;
  if (!user_id || !attendance_mode) {
    return errorResponse('VALIDATION_ERROR', 'user_id and attendance_mode are required', 400);
  }

  const validModes = ['direct_checkin', 'system_log', 'group_leader_confirmed', 'hybrid'];
  if (!validModes.includes(attendance_mode as string)) {
    return errorResponse('VALIDATION_ERROR', `attendance_mode must be one of: ${validModes.join(', ')}`, 400);
  }

  // Verify event and group exist
  const [{ data: event }, { data: group }] = await Promise.all([
    supabase.from('attendance_events').select('id, duration_minutes').eq('id', eventId).single(),
    supabase.from('pplp_groups').select('id, leader_user_id').eq('id', groupId).eq('event_id', eventId).single(),
  ]);

  if (!event) return errorResponse('NOT_FOUND', 'Event not found', 404);
  if (!group) return errorResponse('NOT_FOUND', 'Group not found for this event', 404);

  const signals = (optional_signals as Record<string, unknown>) || {};
  const isLeaderConfirmed = attendance_mode === 'group_leader_confirmed' || attendance_mode === 'hybrid';

  // Calculate attendance confidence based on available signals
  let confidence = 0;
  if (check_in_at) confidence += 0.25;
  if (check_out_at) confidence += 0.20;
  if (isLeaderConfirmed) confidence += 0.25;
  if (signals.post_session_reflection_submitted) confidence += 0.15;
  // Duration check
  if (check_in_at && check_out_at) {
    const checkinMs = new Date(check_in_at as string).getTime();
    const checkoutMs = new Date(check_out_at as string).getTime();
    const attendedMinutes = (checkoutMs - checkinMs) / 60000;
    if (attendedMinutes >= (event.duration_minutes || 60) * 0.8) confidence += 0.10;
  }
  if (signals.presence_snapshot_count && (signals.presence_snapshot_count as number) > 0) confidence += 0.05;

  confidence = Math.min(1.0, confidence);

  const { data: attendance, error } = await supabase
    .from('pplp_attendance')
    .insert({
      event_id: eventId,
      group_id: groupId,
      user_id: user_id as string,
      check_in_at: (check_in_at as string) || null,
      check_out_at: (check_out_at as string) || null,
      leader_confirmed: isLeaderConfirmed,
      reflection_submitted: !!signals.post_session_reflection_submitted,
      presence_signal: signals.presence_snapshot_count ? true : false,
      participation_factor: confidence,
      metadata: { attendance_mode, optional_signals: signals },
    })
    .select('id, event_id, created_at')
    .single();

  if (error) {
    console.error('[API-v1] submitAttendance error:', error);
    return errorResponse('INSERT_FAILED', error.message, 500);
  }

  return jsonResponse({
    attendance_id: attendance.id,
    event_id: eventId,
    group_id: groupId,
    user_id: user_id,
    attendance_confidence: Math.round(confidence * 100) / 100,
    created_at: attendance.created_at,
  }, 201);
}

// ========== Status Mapping ==========
function mapActionStatus(dbStatus: string): string {
  const statusMap: Record<string, string> = {
    pending: 'submitted',
    scored: 'validated',
    minted: 'minted',
    rejected: 'rejected',
    flagged: 'flagged',
    proof_pending: 'proof_pending',
    under_review: 'under_review',
  };
  return statusMap[dbStatus] || dbStatus;
}

// ========== Main Server ==========
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const route = matchRoute(req.method, url.pathname);

    if (!route) {
      return errorResponse('NOT_FOUND', `No route matched: ${req.method} ${url.pathname}`, 404);
    }

    // Authenticate
    const auth = await authenticateRequest(req);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    // Parse body for POST/PUT/PATCH
    let body: Record<string, unknown> = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    // Route to handler
    switch (route.operation) {
      case 'submitAction':
        return await handleSubmitAction(body, userId, supabase);
      case 'getAction':
        return await handleGetAction(route.params.actionId, supabase);
      case 'attachProof':
        return await handleAttachProof(route.params.actionId, body, supabase);
      case 'validateAction':
        return await handleValidateAction(route.params.actionId, body, supabase);
      case 'mintAction':
        return await handleMintAction(route.params.actionId, body, supabase);
      case 'getUserLightProfile':
        return await handleGetUserLightProfile(route.params.userId, supabase);
      case 'createEvent':
        return await handleCreateEvent(body, supabase);
      case 'createGroup':
        return await handleCreateGroup(route.params.eventId, body, supabase);
      case 'submitAttendance':
        return await handleSubmitAttendance(route.params.eventId, route.params.groupId, body, supabase);
      default:
        return errorResponse('NOT_IMPLEMENTED', `Operation ${route.operation} not implemented`, 501);
    }
  } catch (error) {
    console.error('[API-v1] Unhandled error:', error);
    return errorResponse('INTERNAL_ERROR', error instanceof Error ? error.message : 'Unknown error', 500);
  }
});
