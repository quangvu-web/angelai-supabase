import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getPolicyBaseReward } from "../_shared/pplp-helper.ts";
import { autoSyncToFunProfile } from "../_shared/fun-profile-sync.ts";
import {
  computePreDecision,
  finalizeLegacyScore,
  ACTION_IMPACT_WEIGHTS,
  PPLP_CONSTANTS,
  type CoreActionData,
  type CoreAiAnalysis,
  type CoreCapsConfig,
} from "../_shared/pplp-core.ts";
import {
  isExperimentalAnalyzerEnabled,
  resolveActionContent,
  sha256Hex,
  MIN_ANALYZER_CONTENT_LENGTH,
  type MinimalClient,
  type ResolverAction,
} from "../_shared/pplp-content-resolver.ts";
import {
  ANALYZER_REASONS,
  logAnalyzerObservation,
  reasonFromResolver,
  type AnalyzerReason,
} from "../_shared/pplp-analyzer-reasons.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type ActionData = CoreActionData;

interface ActionCapsConfig {
  action_type: string;
  platform_id: string;
  base_reward: number;
  max_per_user_daily: number | null;
  max_per_user_weekly: number | null;
  max_global_daily: number | null;
  cooldown_seconds: number;
  diminishing_threshold: number;
  diminishing_factor: number;
  min_quality_score: number;
  thresholds: Record<string, number>;
  multiplier_ranges: { Q: [number, number]; I: [number, number]; K: [number, number] };
  is_active: boolean;
}

// ========== PPLP Engine v2.5 — VVU Formula ==========
// All pure scoring maths now live in ../_shared/pplp-core.ts (Batch 1 refactor).
// Behaviour is byte-equivalent — verified against __golden__/golden.json (30/30).
let MIN_LIGHT_SCORE = 0.1;
let MATH_PARAMS: Record<string, number> = {};


async function loadScoringParams(supabase: ReturnType<typeof createClient<any>>) {
  try {
    // TIMELOCK: Only load rules where effective_after has passed (or is null for legacy rules)
    const { data: rule } = await supabase
      .from('scoring_rules')
      .select('formula_json')
      .eq('status', 'active')
      .or('effective_after.is.null,effective_after.lte.' + new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const formulaJson = (rule as { formula_json?: Record<string, unknown> } | null)?.formula_json;
    if (formulaJson) {
      const f = formulaJson as Record<string, unknown>;
      if (f.min_light_score) MIN_LIGHT_SCORE = Number(f.min_light_score);
      // Store all math params for later use
      MATH_PARAMS = {
        gamma: Number(f.gamma ?? 1.3),
        omega_B: Number(f.omega_B ?? 0.4),
        omega_C: Number(f.omega_C ?? 0.6),
        min_ratings: Number(f.min_ratings ?? 3),
      };
    }
  } catch (e) {
    console.error('[PPLP] Failed to load scoring params:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load math params from scoring_rules
    await loadScoringParams(supabase);

    const {
      action_id,
      force_rescore = false,
      skip_side_effects = false,
    } = await req.json();

    if (!action_id) {
      return new Response(
        JSON.stringify({ error: 'action_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== 1. Fetch the action ==========
    const { data: action, error: actionError } = await supabase
      .from('pplp_actions')
      .select('*')
      .eq('id', action_id)
      .single();

    if (actionError || !action) {
      return new Response(
        JSON.stringify({ error: 'Action not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingScore } = await supabase
      .from('pplp_scores')
      .select('id, scoring_engine_version')
      .eq('action_id', action_id)
      .maybeSingle();
    const hasHistoricalScore = !!existingScore;

    const previousStatus = action.status;

    if (!force_rescore && action.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Action already scored',
          current_status: action.status,
          action_id: action.id,
          decision: action.status === 'minted' ? 'pass' : 'pass',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STALE ACTION REJECT (Oracle Integrity Layer) ==========
    // Reject actions older than 24 hours to prevent delayed replay attacks
    const actionCreatedAt = new Date(action.created_at).getTime();
    const now = Date.now();
    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
    if (!force_rescore && now - actionCreatedAt > STALE_THRESHOLD_MS) {
      // Mark action as rejected in DB
      await supabase
        .from('pplp_actions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', action_id);
      
      console.warn(`[PPLP] Stale action rejected: ${action_id}, age=${Math.round((now - actionCreatedAt) / 3600000)}h`);
      return new Response(
        JSON.stringify({ 
          error: 'Action is stale (older than 24 hours)',
          action_id: action.id,
          created_at: action.created_at,
          age_hours: Math.round((now - actionCreatedAt) / 3600000),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== 1b. PPLP ACCEPTANCE GATE ==========
    // Users must accept PPLP charter before their actions can be scored
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('pplp_accepted_at, display_name')
      .eq('user_id', action.actor_id)
      .maybeSingle();

    if (!actorProfile?.pplp_accepted_at && !(force_rescore && hasHistoricalScore)) {
      // Mark action as rejected — user hasn't accepted PPLP
      await supabase
        .from('pplp_actions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', action_id);

      // Send gentle healing message reminder (max 1 per day to avoid spam)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingReminder } = await supabase
        .from('healing_messages')
        .select('id')
        .eq('user_id', action.actor_id)
        .eq('message_type', 'pplp_reminder')
        .gte('created_at', oneDayAgo)
        .maybeSingle();

      if (!existingReminder) {
        await supabase.from('healing_messages').insert({
          user_id: action.actor_id,
          title: '🌱 Hãy ký Hiến chương Ánh sáng (PPLP)',
          content: 'Bạn ơi, để đóng góp của bạn được ghi nhận và tích lũy Light Score, hãy ký chấp thuận Hiến chương PPLP nhé. Chỉ cần vài giây thôi — mỗi hành động tốt đẹp của bạn đều xứng đáng được tỏa sáng! ✨\n\n👉 Mở đường dẫn này để ký ngay: /auth (nhấn nút "Ký Hiến chương ngay" trong thông báo).',
          message_type: 'pplp_reminder',
          triggered_by: 'pplp-score-action',
        });
      }

      console.log(`[PPLP] Action ${action_id} skipped: user ${action.actor_id} has not accepted PPLP`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PPLP_NOT_ACCEPTED',
          message: 'User has not accepted PPLP charter. A gentle reminder has been sent.',
          action_id: action.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== 2. Fetch action caps config from DB ==========
    const { data: capsConfig } = await supabase
      .from('pplp_action_caps')
      .select('*')
      .eq('action_type', action.action_type)
      .eq('is_active', true)
      .maybeSingle();

    // Default config if not found
    const config: ActionCapsConfig = capsConfig || {
      action_type: action.action_type,
      platform_id: 'ALL',
      base_reward: 100,
      max_per_user_daily: 10,
      max_per_user_weekly: 50,
      max_global_daily: null,
      cooldown_seconds: 0,
      diminishing_threshold: 5,
      diminishing_factor: 0.8,
      min_quality_score: 0.5,
      thresholds: { T: 30, LightScore: 15 },
      multiplier_ranges: { Q: [0.5, 3.0], I: [0.5, 5.0], K: [0.0, 1.0] },
      is_active: true,
    };

    // ========== 2b. GLOBAL DAILY CAP (Pseudocode §9) ==========
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: dailyScoredCount } = await supabase
      .from('pplp_actions')
      .select('*', { count: 'exact', head: true })
      .eq('actor_id', action.actor_id)
      .in('status', ['scored', 'minted', 'validated'])
      .gte('created_at', todayStart.toISOString());

    if ((dailyScoredCount ?? 0) >= PPLP_CONSTANTS.MAX_SCORED_ACTIONS_PER_DAY) {
      await supabase
        .from('pplp_actions')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', action_id);
      console.warn(`[PPLP] Global daily cap reached for user ${action.actor_id}: ${dailyScoredCount}/${PPLP_CONSTANTS.MAX_SCORED_ACTIONS_PER_DAY}`);
      return new Response(
        JSON.stringify({ success: false, error: 'DAILY_CAP_REACHED', message: `Maximum ${PPLP_CONSTANTS.MAX_SCORED_ACTIONS_PER_DAY} scored actions per day.` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== 2c. HIGH-IMPACT DAILY CAP (Pseudocode §9) ==========
    if (PPLP_CONSTANTS.HIGH_IMPACT_ACTION_TYPES.includes(action.action_type)) {
      const { count: highImpactCount } = await supabase
        .from('pplp_actions')
        .select('*', { count: 'exact', head: true })
        .eq('actor_id', action.actor_id)
        .in('status', ['scored', 'minted', 'validated'])
        .in('action_type', PPLP_CONSTANTS.HIGH_IMPACT_ACTION_TYPES)
        .gte('created_at', todayStart.toISOString());

      if ((highImpactCount ?? 0) >= PPLP_CONSTANTS.MAX_HIGH_IMPACT_ACTIONS_PER_DAY) {
        await supabase
          .from('pplp_actions')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', action_id);
        console.warn(`[PPLP] High-impact daily cap reached for user ${action.actor_id}: ${highImpactCount}/${PPLP_CONSTANTS.MAX_HIGH_IMPACT_ACTIONS_PER_DAY}`);
        return new Response(
          JSON.stringify({ success: false, error: 'HIGH_IMPACT_CAP_REACHED', message: `Maximum ${PPLP_CONSTANTS.MAX_HIGH_IMPACT_ACTIONS_PER_DAY} high-impact actions per day.` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== 3. AI Pillar Analysis FIRST for content actions ==========
    let aiAnalysis: { pillars: { repentance: number; gratitude: number; service: number; helping: number; giving: number }; pillars_legacy: { truth: number; sustain: number; heal: number; service: number; unity: number }; nlp_features: { gratitude_score: number; repentance_score: number; ego_signal: number; authenticity: number; love_tone: number; depth: number }; ego_risk: number; explanation: string } | null = null;
    const contentActionTypes = ['POST_CREATE', 'COMMENT_CREATE', 'JOURNAL_WRITE', 'QUESTION_ASK', 'CONTENT_CREATE'];
    if (!skip_side_effects && contentActionTypes.includes(action.action_type)) {
      const startedAt = Date.now();
      let analyzerStatus: AnalyzerReason = ANALYZER_REASONS.ANALYZER_SUCCESS;
      let httpStatus: number | null = null;
      let contentSource: string | null = null;
      let contentLength = 0;
      let contentHash: string | null = null;
      let attempted = false;
      try {
        let contentText = action.metadata?.content_text || action.metadata?.question_text || action.metadata?.content || '';
        if (typeof contentText === 'string' && contentText.length >= MIN_ANALYZER_CONTENT_LENGTH) {
          contentSource = 'metadata';
        } else {
          analyzerStatus = ANALYZER_REASONS.CONTENT_EMPTY;
          // EXPERIMENTAL (default OFF): resolve text from the source entity by reference.
          // Read-only + ephemeral — the text is never persisted back into metadata.
          if (isExperimentalAnalyzerEnabled(Deno.env.get('PPLP_EXPERIMENTAL_ANALYZER'))) {
            const resolved = await resolveActionContent(
              supabase as unknown as MinimalClient,
              action as unknown as ResolverAction,
            );
            if (resolved.content && resolved.content.length >= MIN_ANALYZER_CONTENT_LENGTH) {
              contentText = resolved.content;
              contentSource = resolved.source;
              analyzerStatus = ANALYZER_REASONS.ANALYZER_SUCCESS;
            } else {
              analyzerStatus = reasonFromResolver(resolved.status);
            }
          }
        }

        if (typeof contentText === 'string' && contentText.length >= MIN_ANALYZER_CONTENT_LENGTH) {
          contentLength = contentText.length;
          contentHash = await sha256Hex(contentText);
          attempted = true;
          const aiResponse = await fetch(`${supabaseUrl}/functions/v1/pplp-ai-pillar-analyzer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              content: contentText,
              content_type: action.action_type,
            }),
          });
          httpStatus = aiResponse.status;
          if (aiResponse.ok) {
            aiAnalysis = await aiResponse.json();
            analyzerStatus = ANALYZER_REASONS.ANALYZER_SUCCESS;
            console.log(`[PPLP] AI analysis (pre-score): pillars=${JSON.stringify(aiAnalysis?.pillars)}, ego=${aiAnalysis?.ego_risk}`);
          } else {
            analyzerStatus = ANALYZER_REASONS.ANALYZER_HTTP_ERROR;
          }
        }
      } catch (aiErr) {
        analyzerStatus = ANALYZER_REASONS.ANALYZER_TIMEOUT;
        console.error('[PPLP] AI pre-analysis failed, using metadata fallback:', aiErr);
      }

      // Observability only — never throws, never alters authoritative scoring.
      logAnalyzerObservation({
        action_id: action.id,
        action_type: action.action_type,
        content_source: contentSource,
        content_length: contentLength,
        content_hash: contentHash,
        attempted,
        status: analyzerStatus,
        http_status: httpStatus,
        duration_ms: Date.now() - startedAt,
      });
    }



    // Community Signal — fetch average ratings from pplp_ratings (if any exist)
    let communitySignals = { servingLife: 5, transparentTruth: 5, healingLove: 5, longTermValue: 5, unityOverSeparation: 5 };
    try {
      const { data: ratings } = await supabase
        .from('pplp_ratings')
        .select('pillar_sustain, pillar_truth, pillar_heal_love, pillar_life_service, pillar_unity_source')
        .eq('content_id', action.id);
      if (ratings && ratings.length >= 2) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        // pplp_ratings uses 0-2 scale, multiply by 5 to get 0-10
        communitySignals = {
          servingLife: avg(ratings.map(r => (r.pillar_sustain ?? 1))) * 5,
          transparentTruth: avg(ratings.map(r => (r.pillar_truth ?? 1))) * 5,
          healingLove: avg(ratings.map(r => (r.pillar_heal_love ?? 1))) * 5,
          longTermValue: avg(ratings.map(r => (r.pillar_life_service ?? 1))) * 5,
          unityOverSeparation: avg(ratings.map(r => (r.pillar_unity_source ?? 1))) * 5,
        };
        console.log(`[PPLP v2.0] Community signals from ${ratings.length} ratings: SH=${communitySignals.servingLife.toFixed(1)}, BƠ=${communitySignals.transparentTruth.toFixed(1)}`);
      }
    } catch (e) {
      console.error('[PPLP] Community signal fetch error:', e);
    }

    // Trust Signal — derived from user's historical reliability
    let trustSignals = { servingLife: 5, transparentTruth: 5, healingLove: 5, longTermValue: 5, unityOverSeparation: 5 };
    try {
      const { data: recentScores } = await supabase
        .from('pplp_scores')
        .select('pillar_repentance, pillar_gratitude, pillar_service, pillar_helping, pillar_giving, pillar_s, pillar_t, pillar_h, pillar_c, pillar_u')
        .eq('decision', 'pass')
        .in('action_id', (
          await supabase
            .from('pplp_actions')
            .select('id')
            .eq('actor_id', action.actor_id)
            .in('status', ['scored', 'minted'])
            .order('created_at', { ascending: false })
            .limit(10)
        ).data?.map((a: { id: string }) => a.id) ?? []);
      if (recentScores && recentScores.length >= 3) {
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        // Use v2.0 columns first, fallback to legacy
        trustSignals = {
          servingLife: avg(recentScores.map(r => (r.pillar_repentance ?? r.pillar_s ?? 50))) / 10,
          transparentTruth: avg(recentScores.map(r => (r.pillar_gratitude ?? r.pillar_t ?? 50))) / 10,
          healingLove: avg(recentScores.map(r => (r.pillar_service ?? r.pillar_h ?? 50))) / 10,
          longTermValue: avg(recentScores.map(r => (r.pillar_helping ?? r.pillar_c ?? 50))) / 10,
          unityOverSeparation: avg(recentScores.map(r => (r.pillar_giving ?? r.pillar_u ?? 50))) / 10,
        };
        console.log(`[PPLP v2.0] Trust signals from ${recentScores.length} recent scores: SH=${trustSignals.servingLife.toFixed(1)}, BƠ=${trustSignals.transparentTruth.toFixed(1)}`);
      }
    } catch (e) {
      console.error('[PPLP] Trust signal fetch error:', e);
    }

    // ========== 3b/4/5. Pure legacy core (Batch 1 refactor) ==========
    // Signal combination, legacy pillars, v2 light score, truth gate,
    // multipliers and threshold decision now live in _shared/pplp-core.ts.
    // Byte-equivalent to the previous inline implementation (golden 30/30).
    const pre = computePreDecision({
      action: action as unknown as CoreActionData,
      aiAnalysis: aiAnalysis as unknown as CoreAiAnalysis | null,
      config: config as unknown as CoreCapsConfig,
      signals: { community: communitySignals, trust: trustSignals },
      minLightScore: MIN_LIGHT_SCORE,
    });

    const pillars = pre.pillars;
    const pillarsV2 = pre.pillarsV2;
    const nlpFeatures = pre.nlpFeatures;
    const v2Score = pre.v2Score;
    const lightScore = pre.lightScore;
    const vvuBaseValue = pre.vvuBaseValue;
    const vvuQuality = pre.vvuQuality;

    console.log(`[PPLP v2.5] Legacy: intent=${v2Score.intent}, depth=${v2Score.depth}, impact=${v2Score.impact}, lightScore=${lightScore}`);

    // ========== 3c. TRUTH GATE (Pseudocode §3) ==========
    const truthThreshold100 = PPLP_CONSTANTS.MIN_TRUTH_FOR_AUTO_APPROVAL * 10;
    if (pre.truthGateFailed) {
      await supabase
        .from('pplp_actions')
        .update({ status: 'flagged', updated_at: new Date().toISOString() })
        .eq('id', action_id);
      console.warn(`[PPLP] Truth gate failed for action ${action_id}: T=${pillars.T} < ${truthThreshold100}`);
      return new Response(
        JSON.stringify({
          success: false, error: 'TRUTH_GATE_FAILED',
          message: `Transparent Truth score (${pillars.T}/100) below threshold (${truthThreshold100}/100). Flagged for review.`,
          action_id: action.id, pillars,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const multipliers = pre.multipliers;
    const decision: 'pass' | 'fail' = pre.decision;
    const failReasons = pre.failReasons;

    // ========== 6. Reputation, Consistency, Integrity, IIS, Reliability ==========
    // Gather all DB-dependent inputs, then hand off to the pure core.
    const passContext = {
      reputationWeight: 1.0,
      consistencyStreak: 0,
      iisScore: 1.0,
      reliabilityScore: 0.95,
      effectiveTc: null as number | null,
      fraudSignals: [] as Array<{ signal_type: string; severity?: number }>,
      isWhitelisted: false,
      isSuspended: false,
      policyBaseReward: getPolicyBaseReward(action.action_type, action.platform_id),
    };

    if (decision === 'pass') {
      try {
        const [repRes, conRes, iisRes, relRes] = await Promise.all([
          supabase.rpc('calculate_reputation_weight', { _user_id: action.actor_id }),
          supabase.rpc('calculate_consistency_multiplier', { _user_id: action.actor_id }),
          supabase.rpc('compute_intent_integrity', { _user_id: action.actor_id }),
          supabase.rpc('compute_reliability', { _user_id: action.actor_id }),
        ]);
        if (repRes.data) passContext.reputationWeight = Number(repRes.data);
        if (iisRes.data != null) passContext.iisScore = Number(iisRes.data);
        if (relRes.data != null) passContext.reliabilityScore = Number(relRes.data);
      } catch (e) {
        console.error('[PPLP] Reputation/Consistency/IIS/Reliability calc error:', e);
      }

      try {
        const { data: streakData } = await supabase
          .from('features_user_day')
          .select('consistency_streak')
          .eq('user_id', action.actor_id)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();
        passContext.consistencyStreak = streakData?.consistency_streak ?? 0;
      } catch (_) {}

      // Trust Confidence TC — Trust Engine v1.0 (shared with Identity + mint gate)
      try {
        const { data: tcData, error: tcErr } = await supabase
          .rpc('get_effective_tc', { _user_id: action.actor_id });
        if (!tcErr && tcData) {
          const tc = Number((tcData as any).tc);
          if (Number.isFinite(tc) && tc > 0) passContext.effectiveTc = tc;
        }
      } catch (e) {
        console.error('[VVU] get_effective_tc failed, fallback 0.65:', e);
      }

      const { data: wlEntryScore } = await supabase
        .from('fraud_whitelist')
        .select('id')
        .eq('user_id', action.actor_id)
        .maybeSingle();
      passContext.isWhitelisted = !!wlEntryScore;

      if (!passContext.isWhitelisted) {
        try {
          const { data: signals } = await supabase
            .from('pplp_fraud_signals')
            .select('signal_type, severity')
            .eq('actor_id', action.actor_id)
            .eq('is_resolved', false);
          if (signals) passContext.fraudSignals = signals as Array<{ signal_type: string; severity?: number }>;
        } catch (e) {
          console.error('[PPLP] Integrity penalty calc error:', e);
        }
      }

      const { data: suspendedCheck } = await supabase
        .from('profiles')
        .select('is_suspended')
        .eq('id', action.actor_id)
        .maybeSingle();
      passContext.isSuspended = !!suspendedCheck?.is_suspended;
    }

    const core = finalizeLegacyScore(pre, {
      action: action as unknown as CoreActionData,
      aiAnalysis: aiAnalysis as unknown as CoreAiAnalysis | null,
      config: config as unknown as CoreCapsConfig,
      passContext,
    });

    const reputationWeight = core.reputationWeight;
    const consistencyMultiplier = core.consistencyMultiplier;
    const integrityPenalty = core.integrityPenalty;
    const iisScore = core.vvu.iis;
    const erpScore = core.vvu.erp;
    const reliabilityScore = core.vvu.reliability;
    const fraudSignalCount = passContext.fraudSignals.length;
    const vvuScore = core.vvu.score;
    const vvuTrustContext = core.vvu.trustContext;
    const vvuTrustConfidence = core.vvu.trustConfidencePersisted;
    const vvuImpactMultiplier = core.vvu.impactMultiplier;
    const vvuAntiAbuseFactor = core.vvu.antiAbuseFactorPersisted;
    const trustMultiplier = core.trustMultiplier;
    const baseReward = core.baseReward;
    const finalLightScore = core.finalLightScore;
    const lightContribution = core.lightContribution;
    let finalReward = core.finalReward;

    console.log(`[PPLP v2.5] VVU: B=${core.vvu.baseValue}, Q=${core.vvu.quality.toFixed(3)}, TC=${vvuTrustContext.toFixed(3)}, IIS=${iisScore.toFixed(3)}, IM=${vvuImpactMultiplier.toFixed(3)}, AAF=${vvuAntiAbuseFactor.toFixed(3)}, ERP=${erpScore.toFixed(3)}, R_t=${reliabilityScore.toFixed(3)} → VVU=${vvuScore}`);
    console.log(`[PPLP v2.5] Legacy finalLight=${finalLightScore}, VVU=${vvuScore}`);

    // ========== 7b. Determine reason codes ==========
    const reasonCodes: string[] = [];
    if (consistencyMultiplier >= 1.3) reasonCodes.push('CONSISTENCY_STRONG');
    if (reputationWeight >= 1.3) reasonCodes.push('COMMUNITY_VALIDATED');
    if (integrityPenalty === 0 && reputationWeight >= 1.0) reasonCodes.push('CROSS_PLATFORM_CONTRIBUTOR');

    // Check for mentor chain completion
    try {
      const { count: mentorChains } = await supabase
        .from('pplp_behavior_sequences')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', action.actor_id)
        .eq('sequence_type', 'mentorship')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (mentorChains && mentorChains > 0) reasonCodes.push('MENTOR_CHAIN_COMPLETED');
    } catch (_) {}

    // Check for value loop
    try {
      const { count: valueLoops } = await supabase
        .from('pplp_behavior_sequences')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', action.actor_id)
        .eq('sequence_type', 'value_creation')
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (valueLoops && valueLoops > 0) reasonCodes.push('VALUE_LOOP_ACTIVE');
    } catch (_) {}

    if (pillars.H >= 70) reasonCodes.push('HEALING_IMPACT_DETECTED');
    if (integrityPenalty > 0) {
      if (integrityPenalty <= 10) reasonCodes.push('QUALITY_SIGNAL_LOW');
      else reasonCodes.push('TEMPORARY_WEIGHT_ADJUSTMENT');
    }

    // Check for governance participation (GOV_VOTE_CAST events in last 30 days)
    try {
      const { count: govVotes } = await supabase
        .from('pplp_events')
        .select('*', { count: 'exact', head: true })
        .eq('actor_user_id', action.actor_id)
        .eq('event_type', 'GOV_VOTE_CAST')
        .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (govVotes && govVotes > 0) reasonCodes.push('GOVERNANCE_PARTICIPATION');
    } catch (_) {}

    // Check fraud signals for specific adjustment codes
    try {
      const { data: fraudSignals } = await supabase
        .from('pplp_fraud_signals')
        .select('signal_type')
        .eq('actor_id', action.actor_id)
        .eq('is_resolved', false);

      if (fraudSignals && fraudSignals.length > 0) {
        const signalTypes = fraudSignals.map(s => s.signal_type);
        if (signalTypes.some(t => ['burst_like', 'bot_pattern', 'temporal_anomaly'].includes(t))) {
          reasonCodes.push('INTERACTION_PATTERN_UNSTABLE');
        }
        if (signalTypes.some(t => ['ring_rating', 'reciprocal_rating'].includes(t))) {
          reasonCodes.push('RATING_CLUSTER_REVIEW');
        }
      }
    } catch (_) {}

    // Check for content under review
    try {
      const { count: contentUnderReview } = await supabase
        .from('pplp_actions')
        .select('*', { count: 'exact', head: true })
        .eq('actor_id', action.actor_id)
        .eq('status', 'under_review');
      if (contentUnderReview && contentUnderReview > 0) reasonCodes.push('CONTENT_REVIEW_IN_PROGRESS');
    } catch (_) {}

    // ========== 7c. Get active scoring rule version ==========
    let activeRuleVersion = 'V1.0';
    try {
      const { data: activeRule } = await supabase
        .from('scoring_rules')
        .select('rule_version')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (activeRule) activeRuleVersion = activeRule.rule_version;
    } catch (_) {}

    // ========== 7d. Calculate trend ==========
    let trend = 'stable';
    try {
      const { data: prevLedger } = await supabase
        .from('light_score_ledger')
        .select('final_light_score')
        .eq('user_id', action.actor_id)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevLedger) {
        const prevScore = Number(prevLedger.final_light_score);
        const currentScore = finalLightScore;
        const diff = currentScore - prevScore;
        if (diff > 5) trend = 'growing';
        else if (diff < -5) trend = 'reflecting';
        else if (integrityPenalty > 0) trend = 'rebalancing';
      }
    } catch (_) {}

    console.log(`[PPLP v2.0] Final: lightScore=${finalLightScore}, intent=${v2Score.intent}, depth=${v2Score.depth}, impact=${v2Score.impact}, trust=${trustMultiplier.toFixed(3)}, consistency=${consistencyMultiplier}, rule=${activeRuleVersion}, trend=${trend}`);

    // ========== 8. Insert score record ==========
    const { error: scoreError } = await supabase
      .from('pplp_scores')
      .upsert({
        action_id: action.id,
        // Legacy pillars (backward compat)
        pillar_s: pillars.S,
        pillar_t: pillars.T,
        pillar_h: pillars.H,
        pillar_c: pillars.C,
        pillar_u: pillars.U,
        // v2.0 new pillars
        pillar_repentance: pillarsV2.repentance,
        pillar_gratitude: pillarsV2.gratitude,
        pillar_service: pillarsV2.service,
        pillar_helping: pillarsV2.helping,
        pillar_giving: pillarsV2.giving,
        // v2.0 scoring dimensions (legacy compat)
        intent_score: v2Score.intent,
        depth_score: v2Score.depth,
        impact_score: v2Score.impact,
        trust_factor: trustMultiplier,
        // v2.0 NLP features
        ego_signal: nlpFeatures.ego_signal,
        authenticity_score: nlpFeatures.authenticity,
        love_tone: nlpFeatures.love_tone,
        // v2.5 VVU columns
        vvu_score: vvuScore,
        base_value: vvuBaseValue,
        quality_factor: vvuQuality,
        trust_context: vvuTrustContext,
        intent_integrity_score: iisScore,
        impact_multiplier: vvuImpactMultiplier,
        anti_abuse_factor: vvuAntiAbuseFactor,
        event_reputation_premium: erpScore,
        scoring_engine_version: 'v2.5',
        // Legacy score columns
        light_score: Math.round(finalLightScore * 100) / 100,
        base_reward: baseReward,
        multiplier_q: multipliers.Q,
        multiplier_i: multipliers.I,
        multiplier_k: multipliers.K,
        reputation_weight: reputationWeight,
        consistency_multiplier: consistencyMultiplier,
        integrity_penalty: integrityPenalty,
        final_reward: finalReward,
        decision,
        decision_reason: failReasons.length > 0 ? failReasons.join(', ') : (reasonCodes.length > 0 ? reasonCodes.join(', ') : null),
        scored_by: 'pplp_engine_v2.5',
        policy_version: action.policy_version,
      }, { onConflict: 'action_id' });

    if (scoreError) {
      console.error('[PPLP] Score insert error:', scoreError);
      return new Response(
        JSON.stringify({ error: 'Failed to save score', details: scoreError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== 8a. AI analysis already done in step 3 ==========

    // ========== 8b. Insert score explanation ==========
    let explainId = null;
    if (!skip_side_effects) {
      try {
        const { data: explData } = await supabase
          .from('score_explanations')
          .insert({
            user_id: action.actor_id,
            top_contributors_json: [{
              action_type: action.action_type,
              light_score: Math.round(lightScore * 100) / 100,
              light_contribution: lightContribution,
              reward: 0, // Hybrid: FUN via epoch only
            }],
            penalties_json: integrityPenalty > 0 ? [{ type: 'integrity', penalty_pct: integrityPenalty }] : [],
            ai_pillar_scores: aiAnalysis?.pillars || null,
            ai_ego_risk: aiAnalysis?.ego_risk || null,
            ai_explanation: aiAnalysis?.explanation || null,
            version: 'v2.5',
            reliability_score: reliabilityScore,
          })
          .select('id')
          .single();
        if (explData) explainId = explData.id;
      } catch (explErr) {
        console.error('[PPLP] Explanation insert error:', explErr);
      }
    }

    // ========== 8b2. Update ledger with reason_codes, rule_version, trend ==========
    if (!skip_side_effects) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const weekNum = `W${Math.ceil(new Date().getDate() / 7)}`;
        const period = `${today.slice(0, 7)}-${weekNum}`;
        
        await supabase
          .from('light_score_ledger')
          .update({
            reason_codes: reasonCodes,
            rule_version: activeRuleVersion,
            trend,
          })
          .eq('user_id', action.actor_id)
          .eq('period', period);
      } catch (ledgerErr) {
        console.error('[PPLP] Ledger update error:', ledgerErr);
      }
    }

    // ========== 8c. Build features + compute daily light score ==========
    if (!skip_side_effects) {
      try {
        await supabase.rpc('build_features_user_day', {
          _user_id: action.actor_id,
          _date: new Date().toISOString().split('T')[0],
        });
        // Compute daily L_u(t) using LS-Math v1.0
        await supabase.rpc('compute_daily_light_score', {
          _user_id: action.actor_id,
          _date: new Date().toISOString().split('T')[0],
        });
        // v2.5: Recompute 3-layer light score (PLS + NLS + LLS → TLS)
        await supabase.rpc('recompute_user_light_score', { _user_id: action.actor_id });
      } catch (featErr) {
        console.error('[PPLP] Feature builder / daily score / light recompute error:', featErr);
      }
    }

    // ========== 8c2. Update rater weights using reputation ==========
    if (!skip_side_effects) {
      try {
        const contentActionTypes2 = ['POST_CREATE', 'ANALYSIS_POST', 'COMMENT_CREATE', 'CONTENT_CREATE'];
        if (contentActionTypes2.includes(action.action_type)) {
          // Update weight_applied on any existing ratings for this content
          const { data: ratings } = await supabase
            .from('pplp_ratings')
            .select('id, rater_user_id')
            .eq('content_id', action.id);
          if (ratings && ratings.length > 0) {
            for (const rating of ratings) {
              const { data: w } = await supabase.rpc('compute_reputation_weight_v2', {
                _user_id: rating.rater_user_id,
              });
              if (w) {
                await supabase.from('pplp_ratings').update({ weight_applied: w }).eq('id', rating.id);
              }
            }
          }
        }
      } catch (raterErr) {
        console.error('[PPLP] Rater weight update error:', raterErr);
      }
    }

    // ========== 8d. Update action status ==========
    const nextStatus = previousStatus === 'minted'
      ? 'minted'
      : (decision === 'pass' ? 'scored' : 'rejected');

    await supabase
      .from('pplp_actions')
      .update({ 
        status: nextStatus,
        scored_at: decision === 'pass' ? new Date().toISOString() : action.scored_at
      })
      .eq('id', action.id);

    console.log(`[PPLP] Action ${action.id} scored: ${decision.toUpperCase()} - RawLight: ${lightScore.toFixed(6)}, FinalLight: ${finalLightScore}, Impact: ${ACTION_IMPACT_WEIGHTS[action.action_type] ?? 1.0}, FUN per-action: 0 (epoch-based)`);

    // ========== 9. Detect behavior sequences ==========
    let sequenceResult = null;
    if (!skip_side_effects && decision === 'pass') {
      try {
        const { data: seqData, error: seqError } = await supabase
          .rpc('detect_behavior_sequences', {
            _user_id: action.actor_id,
            _action_id: action.id,
            _action_type: action.action_type,
          });

        if (seqError) {
          console.error('[PPLP] Sequence detection error:', seqError);
        } else {
          sequenceResult = seqData;
          console.log(`[PPLP] Sequence: updated=${seqData?.sequences_updated}, completed=${seqData?.sequences_completed}, bonus=${seqData?.bonus_multiplier}`);
        }
      } catch (seqErr) {
        console.error('[PPLP] Sequence detection failed:', seqErr);
      }
    }

    // ========== 10. Run fraud detection ==========
    let fraudResult = null;
    if (!skip_side_effects) {
      try {
      const fraudCheckResponse = await fetch(`${supabaseUrl}/functions/v1/pplp-detect-fraud`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          actor_id: action.actor_id,
          action_id: action.id,
          action_type: action.action_type,
          metadata: {
            ...action.metadata,
            device_hash: action.integrity?.device_hash,
            ip_hash: action.integrity?.ip_hash,
          },
        }),
      });
      
        if (fraudCheckResponse.ok) {
          fraudResult = await fraudCheckResponse.json();
          console.log(`[PPLP] Fraud check: risk_score=${fraudResult.risk_score}, signals=${fraudResult.signals_detected}`);
        }
      } catch (fraudError) {
        console.error('[PPLP] Fraud detection call failed:', fraudError);
      }
    }

    // ========== 11. HYBRID: No per-action FUN minting — epoch-based only ==========
    // FUN Money is allocated at end of each epoch based on accumulated Light Score
    // Per-action: only update user tier stats for tracking
    let mintResult = null;
    if (!skip_side_effects) {
      try {
        // Atomic increment via RPC
        await supabase.rpc('increment_user_tier_stats', {
          p_user_id: action.actor_id,
          p_is_pass: decision === 'pass',
        });
        await supabase.rpc('update_user_tier', { _user_id: action.actor_id });

        if (decision === 'pass') {
          mintResult = {
            auto_minted: false,
            status: 'epoch_based',
            message: 'FUN Money is allocated at end of epoch based on Light Score contribution.',
            light_contribution: lightContribution,
          };
        }
      } catch (tierError) {
        console.error('[PPLP] Tier update error:', tierError);
      }
    }

    // ========== Auto-sync to FUN Profile ==========
    if (!skip_side_effects && decision === 'pass') {
      const contentPreview = typeof action.metadata?.content === 'string'
        ? (action.metadata.content as string).slice(0, 200)
        : '';
      // Fire and forget - don't block the response
      autoSyncToFunProfile(
        supabase,
        action.actor_id,
        action.id,
        action.action_type,
        finalLightScore,
        contentPreview
      ).catch(err => console.warn('[PPLP] Auto-sync non-fatal error:', err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        engine_version: 'v2.5',
        action_id: action.id,
        force_rescore: force_rescore,
        previous_status: previousStatus,
        next_status: nextStatus,
        pillars,
        pillars_v2: pillarsV2,
        // v2.5 VVU breakdown
        vvu: {
          score: vvuScore,
          base_value: vvuBaseValue,
          quality: Math.round(vvuQuality * 1000) / 1000,
          trust_context: Math.round(vvuTrustContext * 1000) / 1000,
          intent_integrity: Math.round(iisScore * 1000) / 1000,
          impact_multiplier: Math.round(vvuImpactMultiplier * 1000) / 1000,
          anti_abuse_factor: Math.round(vvuAntiAbuseFactor * 1000) / 1000,
          ego_risk_penalty: Math.round(erpScore * 1000) / 1000,
          reliability: Math.round(reliabilityScore * 1000) / 1000,
        },
        // Legacy v2.0 compat
        scoring_v2: { intent: v2Score.intent, depth: v2Score.depth, impact: v2Score.impact, consistency: consistencyMultiplier, trust_factor: trustMultiplier },
        nlp_features: nlpFeatures,
        raw_light_score: Math.round(lightScore * 100) / 100,
        light_score: Math.round(finalLightScore * 100) / 100,
        light_contribution: lightContribution,
        multipliers,
        reputation_weight: reputationWeight,
        consistency_multiplier: consistencyMultiplier,
        integrity_penalty: integrityPenalty,
        base_reward: baseReward,
        final_reward: 0,
        decision,
        fail_reasons: failReasons.length > 0 ? failReasons : null,
        fraud: fraudResult ? { risk_score: fraudResult.risk_score, signals_detected: fraudResult.signals_detected, recommendation: fraudResult.recommendation } : null,
        mint: mintResult,
        sequence: sequenceResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PPLP Score Action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
