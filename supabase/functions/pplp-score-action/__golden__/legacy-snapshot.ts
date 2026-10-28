// ============================================================================
// GOLDEN MASTER — FROZEN SNAPSHOT of production pplp-score-action calculation
// Captured verbatim from supabase/functions/pplp-score-action/index.ts BEFORE
// any Batch 1 refactor. DO NOT "fix" anything here. Legacy quirks are
// intentionally preserved:
//   - `vvuTrustConfidence` is shadowed inside the pass-block (index.ts:877)
//   - `vvuAntiAbuseFactor` is shadowed inside the pass-block (index.ts:921)
//     → the value persisted to pplp_scores.anti_abuse_factor is the OUTER 1.0
// This file is the source of truth for golden.json. It must never be edited to
// make a new implementation pass.
// ============================================================================

import { getPolicyBaseReward } from "../../_shared/pplp-helper.ts";

export interface SnapshotActionData {
  id: string;
  platform_id: string;
  action_type: string;
  actor_id: string;
  metadata: Record<string, unknown>;
  impact: Record<string, unknown>;
  integrity: Record<string, unknown>;
  policy_version: string;
}

export interface SnapshotAiAnalysis {
  pillars: { repentance: number; gratitude: number; service: number; helping: number; giving: number };
  pillars_legacy?: { truth: number; sustain: number; heal: number; service: number; unity: number };
  nlp_features?: { gratitude_score: number; repentance_score: number; ego_signal: number; authenticity: number; love_tone: number; depth: number };
  ego_risk: number;
  explanation?: string;
}

export interface SnapshotCapsConfig {
  action_type: string;
  platform_id: string;
  base_reward: number;
  thresholds: Record<string, number>;
  multiplier_ranges: { Q: [number, number]; I: [number, number]; K: [number, number] };
}

export interface SnapshotSignals {
  community: { servingLife: number; transparentTruth: number; healingLove: number; longTermValue: number; unityOverSeparation: number };
  trust: { servingLife: number; transparentTruth: number; healingLove: number; longTermValue: number; unityOverSeparation: number };
}

/** Everything the pass-block reads from the database, pre-fetched. */
export interface SnapshotPassContext {
  reputationWeight: number;
  consistencyStreak: number;
  iisScore: number;
  reliabilityScore: number;
  effectiveTc: number | null;
  fraudSignals: Array<{ signal_type: string; severity?: number }>;
  isWhitelisted: boolean;
  isSuspended: boolean;
}

export interface SnapshotInput {
  action: SnapshotActionData;
  aiAnalysis: SnapshotAiAnalysis | null;
  config: SnapshotCapsConfig;
  signals: SnapshotSignals;
  passContext: SnapshotPassContext;
  minLightScore: number;
}

export interface SnapshotResult {
  pillars: { S: number; T: number; H: number; C: number; U: number };
  pillarsV2: { repentance: number; gratitude: number; service: number; helping: number; giving: number };
  nlpFeatures: { gratitude_score: number; repentance_score: number; ego_signal: number; authenticity: number; love_tone: number; depth: number };
  v2Score: { lightScore: number; intent: number; depth: number; impact: number };
  multipliers: { Q: number; I: number; K: number };
  truthGateFailed: boolean;
  decision: "pass" | "fail";
  failReasons: string[];
  vvu: {
    baseValue: number;
    quality: number;
    trustContext: number;
    trustConfidencePersisted: number;
    iis: number;
    impactMultiplier: number;
    antiAbuseFactorPersisted: number;
    erp: number;
    reliability: number;
    score: number;
  };
  reputationWeight: number;
  consistencyMultiplier: number;
  integrityPenalty: number;
  trustMultiplier: number;
  baseReward: number;
  finalLightScore: number;
  finalReward: number;
  lightContribution: number;
}

const PPLP_CONSTANTS = {
  MAX_SCORED_ACTIONS_PER_DAY: 10,
  MAX_HIGH_IMPACT_ACTIONS_PER_DAY: 3,
  MIN_TRUTH_FOR_AUTO_APPROVAL: 3.0,
  BASE_MINT_RATE: 10.0,
  HIGH_IMPACT_ACTION_TYPES: ["SERVICE", "GIVING", "ANALYSIS_POST", "CONTENT_CREATE", "HELP_GIVEN"],
};

const ACTION_BASE_VALUES: Record<string, number> = {
  POST_CREATE: 3.0, ANALYSIS_POST: 5.0, COMMENT_CREATE: 1.5, JOURNAL_WRITE: 2.5,
  QUESTION_ASK: 2.0, CONTENT_CREATE: 4.0, SHARE_CONTENT: 1.0, CONTENT_SHARE: 1.0,
  HELP_GIVEN: 4.5, MEDITATION: 3.0, GIVING: 5.0, SERVICE: 5.5,
  LOGIN: 0.5, DAILY_CHECK_IN: 0.2, DAILY_RITUAL: 0.5, GRATITUDE_PRACTICE: 1.0,
  PROFILE_COMPLETE: 3.0, PROFILE_COMPLETION: 3.0, DID_VERIFICATION: 7.0, KYC_VERIFY: 7.0,
  SOULBOUND_MINT: 10.0, LEARNING_COMPLETION: 2.0, LEARN_COMPLETE: 2.0, QUIZ_PASS: 1.0,
  COURSE_CREATE: 10.0, REFERRAL_RAW: 0.5, REFERRAL_ACTIVATED: 10.0, REFERRAL_INVITE: 1.0,
  TRANSACTION: 1.0, DONATE: 5.0, STAKE_LOCK: 0, LIQUIDITY_PROVIDE: 0,
  CONTRIBUTION: 8.0, GOVERNANCE: 6.0, GOV_PROPOSAL: 6.0, GOV_VOTE: 2.0,
  SUCCESSFUL_PROPOSAL: 15.0, POLICY_REVIEW: 3.0, BUG_BOUNTY: 10.0, DISPUTE_RESOLVE: 5.0,
  LONG_TERM_VALUE_ASSET: 50.0, CONTENT_SAVED: 5.0, MENTOR_HELP: 4.5, PROJECT_SUBMIT: 5.0,
  CONTENT_REVIEW: 2.0, TREE_PLANT: 3.0, CLEANUP_EVENT: 4.0, CARBON_OFFSET: 2.0,
  ECO_ACTION: 1.5, FARM_DELIVERY: 3.0, MARKET_FAIR_TRADE: 2.5, PRODUCT_REVIEW: 1.5,
  SELLER_VERIFY: 3.0, VISION_CREATE: 2.0, CAMPAIGN_CREATE: 5.0, CAMPAIGN_SUPPORT: 2.0,
  VOLUNTEER: 4.0, epoch_mint_reward: 0, epoch_claim: 0,
};

const ACTION_IMPACT_WEIGHTS: Record<string, number> = {
  POST_CREATE: 1.0, ANALYSIS_POST: 1.5, COMMENT_CREATE: 0.85, JOURNAL_WRITE: 0.8,
  QUESTION_ASK: 0.8, CONTENT_CREATE: 1.2, SHARE_CONTENT: 0.5, HELP_GIVEN: 1.3,
  LOGIN: 0.3, MEDITATION: 1.0, GIVING: 1.4, SERVICE: 1.5, epoch_mint_reward: 0, epoch_claim: 0,
};

function calculateQualityFactor(
  pillarsV2: { repentance: number; gratitude: number; service: number; helping: number; giving: number },
  nlpFeatures: { depth: number; authenticity: number },
  metadata: Record<string, unknown>,
): number {
  const pillarAvg = (pillarsV2.repentance + pillarsV2.gratitude + pillarsV2.service + pillarsV2.helping + pillarsV2.giving) / 10;
  const depthFactor = nlpFeatures.depth || 0.5;
  const authFactor = nlpFeatures.authenticity || 0.5;
  const hasEvidence = metadata.has_evidence ? 0.15 : 0;
  const contentBonus = metadata.content && typeof metadata.content === "string" && (metadata.content as string).length > 200 ? 0.1 : 0;
  const quality = (pillarAvg * 0.4 + depthFactor * 0.3 + authFactor * 0.2 + hasEvidence + contentBonus);
  return Math.max(0.3, Math.min(1.8, quality * 2));
}

function calculateImpactMultiplier(action: SnapshotActionData): number {
  const impact = action.impact || {};
  let rawIm = 0;
  if (typeof impact.beneficiaries === "number") rawIm += Math.log(1 + (impact.beneficiaries as number)) * 0.3;
  if (impact.outcome === "positive" || impact.outcome === "helpful") rawIm += 0.5;
  if (typeof impact.reach_score === "number") rawIm += (impact.reach_score as number) * 0.3;
  if (impact.creates_asset) rawIm += 0.3;
  if (impact.promotes_unity) rawIm += 0.2;
  if (impact.governance_effect) rawIm += 0.5;
  if (impact.infrastructure_change) rawIm += 0.5;

  if (rawIm >= 1.5) return 2.75;
  if (rawIm >= 1.0) return 2.0;
  if (rawIm >= 0.6) return 1.25;
  if (rawIm >= 0.3) return 0.9;
  return 0.65;
}

function calculatePillarScores(action: SnapshotActionData): { S: number; T: number; H: number; C: number; U: number } {
  const metadata = action.metadata || {};
  const impact = action.impact || {};
  const integrity = action.integrity || {};

  let S = 50;
  if (impact.beneficiaries && typeof impact.beneficiaries === "number") {
    S = Math.min(100, 50 + (impact.beneficiaries as number) * 5);
  }
  if (impact.outcome === "positive" || impact.outcome === "helpful") S += 20;

  let T = 60;
  if (metadata.has_evidence) T += 20;
  if (metadata.verified) T += 15;
  if (integrity.verification_score && typeof integrity.verification_score === "number") {
    T = Math.min(100, T + (integrity.verification_score as number) * 10);
  }

  let H = 50;
  if (metadata.sentiment_score && typeof metadata.sentiment_score === "number") {
    H = Math.min(100, 50 + (metadata.sentiment_score as number) * 50);
  }
  if (impact.healing_effect) H += 25;

  let C = 50;
  let verifiedContentLength = 0;
  if (metadata.content && typeof metadata.content === "string") {
    verifiedContentLength = (metadata.content as string).length;
  } else if (metadata.content_length && typeof metadata.content_length === "number") {
    verifiedContentLength = Math.min(metadata.content_length as number, 5000);
  }
  if (verifiedContentLength > 0) {
    C = Math.min(100, 50 + Math.min(verifiedContentLength / 100, 30));
  }
  if (metadata.is_educational) C += 20;
  if (impact.creates_asset) C += 25;

  let U = 50;
  if (impact.promotes_unity) U += 30;
  if (metadata.is_collaborative) U += 20;
  if (impact.connection_score && typeof impact.connection_score === "number") {
    U = Math.min(100, U + (impact.connection_score as number) * 20);
  }

  return {
    S: Math.round(Math.min(100, Math.max(0, S))),
    T: Math.round(Math.min(100, Math.max(0, T))),
    H: Math.round(Math.min(100, Math.max(0, H))),
    C: Math.round(Math.min(100, Math.max(0, C))),
    U: Math.round(Math.min(100, Math.max(0, U))),
  };
}

function calculateLightScoreV2(
  nlpFeatures: { gratitude_score: number; repentance_score: number; ego_signal: number; authenticity: number; love_tone: number; depth: number },
  pillarsV2: { repentance: number; gratitude: number; service: number; helping: number; giving: number },
  impactWeight: number,
): { lightScore: number; intent: number; depth: number; impact: number } {
  const intent = (
    nlpFeatures.gratitude_score +
    nlpFeatures.repentance_score +
    nlpFeatures.authenticity +
    nlpFeatures.love_tone +
    (1 - nlpFeatures.ego_signal)
  ) / 5;

  const pillarAvg = (pillarsV2.repentance + pillarsV2.gratitude + pillarsV2.service + pillarsV2.helping + pillarsV2.giving) / 10;
  const depth = (nlpFeatures.depth * 0.6 + pillarAvg * 0.4);
  const impact = Math.min(1, impactWeight / 1.5);
  const lightScore = intent * depth * impact * 100;

  return {
    lightScore: Math.round(lightScore * 100) / 100,
    intent: Math.round(intent * 100) / 100,
    depth: Math.round(depth * 100) / 100,
    impact: Math.round(impact * 100) / 100,
  };
}

function calculateMultipliers(
  action: SnapshotActionData,
  pillars: { S: number; T: number; H: number; C: number; U: number },
  ranges: { Q: [number, number]; I: [number, number]; K: [number, number] },
): { Q: number; I: number; K: number } {
  const impact = action.impact || {};
  const integrity = action.integrity || {};
  const metadata = action.metadata || {};

  let qNormalized = 0.5;
  if (metadata.quality_score && typeof metadata.quality_score === "number") {
    qNormalized = metadata.quality_score as number;
  } else {
    qNormalized = (pillars.T + pillars.C) / 200;
  }
  const Q = ranges.Q[0] + (ranges.Q[1] - ranges.Q[0]) * qNormalized;

  let iNormalized = 0.3;
  if (impact.beneficiaries && typeof impact.beneficiaries === "number") {
    iNormalized = Math.min(1, (impact.beneficiaries as number) / 10);
  }
  if (impact.reach_score && typeof impact.reach_score === "number") {
    iNormalized = Math.max(iNormalized, impact.reach_score as number);
  }
  const I = ranges.I[0] + (ranges.I[1] - ranges.I[0]) * iNormalized;

  let kNormalized = 0.7;
  if (integrity.anti_sybil_score && typeof integrity.anti_sybil_score === "number") {
    kNormalized = integrity.anti_sybil_score as number;
  }
  if (integrity.fraud_signals && (integrity.fraud_signals as unknown[]).length > 0) {
    kNormalized *= 0.5;
  }
  const K = ranges.K[0] + (ranges.K[1] - ranges.K[0]) * kNormalized;

  return {
    Q: Math.round(Q * 100) / 100,
    I: Math.round(I * 100) / 100,
    K: Math.round(K * 100) / 100,
  };
}

function checkThresholds(
  pillars: { S: number; T: number; H: number; C: number; U: number },
  lightScore: number,
  multipliers: { Q: number; I: number; K: number },
  thresholds: Record<string, number>,
  minLightScore: number,
): { pass: boolean; reasons: string[] } {
  const failReasons: string[] = [];

  if (pillars.S === 0) failReasons.push("ZERO_GATE_S");
  if (pillars.T === 0) failReasons.push("ZERO_GATE_T");
  if (pillars.H === 0) failReasons.push("ZERO_GATE_H");
  if (pillars.C === 0) failReasons.push("ZERO_GATE_V");
  if (pillars.U === 0) failReasons.push("ZERO_GATE_U");

  if (thresholds.S && pillars.S < thresholds.S) failReasons.push(`S_BELOW_${thresholds.S}`);
  if (thresholds.T && pillars.T < thresholds.T) failReasons.push(`T_BELOW_${thresholds.T}`);
  if (thresholds.H && pillars.H < thresholds.H) failReasons.push(`H_BELOW_${thresholds.H}`);
  if (thresholds.C && pillars.C < thresholds.C) failReasons.push(`C_BELOW_${thresholds.C}`);
  if (thresholds.U && pillars.U < thresholds.U) failReasons.push(`U_BELOW_${thresholds.U}`);
  if (thresholds.K && multipliers.K * 100 < thresholds.K) failReasons.push(`K_BELOW_${thresholds.K}`);
  if (thresholds.LightScore && lightScore < thresholds.LightScore) failReasons.push(`LIGHTSCORE_BELOW_${thresholds.LightScore}`);
  if (lightScore < minLightScore) failReasons.push(`LIGHTSCORE_BELOW_GLOBAL_MIN`);

  return { pass: failReasons.length === 0, reasons: failReasons };
}

/**
 * Frozen replica of the production scoring pipeline (index.ts steps 3b → 8),
 * with every DB read replaced by a pre-fetched value.
 */
export function snapshotCalculate(input: SnapshotInput): SnapshotResult {
  const { action, aiAnalysis, config, signals, passContext, minLightScore } = input;

  let nlpFeatures = { gratitude_score: 0.5, repentance_score: 0.5, ego_signal: 0.1, authenticity: 0.7, love_tone: 0.5, depth: 0.5 };
  let pillarsV2 = { repentance: 1, gratitude: 1, service: 1, helping: 1, giving: 1 };

  let aiSignals = { servingLife: 5, transparentTruth: 6, healingLove: 5, longTermValue: 5, unityOverSeparation: 5 };
  if (aiAnalysis?.pillars) {
    pillarsV2 = {
      repentance: aiAnalysis.pillars.repentance ?? 1,
      gratitude: aiAnalysis.pillars.gratitude ?? 1,
      service: aiAnalysis.pillars.service ?? 1,
      helping: aiAnalysis.pillars.helping ?? 1,
      giving: aiAnalysis.pillars.giving ?? 1,
    };
    if (aiAnalysis.nlp_features) {
      nlpFeatures = aiAnalysis.nlp_features;
    }
    const legacy = aiAnalysis.pillars_legacy || {
      truth: pillarsV2.repentance,
      sustain: pillarsV2.gratitude,
      heal: pillarsV2.helping,
      service: pillarsV2.service,
      unity: pillarsV2.giving,
    };
    aiSignals = {
      servingLife: Math.min(10, legacy.service * 5),
      transparentTruth: Math.min(10, legacy.truth * 5),
      healingLove: Math.min(10, legacy.heal * 5),
      longTermValue: Math.min(10, legacy.sustain * 5),
      unityOverSeparation: Math.min(10, legacy.unity * 5),
    };
    if (aiAnalysis.ego_risk > 0.3) {
      const egoFactor = 1 - (aiAnalysis.ego_risk * 0.5);
      aiSignals.servingLife *= egoFactor;
      aiSignals.transparentTruth *= egoFactor;
      aiSignals.healingLove *= egoFactor;
      aiSignals.longTermValue *= egoFactor;
      aiSignals.unityOverSeparation *= egoFactor;
    }
  } else {
    const metaPillars = calculatePillarScores(action);
    aiSignals = {
      servingLife: metaPillars.S / 10,
      transparentTruth: metaPillars.T / 10,
      healingLove: metaPillars.H / 10,
      longTermValue: metaPillars.C / 10,
      unityOverSeparation: metaPillars.U / 10,
    };
  }

  const communitySignals = signals.community;
  const trustSignals = signals.trust;

  const SIGNAL_WEIGHTS = { ai: 0.60, community: 0.20, trust: 0.20 };
  const combined = {
    servingLife: aiSignals.servingLife * SIGNAL_WEIGHTS.ai + communitySignals.servingLife * SIGNAL_WEIGHTS.community + trustSignals.servingLife * SIGNAL_WEIGHTS.trust,
    transparentTruth: aiSignals.transparentTruth * SIGNAL_WEIGHTS.ai + communitySignals.transparentTruth * SIGNAL_WEIGHTS.community + trustSignals.transparentTruth * SIGNAL_WEIGHTS.trust,
    healingLove: aiSignals.healingLove * SIGNAL_WEIGHTS.ai + communitySignals.healingLove * SIGNAL_WEIGHTS.community + trustSignals.healingLove * SIGNAL_WEIGHTS.trust,
    longTermValue: aiSignals.longTermValue * SIGNAL_WEIGHTS.ai + communitySignals.longTermValue * SIGNAL_WEIGHTS.community + trustSignals.longTermValue * SIGNAL_WEIGHTS.trust,
    unityOverSeparation: aiSignals.unityOverSeparation * SIGNAL_WEIGHTS.ai + communitySignals.unityOverSeparation * SIGNAL_WEIGHTS.community + trustSignals.unityOverSeparation * SIGNAL_WEIGHTS.trust,
  };

  const pillars = {
    S: Math.round(Math.min(100, Math.max(0, combined.servingLife * 10))),
    T: Math.round(Math.min(100, Math.max(0, combined.transparentTruth * 10))),
    H: Math.round(Math.min(100, Math.max(0, combined.healingLove * 10))),
    C: Math.round(Math.min(100, Math.max(0, combined.longTermValue * 10))),
    U: Math.round(Math.min(100, Math.max(0, combined.unityOverSeparation * 10))),
  };

  const impactWeight = ACTION_IMPACT_WEIGHTS[action.action_type] ?? 1.0;
  const v2Score = calculateLightScoreV2(nlpFeatures, pillarsV2, impactWeight);
  const lightScore = v2Score.lightScore;

  const vvuBaseValue = ACTION_BASE_VALUES[action.action_type] ?? 2.0;
  const vvuQuality = calculateQualityFactor(pillarsV2, nlpFeatures, action.metadata || {});

  // TRUTH GATE — production returns early (HTTP 200, no score row).
  const truthThreshold100 = PPLP_CONSTANTS.MIN_TRUTH_FOR_AUTO_APPROVAL * 10;
  if (pillars.T < truthThreshold100) {
    return {
      pillars, pillarsV2, nlpFeatures, v2Score,
      multipliers: { Q: 0, I: 0, K: 0 },
      truthGateFailed: true,
      decision: "fail",
      failReasons: ["TRUTH_GATE_FAILED"],
      vvu: {
        baseValue: vvuBaseValue, quality: vvuQuality, trustContext: 0.65,
        trustConfidencePersisted: 0.65, iis: 1.0, impactMultiplier: 0.5,
        antiAbuseFactorPersisted: 1.0, erp: 1.0, reliability: 0.95, score: 0,
      },
      reputationWeight: 1.0, consistencyMultiplier: 1.0, integrityPenalty: 0,
      trustMultiplier: 1.0, baseReward: config.base_reward ?? 100,
      finalLightScore: 0, finalReward: 0, lightContribution: 0,
    };
  }

  const multiplierRanges = config.multiplier_ranges || { Q: [0.5, 3.0], I: [0.5, 5.0], K: [0.0, 1.0] };
  const multipliers = calculateMultipliers(action, pillars, multiplierRanges);

  const LOCKED_MIN_T = 30;
  const LOCKED_MIN_LS = 15;
  const rawThresholds = config.thresholds || {};
  const thresholds: Record<string, number> = {
    ...rawThresholds,
    T: Math.max(LOCKED_MIN_T, Number(rawThresholds.T ?? LOCKED_MIN_T)),
    LightScore: Math.max(LOCKED_MIN_LS, Number(rawThresholds.LightScore ?? LOCKED_MIN_LS)),
  };
  const thresholdCheck = checkThresholds(pillars, lightScore, multipliers, thresholds, minLightScore);
  const decision: "pass" | "fail" = thresholdCheck.pass ? "pass" : "fail";
  const failReasons = thresholdCheck.reasons;

  let reputationWeight = 1.0;
  let consistencyMultiplier = 1.0;
  let integrityPenalty = 0;
  let iisScore = 1.0;
  let erpScore = 1.0;
  let reliabilityScore = 0.95;
  let fraudSignalCount = 0;
  let vvuScore = 0;
  let vvuTrustContext = 0.65;
  const vvuTrustConfidenceOuter = 0.65; // QUIRK: never reassigned (shadowed inside block)
  let vvuImpactMultiplier = 0.5;
  const vvuAntiAbuseFactorOuter = 1.0; // QUIRK: never reassigned (shadowed inside block)
  let trustMultiplier = 1.0;
  let baseReward = config.base_reward ?? 100;

  if (decision === "pass") {
    reputationWeight = Number(passContext.reputationWeight);
    iisScore = Number(passContext.iisScore);
    reliabilityScore = Number(passContext.reliabilityScore);

    const streak = passContext.consistencyStreak ?? 0;
    if (streak >= 90) consistencyMultiplier = 1.2;
    else if (streak >= 31) consistencyMultiplier = 1.1;
    else if (streak >= 8) consistencyMultiplier = 1.05;
    else if (streak >= 4) consistencyMultiplier = 1.0;
    else consistencyMultiplier = 0.95;

    const egoRisk = aiAnalysis?.ego_risk ?? nlpFeatures.ego_signal ?? 0;
    if (egoRisk > 0.6) erpScore = 0.6;
    else if (egoRisk > 0.3) erpScore = 0.775;
    else if (egoRisk > 0.1) erpScore = 0.9;
    else erpScore = 1.0;

    // QUIRK: shadowed local, does not affect the outer variable
    let vvuTrustConfidence = 0.65;
    const tc = passContext.effectiveTc == null ? NaN : Number(passContext.effectiveTc);
    if (Number.isFinite(tc) && tc > 0) {
      vvuTrustConfidence = tc;
    }

    if (!passContext.isWhitelisted) {
      const signalsList = passContext.fraudSignals;
      if (signalsList && signalsList.length > 0) {
        fraudSignalCount = signalsList.length;
        let penaltyPct = 0;
        for (const sig of signalsList) {
          penaltyPct += sig.signal_type === "cross_account" ? 15
            : sig.signal_type === "fake_engagement" ? 20
            : sig.signal_type === "emotional_abuse" ? 10 : 10;
        }
        integrityPenalty = Math.min(50, penaltyPct);
      }
    }

    // QUIRK: shadowed local, does not affect the outer variable persisted to DB
    let vvuAntiAbuseFactor = 1.0;
    if (passContext.isSuspended) {
      vvuAntiAbuseFactor = 0;
    } else if (fraudSignalCount >= 6) {
      vvuAntiAbuseFactor = 0.1;
    } else if (fraudSignalCount >= 3) {
      vvuAntiAbuseFactor = 0.35;
    } else if (fraudSignalCount >= 1) {
      vvuAntiAbuseFactor = 0.65;
    }

    const policyBaseRewardInner = getPolicyBaseReward(action.action_type, action.platform_id);
    baseReward = policyBaseRewardInner ?? config.base_reward ?? 100;
    vvuImpactMultiplier = calculateImpactMultiplier(action);

    vvuScore = Math.round(vvuBaseValue * vvuQuality * vvuTrustConfidence * iisScore * vvuImpactMultiplier * vvuAntiAbuseFactor * erpScore * reliabilityScore * 100) / 100;

    trustMultiplier = reputationWeight * (1 - integrityPenalty / 100);
    vvuTrustContext = vvuTrustConfidence;
  }

  const finalLightScore = decision === "pass"
    ? Math.round(lightScore * trustMultiplier * consistencyMultiplier * 100) / 100
    : 0;
  const lightContribution = vvuScore > 0 ? vvuScore : finalLightScore;
  const finalReward = decision === "pass" ? baseReward : 0;

  return {
    pillars,
    pillarsV2,
    nlpFeatures,
    v2Score,
    multipliers,
    truthGateFailed: false,
    decision,
    failReasons,
    vvu: {
      baseValue: vvuBaseValue,
      quality: vvuQuality,
      trustContext: vvuTrustContext,
      trustConfidencePersisted: vvuTrustConfidenceOuter,
      iis: iisScore,
      impactMultiplier: vvuImpactMultiplier,
      antiAbuseFactorPersisted: vvuAntiAbuseFactorOuter,
      erp: erpScore,
      reliability: reliabilityScore,
      score: vvuScore,
    },
    reputationWeight,
    consistencyMultiplier,
    integrityPenalty,
    trustMultiplier,
    baseReward,
    finalLightScore,
    finalReward,
    lightContribution,
  };
}
