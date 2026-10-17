/**
 * PLP Light Score Scoring Engine
 * 
 * v2.0 (PRD-aligned) — Multiplicative formula: (S×T×H×V×U)/10^4
 * v1.0 (LS-Math legacy) — Additive weighted sum (kept for backward compat)
 * Dimension Scores — 5 Pillar Web3 Reputation System
 * 
 * Pure functions for calculating Light Score components.
 * Used in both frontend simulation and backend edge functions.
 */

// ============================================================
// PLP Constants (Backend Pseudocode §1)
// ============================================================

export const PPLP_CONSTANTS = {
  /** Protocol definition */
  PPLP_DEFINITION: 'PureLove Protocol',
  /** 99% user / 1% platform split */
  MINT_SPLIT_USER: 0.99,
  MINT_SPLIT_PLATFORM: 0.01,
  /** Global daily cap for scored actions per user */
  MAX_SCORED_ACTIONS_PER_DAY: 10,
  /** Daily cap for high-impact action types (SERVICE, GIVING, ANALYSIS_POST) */
  MAX_HIGH_IMPACT_ACTIONS_PER_DAY: 3,
  /** Minimum Transparent Truth pillar score (0-10) for auto-approval */
  MIN_TRUTH_FOR_AUTO_APPROVAL: 3.0,
  /** Base mint rate: MintAmount = BASE_MINT_RATE × FinalLightScore */
  BASE_MINT_RATE: 10.0,
  /** Action types considered "high impact" */
  HIGH_IMPACT_ACTION_TYPES: ['SERVICE', 'GIVING', 'ANALYSIS_POST', 'CONTENT_CREATE', 'HELP_GIVEN'] as readonly string[],
} as const;

// ============================================================
// PRD v1.0 — Multiplicative Scoring (CANONICAL)
// ============================================================

export interface PPLPPillars {
  /** Serving Life (0-10) */
  S: number;
  /** Transparent Truth (0-10) */
  T: number;
  /** Healing & Love (0-10) */
  H: number;
  /** Long-term Value (0-10) */
  V: number;
  /** Unity over Separation (0-10) */
  U: number;
}

export interface PPLPMultipliers {
  /** ImpactWeight — practical reach and significance of the action type */
  impactWeight: number;
  /** TrustMultiplier — user's historical reliability */
  trustMultiplier: number;
  /** ConsistencyMultiplier — rewards steady practice over time */
  consistencyMultiplier: number;
}

/**
 * PRD §7.1 — Raw Light Score (Multiplicative)
 * RawLightScore = (S × T × H × V × U) / 10^4
 * 
 * KEY RULE: If ANY pillar = 0, the entire score = 0 (anti-fake built-in)
 */
export function computeRawLightScore(pillars: PPLPPillars): number {
  const { S, T, H, V, U } = pillars;
  return (S * T * H * V * U) / 10_000;
}

/**
 * PRD §7.2 — Final Light Score
 * FinalLightScore = RawLightScore × ImpactWeight × TrustMultiplier × ConsistencyMultiplier
 */
export function computeFinalLightScore(
  pillars: PPLPPillars,
  multipliers: PPLPMultipliers,
): { raw: number; final: number; zeroGate: boolean } {
  const raw = computeRawLightScore(pillars);
  const zeroGate = raw === 0;
  const final = raw * multipliers.impactWeight * multipliers.trustMultiplier * multipliers.consistencyMultiplier;
  return { raw, final, zeroGate };
}

/**
 * PRD §8 — Mint Amount
 * MintAmount = BaseMintRate × FinalLightScore
 * Split: 99% user, 1% platform
 */
export function computeMintFromLightScore(params: {
  finalLightScore: number;
  baseMintRate: number;
}): { total: number; userAmount: number; platformAmount: number } {
  const total = params.baseMintRate * params.finalLightScore;
  const userAmount = Math.floor(total * 0.99);
  const platformAmount = Math.floor(total * 0.01);
  return { total, userAmount, platformAmount };
}

/**
 * Convert 0-100 scale pillar scores (from pplp_scores table) to 0-10 scale for PRD formula
 */
export function normalizePillarsTo10(pillars100: { S: number; T: number; H: number; C: number; U: number }): PPLPPillars {
  return {
    S: pillars100.S / 10,
    T: pillars100.T / 10,
    H: pillars100.H / 10,
    V: pillars100.C / 10, // C (Contribution) → V (Long-term Value) per PRD naming
    U: pillars100.U / 10,
  };
}

// ============================================================
// PRD §4 — Signal Combination (AI 60%, Community 20%, Trust 20%)
// ============================================================

export interface PillarSignals {
  servingLife: number;
  transparentTruth: number;
  healingLove: number;
  longTermValue: number;
  unityOverSeparation: number;
}

export interface SignalWeights {
  ai: number;
  community: number;
  trust: number;
}

export const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
  ai: 0.60,
  community: 0.20,
  trust: 0.20,
};

/**
 * Backend Pseudocode §4 — Combine AI, Community, and Trust signals
 * Each signal source provides per-pillar scores (0-10 scale).
 * Combined = AI × 0.60 + Community × 0.20 + Trust × 0.20
 */
export function combineSignals(
  aiResult: PillarSignals,
  communitySignals: PillarSignals,
  trustSignals: PillarSignals,
  weights: SignalWeights = DEFAULT_SIGNAL_WEIGHTS,
): PillarSignals {
  return {
    servingLife:
      aiResult.servingLife * weights.ai +
      communitySignals.servingLife * weights.community +
      trustSignals.servingLife * weights.trust,
    transparentTruth:
      aiResult.transparentTruth * weights.ai +
      communitySignals.transparentTruth * weights.community +
      trustSignals.transparentTruth * weights.trust,
    healingLove:
      aiResult.healingLove * weights.ai +
      communitySignals.healingLove * weights.community +
      trustSignals.healingLove * weights.trust,
    longTermValue:
      aiResult.longTermValue * weights.ai +
      communitySignals.longTermValue * weights.community +
      trustSignals.longTermValue * weights.trust,
    unityOverSeparation:
      aiResult.unityOverSeparation * weights.ai +
      communitySignals.unityOverSeparation * weights.community +
      trustSignals.unityOverSeparation * weights.trust,
  };
}

/**
 * Convert PillarSignals (0-10 scale, named fields) to DB format (0-100 scale, S/T/H/C/U)
 */
export function pillarSignalsToDbFormat(signals: PillarSignals): { S: number; T: number; H: number; C: number; U: number } {
  return {
    S: Math.round(Math.min(100, Math.max(0, signals.servingLife * 10))),
    T: Math.round(Math.min(100, Math.max(0, signals.transparentTruth * 10))),
    H: Math.round(Math.min(100, Math.max(0, signals.healingLove * 10))),
    C: Math.round(Math.min(100, Math.max(0, signals.longTermValue * 10))),
    U: Math.round(Math.min(100, Math.max(0, signals.unityOverSeparation * 10))),
  };
}
// LS-Math v1.0 — Legacy additive scoring (backward compat)
// ============================================================

export interface ScoringConfig {
  weights: { base_action_weight: number; content_weight: number };
  reputation: { alpha: number; w_min: number; w_max: number };
  content: { gamma: number; type_multiplier: Record<string, number> };
  consistency: { beta: number; lambda: number };
  sequence: { eta: number; kappa: number };
  penalty: { theta: number; max_penalty: number };
  mint: { epoch_type: string; anti_whale_cap: number; min_light_threshold: number };
}

export const DEFAULT_CONFIG: ScoringConfig = {
  weights: { base_action_weight: 0.4, content_weight: 0.6 },
  reputation: { alpha: 0.25, w_min: 0.5, w_max: 2.0 },
  content: {
    gamma: 1.3,
    type_multiplier: {
      post: 1.0, comment: 0.6, video: 1.2, course: 1.5,
      bug_report: 1.1, proposal: 1.3,
    },
  },
  consistency: { beta: 0.6, lambda: 30 },
  sequence: { eta: 0.5, kappa: 5 },
  penalty: { theta: 0.8, max_penalty: 0.5 },
  mint: { epoch_type: "monthly", anti_whale_cap: 0.03, min_light_threshold: 10 },
};

/** Clip value between min and max */
export function clip(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

/** §3 — Reputation Weight */
export function computeReputationWeight(
  contributionDays: number,
  passRate: number,
  streakBonus: number,
  config = DEFAULT_CONFIG,
): number {
  const R = contributionDays * passRate * (1 + streakBonus);
  return clip(
    config.reputation.w_min,
    config.reputation.w_max,
    1 + config.reputation.alpha * Math.log(1 + R),
  );
}

/** §4 — Content quality normalization h(P_c) */
export function normalizeContentScore(pillarSum: number, config = DEFAULT_CONFIG): number {
  return Math.pow(pillarSum / 10, config.content.gamma);
}

/** §6 — Content Score for a day (sum of ρ × h(P_c) for each content) */
export function computeContentScore(
  contents: Array<{ pillarSum: number; type: string }>,
  config = DEFAULT_CONFIG,
): number {
  return contents.reduce((sum, c) => {
    const rho = config.content.type_multiplier[c.type] ?? 1.0;
    return sum + rho * normalizeContentScore(c.pillarSum, config);
  }, 0);
}

/** §7 — Consistency Multiplier */
export function computeConsistencyMultiplier(streak: number, config = DEFAULT_CONFIG): number {
  return 1 + config.consistency.beta * (1 - Math.exp(-streak / config.consistency.lambda));
}

/** §8 — Sequence Multiplier */
export function computeSequenceMultiplier(sequenceBonus: number, config = DEFAULT_CONFIG): number {
  return 1 + config.sequence.eta * Math.tanh(sequenceBonus / config.sequence.kappa);
}

/** §9 — Integrity Penalty */
export function computeIntegrityPenalty(avgRisk: number, config = DEFAULT_CONFIG): number {
  return 1 - Math.min(config.penalty.max_penalty, config.penalty.theta * avgRisk);
}

/** §11 — Daily Light Score (raw + multipliers) — LEGACY ADDITIVE */
export function computeDailyLightScore(params: {
  baseActionScore: number;
  contentScore: number;
  streak: number;
  sequenceBonus: number;
  avgRisk: number;
  config?: ScoringConfig;
}): {
  raw: number;
  consistencyMul: number;
  sequenceMul: number;
  integrityPen: number;
  final: number;
} {
  const cfg = params.config ?? DEFAULT_CONFIG;
  const raw =
    cfg.weights.base_action_weight * params.baseActionScore +
    cfg.weights.content_weight * params.contentScore;

  const consistencyMul = computeConsistencyMultiplier(params.streak, cfg);
  const sequenceMul = computeSequenceMultiplier(params.sequenceBonus, cfg);
  const integrityPen = computeIntegrityPenalty(params.avgRisk, cfg);

  const final = raw * consistencyMul * sequenceMul * integrityPen;

  return { raw, consistencyMul, sequenceMul, integrityPen, final };
}

/** §14 — Mint Allocation with Anti-Whale cap */
export function computeMintAllocation(params: {
  userLight: number;
  totalSystemLight: number;
  mintPool: number;
  config?: ScoringConfig;
}): { share: number; allocation: number; capped: boolean } {
  const cfg = params.config ?? DEFAULT_CONFIG;
  if (params.totalSystemLight <= 0) return { share: 0, allocation: 0, capped: false };

  const rawShare = params.userLight / params.totalSystemLight;
  const capped = rawShare > cfg.mint.anti_whale_cap;
  const share = capped ? cfg.mint.anti_whale_cap : rawShare;
  const allocation = Math.floor(params.mintPool * share);

  return { share, allocation, capped };
}

/** §13 — Eligibility check */
export function checkMintEligibility(params: {
  pplpAccepted: boolean;
  avgRisk: number;
  epochLightScore: number;
  hasUnresolvedReview: boolean;
  config?: ScoringConfig;
}): { eligible: boolean; reason?: string } {
  const cfg = params.config ?? DEFAULT_CONFIG;

  if (!params.pplpAccepted) return { eligible: false, reason: "PPLP_NOT_ACCEPTED" };
  if (params.avgRisk > 0.7) return { eligible: false, reason: "HIGH_RISK" };
  if (params.epochLightScore < cfg.mint.min_light_threshold)
    return { eligible: false, reason: "LOW_LIGHT_SCORE" };
  if (params.hasUnresolvedReview) return { eligible: false, reason: "UNRESOLVED_REVIEW" };

  return { eligible: true };
}

// ============================================================
// Dimension Scores v2.0 — 5 Pillar Web3 Reputation System
// ============================================================

export interface DimensionWeights {
  identity: number;
  activity: number;
  onchain: number;
  transparency: number;
  ecosystem: number;
}

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  identity: 0.20,
  activity: 0.20,
  onchain: 0.20,
  transparency: 0.20,
  ecosystem: 0.20,
};

export interface IdentityParams {
  hasDisplayName: boolean;
  hasAvatar: boolean;
  hasBio: boolean;
  hasHandle: boolean;
  emailVerified: boolean;
  walletLinked: boolean;
  accountAgeDays: number;
  hasDID: boolean;
}

/** Identity Score (max 100) */
export function computeIdentityScore(params: IdentityParams): number {
  let score = 0;
  if (params.hasDisplayName) score += 5;
  if (params.hasAvatar) score += 10;
  if (params.hasBio) score += 5;
  if (params.hasHandle) score += 10;
  if (params.emailVerified) score += 20;
  if (params.walletLinked) score += 30;
  if (params.accountAgeDays > 30) score += 10;
  if (params.hasDID) score += 10;
  return Math.min(100, score);
}

export interface OnChainParams {
  walletLinked: boolean;
  accountAgeDays: number;
  hasCompletedWithdrawals: boolean;
  hasWeb3Gifts: boolean;
}

/** On-Chain History Score (max 100) */
export function computeOnChainScore(params: OnChainParams): number {
  if (!params.walletLinked) return 0;
  let score = 20; // wallet linked
  if (params.accountAgeDays > 365) score += 30;
  else if (params.accountAgeDays > 180) score += 20;
  else if (params.accountAgeDays > 90) score += 10;
  if (params.hasCompletedWithdrawals) score += 20;
  if (params.hasWeb3Gifts) score += 30;
  return Math.min(100, score);
}

/** Wallet Transparency Score (max 100) — starts at 100, decreases with fraud signals */
export function computeTransparencyScore(unresolvedFraudCount: number): number {
  return Math.max(30, 100 - unresolvedFraudCount * 15);
}

export interface EcosystemParams {
  hasCamlyBalance: boolean;
  platformUsageDays: number;
  hasPostsOrComments: boolean;
  hasSentGifts: boolean;
  holdingOver30Days: boolean;
}

/** Ecosystem Alignment Score (max 100) */
export function computeEcosystemScore(params: EcosystemParams): number {
  let score = 0;
  if (params.hasCamlyBalance) score += 20;
  if (params.platformUsageDays > 7) score += 20;
  if (params.hasPostsOrComments) score += 20;
  if (params.hasSentGifts) score += 20;
  if (params.holdingOver30Days) score += 20;
  return Math.min(100, score);
}

/** Decay factor based on inactive days */
export function computeDecayFactor(inactiveDays: number): number {
  if (inactiveDays >= 180) return 0;
  if (inactiveDays >= 90) return 0.3;
  if (inactiveDays >= 60) return 0.6;
  if (inactiveDays >= 30) return 0.85;
  return 1.0;
}

/** Streak bonus percentage */
export function computeStreakBonus(streakDays: number): number {
  if (streakDays >= 90) return 0.10;
  if (streakDays >= 30) return 0.05;
  if (streakDays >= 7) return 0.02;
  return 0;
}

/** Risk penalty from fraud signals severity */
export function computeRiskPenalty(signals: Array<{ severity: number }>): number {
  const total = signals.reduce((sum, s) => {
    if (s.severity >= 4) return sum + 35;
    if (s.severity >= 3) return sum + 20;
    if (s.severity >= 2) return sum + 10;
    return sum + 5;
  }, 0);
  return Math.min(80, total);
}

export interface DimensionScores {
  identity: number;
  activity: number;
  onchain: number;
  transparency: number;
  ecosystem: number;
}

/** Total Light Score from 5 dimensions + streak - penalty */
export function computeTotalDimensionScore(
  dimensions: DimensionScores,
  streakBonus: number,
  riskPenalty: number,
): { total: number; level: string } {
  const raw = dimensions.identity + dimensions.activity + dimensions.onchain +
    dimensions.transparency + dimensions.ecosystem;
  const total = Math.max(0, raw * (1 + streakBonus) - riskPenalty);

  let level: string;
  if (total >= 800) level = "Cosmic Contributor";
  else if (total >= 500) level = "Light Leader";
  else if (total >= 250) level = "Light Guardian";
  else if (total >= 100) level = "Light Builder";
  else level = "Light Seed";

  return { total, level };
}

/** Level info for display */
export const LIGHT_LEVELS = [
  { name: "Light Seed", emoji: "🌱", min: 0, max: 99, color: "hsl(var(--muted-foreground))" },
  { name: "Light Builder", emoji: "🔨", min: 100, max: 249, color: "hsl(var(--primary))" },
  { name: "Light Guardian", emoji: "🛡️", min: 250, max: 499, color: "hsl(210, 80%, 55%)" },
  { name: "Light Leader", emoji: "⭐", min: 500, max: 799, color: "hsl(45, 90%, 50%)" },
  { name: "Cosmic Contributor", emoji: "🌟", min: 800, max: Infinity, color: "hsl(280, 70%, 60%)" },
] as const;

export function getLightLevelInfo(totalScore: number) {
  return LIGHT_LEVELS.find(l => totalScore >= l.min && totalScore <= l.max) ?? LIGHT_LEVELS[0];
}
