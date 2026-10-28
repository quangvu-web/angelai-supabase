// Golden master fixtures — 12 healthy content types + 3 gaming probes.
// Mode A: aiAnalysis = null (matches today's production behaviour)
// Mode B: aiAnalysis pinned from analyzer-fixtures (no LLM call at test time)

import type {
  SnapshotActionData,
  SnapshotAiAnalysis,
  SnapshotCapsConfig,
  SnapshotPassContext,
  SnapshotSignals,
} from "./legacy-snapshot.ts";

export const PRIVACY_MARKER = "PRIVATE_TEST_CONTENT_12345";

export const DEFAULT_CONFIG: SnapshotCapsConfig = {
  action_type: "DEFAULT",
  platform_id: "ALL",
  base_reward: 100,
  thresholds: { T: 30, LightScore: 15 },
  multiplier_ranges: { Q: [0.5, 3.0], I: [0.5, 5.0], K: [0.0, 1.0] },
};

export const DEFAULT_SIGNALS: SnapshotSignals = {
  community: { servingLife: 5, transparentTruth: 5, healingLove: 5, longTermValue: 5, unityOverSeparation: 5 },
  trust: { servingLife: 5, transparentTruth: 5, healingLove: 5, longTermValue: 5, unityOverSeparation: 5 },
};

export const DEFAULT_PASS_CONTEXT: SnapshotPassContext = {
  reputationWeight: 1.0,
  consistencyStreak: 5,
  iisScore: 1.0,
  reliabilityScore: 0.95,
  effectiveTc: 0.9,
  fraudSignals: [],
  isWhitelisted: false,
  isSuspended: false,
};

function action(
  id: string,
  action_type: string,
  metadata: Record<string, unknown> = {},
  impact: Record<string, unknown> = {},
  integrity: Record<string, unknown> = {},
): SnapshotActionData {
  return {
    id,
    platform_id: "ANGEL_AI",
    action_type,
    actor_id: "00000000-0000-0000-0000-0000000000aa",
    metadata,
    impact,
    integrity,
    policy_version: "v1.0.1",
  };
}

export interface Fixture {
  name: string;
  action: SnapshotActionData;
  config?: SnapshotCapsConfig;
  signals?: SnapshotSignals;
  passContext?: SnapshotPassContext;
  minLightScore?: number;
  /** Mode B pinned analyzer output */
  ai: SnapshotAiAnalysis | null;
}

const AI_GRATITUDE: SnapshotAiAnalysis = {
  pillars: { repentance: 0, gratitude: 2, service: 1, helping: 1, giving: 1 },
  nlp_features: { gratitude_score: 0.9, repentance_score: 0.0, ego_signal: 0.1, authenticity: 0.85, love_tone: 0.9, depth: 0.6 },
  ego_risk: 0.1,
  explanation: "gratitude",
};
const AI_EDUCATIONAL: SnapshotAiAnalysis = {
  pillars: { repentance: 0, gratitude: 1, service: 2, helping: 2, giving: 1 },
  nlp_features: { gratitude_score: 0.4, repentance_score: 0.0, ego_signal: 0.2, authenticity: 0.8, love_tone: 0.6, depth: 0.85 },
  ego_risk: 0.2,
  explanation: "educational",
};
const AI_FATHER_VOICE: SnapshotAiAnalysis = {
  pillars: { repentance: 0, gratitude: 1, service: 2, helping: 2, giving: 2 },
  nlp_features: { gratitude_score: 0.6, repentance_score: 0.0, ego_signal: 0.8, authenticity: 0.7, love_tone: 0.8, depth: 0.7 },
  ego_risk: 0.8,
  explanation: "authoritative voice flagged as ego",
};
const AI_REPENTANCE_GAMING: SnapshotAiAnalysis = {
  pillars: { repentance: 2, gratitude: 1, service: 1, helping: 1, giving: 1 },
  nlp_features: { gratitude_score: 0.5, repentance_score: 0.95, ego_signal: 0.1, authenticity: 0.5, love_tone: 0.5, depth: 0.4 },
  ego_risk: 0.1,
  explanation: "apology inserted",
};
const AI_TOXIC: SnapshotAiAnalysis = {
  pillars: { repentance: 0, gratitude: 0, service: 0, helping: 0, giving: 0 },
  nlp_features: { gratitude_score: 0.05, repentance_score: 0.0, ego_signal: 0.95, authenticity: 0.2, love_tone: 0.05, depth: 0.1 },
  ego_risk: 0.95,
  explanation: "toxic",
};

export const FIXTURES: Fixture[] = [
  // --- 12 standard content types ---
  { name: "F01_QUESTION_ASK_basic", action: action("f01", "QUESTION_ASK", { content_length: 289 }), ai: AI_EDUCATIONAL },
  { name: "F02_JOURNAL_WRITE_gratitude", action: action("f02", "JOURNAL_WRITE", { content: "Con biết ơn Cha. ".repeat(30) }), ai: AI_GRATITUDE },
  { name: "F03_POST_CREATE_educational", action: action("f03", "POST_CREATE", { is_educational: true, content: "x".repeat(600) }, { beneficiaries: 8, outcome: "positive" }), ai: AI_EDUCATIONAL },
  { name: "F04_COMMENT_CREATE_short", action: action("f04", "COMMENT_CREATE", { content: "Cảm ơn bạn nhiều." }), ai: AI_GRATITUDE },
  { name: "F05_CONTENT_CREATE_asset", action: action("f05", "CONTENT_CREATE", { has_evidence: true, content: "y".repeat(1200) }, { creates_asset: true, promotes_unity: true, beneficiaries: 25 }), ai: AI_EDUCATIONAL },
  { name: "F06_HELP_GIVEN_service", action: action("f06", "HELP_GIVEN", { verified: true }, { outcome: "helpful", healing_effect: true, beneficiaries: 3 }), ai: AI_EDUCATIONAL },
  { name: "F07_GRATITUDE_PRACTICE", action: action("f07", "GRATITUDE_PRACTICE", { content: "Biết ơn." }), ai: AI_GRATITUDE },
  { name: "F08_DONATE_giving", action: action("f08", "DONATE", { message: "Gửi tặng quỹ ánh sáng" }, { beneficiaries: 40, outcome: "positive" }), ai: AI_GRATITUDE },
  { name: "F09_GOV_VOTE_governance", action: action("f09", "GOV_VOTE", {}, { governance_effect: true }), ai: AI_EDUCATIONAL },
  { name: "F10_ANALYSIS_POST_father_voice", action: action("f10", "ANALYSIS_POST", { content: "z".repeat(900), has_evidence: true }, { beneficiaries: 12, outcome: "positive", promotes_unity: true }), ai: AI_FATHER_VOICE },
  { name: "F11_MEDITATION_daily", action: action("f11", "MEDITATION", {}), ai: null },
  { name: "F12_epoch_mint_reward_nocontent", action: action("f12", "epoch_mint_reward", {}), ai: null },
  // --- 3 gaming probes ---
  { name: "G01_repentance_gaming", action: action("g01", "POST_CREATE", { content: "Tôi xin lỗi. " + "n".repeat(400) }, { beneficiaries: 5 }), ai: AI_REPENTANCE_GAMING },
  {
    name: "G02_fraud_signals_heavy",
    action: action("g02", "POST_CREATE", { content: "m".repeat(300) }, { beneficiaries: 4 }),
    passContext: { ...DEFAULT_PASS_CONTEXT, fraudSignals: [{ signal_type: "cross_account" }, { signal_type: "fake_engagement" }, { signal_type: "bot_pattern" }] },
    ai: AI_EDUCATIONAL,
  },
  {
    name: "G03_toxic_suspended",
    action: action("g03", "POST_CREATE", { content: PRIVACY_MARKER + " ".repeat(1) + "k".repeat(200) }, {}, { anti_sybil_score: 0.2, fraud_signals: ["x"] }),
    passContext: { ...DEFAULT_PASS_CONTEXT, isSuspended: true, effectiveTc: 0.3 },
    ai: AI_TOXIC,
  },
];
