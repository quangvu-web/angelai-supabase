import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONFIG,
  clip,
  computeReputationWeight,
  normalizeContentScore,
  computeContentScore,
  computeConsistencyMultiplier,
  computeSequenceMultiplier,
  computeIntegrityPenalty,
  computeDailyLightScore,
  computeMintAllocation,
  checkMintEligibility,
} from "@/lib/scoring-engine";

// ==================== PHẦN B — END-TO-END EXAMPLE ====================
describe("End-to-End Example: u_ly (Tháng 02/2026)", () => {
  it("should compute content scores correctly", () => {
    // Post 1: P_c = 8.5 → h = (0.85)^1.3 ≈ 0.80
    expect(normalizeContentScore(8.5)).toBeCloseTo(0.80, 1);
    // Post 2: P_c = 7.2 → h = (0.72)^1.3 ≈ 0.65
    expect(normalizeContentScore(7.2)).toBeCloseTo(0.65, 1);
    // Post 3: P_c = 9.0 → h = (0.9)^1.3 ≈ 0.87
    expect(normalizeContentScore(9.0)).toBeCloseTo(0.87, 1);
  });

  it("should compute total content score = ~2.33", () => {
    const C = computeContentScore([
      { pillarSum: 8.5, type: "post" },
      { pillarSum: 7.2, type: "post" },
      { pillarSum: 9.0, type: "post" },
    ]);
    expect(C).toBeCloseTo(2.33, 1);
  });

  it("should compute consistency multiplier for 30-day streak ≈ 1.38", () => {
    const M = computeConsistencyMultiplier(30);
    expect(M).toBeCloseTo(1.38, 1);
  });

  it("should compute sequence multiplier for mentor bonus=3 ≈ 1.27", () => {
    const M = computeSequenceMultiplier(3);
    expect(M).toBeCloseTo(1.27, 1);
  });

  it("should compute integrity penalty for risk=0.1 ≈ 0.92", () => {
    const P = computeIntegrityPenalty(0.1);
    expect(P).toBeCloseTo(0.92, 2);
  });

  it("should compute final light score ≈ 8.67", () => {
    const result = computeDailyLightScore({
      baseActionScore: 10,
      contentScore: 2.33,
      streak: 30,
      sequenceBonus: 3,
      avgRisk: 0.1,
    });

    expect(result.raw).toBeCloseTo(5.398, 1);
    expect(result.final).toBeCloseTo(8.67, 0);
  });

  it("should compute mint allocation = 86 FUN", () => {
    const result = computeMintAllocation({
      userLight: 8.67,
      totalSystemLight: 10000,
      mintPool: 100000,
    });

    expect(result.share).toBeCloseTo(0.000867, 4);
    expect(result.allocation).toBe(86);
    expect(result.capped).toBe(false);
  });
});

// ==================== PHẦN D — UNIT TEST CASES ====================

describe("Test 1 — Spam burst: 50 posts/ngày, rating thấp", () => {
  it("should yield very low content score due to low quality exponent", () => {
    // 50 posts all with pillarSum = 2.0 (very low quality)
    const contents = Array.from({ length: 50 }, () => ({
      pillarSum: 2.0,
      type: "post" as const,
    }));

    const C = computeContentScore(contents);
    // Each h(2.0) = (0.2)^1.3 ≈ 0.145 → 50 × 0.145 = 7.26
    // Even 50 posts give modest score; quality matters more than quantity

    const result = computeDailyLightScore({
      baseActionScore: 5,
      contentScore: C,
      streak: 1, // no consistency
      sequenceBonus: 0,
      avgRisk: 0.3, // elevated risk from spam
    });

    // High volume but low quality → modest final score
    expect(result.final).toBeLessThan(10);
  });
});

describe("Test 2 — Viral drama: many ratings but healing=0", () => {
  it("should have low P_c when healing pillar is zero", () => {
    // Pillars: Truth=2, Sustain=2, Healing=0, Service=1, Unity=1 → P_c = 6
    const h = normalizeContentScore(6.0);
    expect(h).toBeLessThan(0.6); // (0.6)^1.3 ≈ 0.52

    const result = computeDailyLightScore({
      baseActionScore: 2,
      contentScore: h,
      streak: 5,
      sequenceBonus: 0,
      avgRisk: 0.0,
    });

    // Low content → low mint even with buzz
    expect(result.final).toBeLessThan(3);
  });
});

describe("Test 3 — Silent consistent contributor: 60 ngày, ít bài chất lượng cao", () => {
  it("should beat noisy user via multiplier advantage", () => {
    // Silent: 2 posts but high quality (9.5 each), 60-day streak
    const silentResult = computeDailyLightScore({
      baseActionScore: 5,
      contentScore: computeContentScore([
        { pillarSum: 9.5, type: "post" },
        { pillarSum: 9.5, type: "post" },
      ]),
      streak: 60,
      sequenceBonus: 2,
      avgRisk: 0.0,
    });

    // Noisy: 10 posts but low quality (4.0 each), 3-day streak
    const noisyResult = computeDailyLightScore({
      baseActionScore: 8,
      contentScore: computeContentScore(
        Array.from({ length: 10 }, () => ({ pillarSum: 4.0, type: "post" as const })),
      ),
      streak: 3,
      sequenceBonus: 0,
      avgRisk: 0.2,
    });

    // Silent > Noisy thanks to consistency + quality
    expect(silentResult.final).toBeGreaterThan(noisyResult.final);
  });
});

describe("Test 4 — Rating ring: reputation weight + risk penalty", () => {
  it("should penalize high-risk users significantly", () => {
    const honestPenalty = computeIntegrityPenalty(0.0);
    const ringPenalty = computeIntegrityPenalty(0.6); // high risk

    expect(honestPenalty).toBe(1.0); // no penalty
    expect(ringPenalty).toBeCloseTo(0.52, 1); // severe 48% penalty

    // Same base score, drastically different outcome
    const honestResult = computeDailyLightScore({
      baseActionScore: 8,
      contentScore: 3,
      streak: 20,
      sequenceBonus: 1,
      avgRisk: 0.0,
    });

    const ringResult = computeDailyLightScore({
      baseActionScore: 8,
      contentScore: 3,
      streak: 20,
      sequenceBonus: 1,
      avgRisk: 0.6,
    });

    expect(ringResult.final).toBeLessThan(honestResult.final * 0.6);
  });
});

// ==================== PHẦN E — SYSTEM BEHAVIOR GUARANTEES ====================

describe("System Behavior Guarantees", () => {
  it("✔ Không có đột biến mint: anti-whale cap works", () => {
    const result = computeMintAllocation({
      userLight: 5000,
      totalSystemLight: 10000,
      mintPool: 100000,
    });
    // 50% share would be 50,000 but cap = 3% = 3,000
    expect(result.capped).toBe(true);
    expect(result.allocation).toBe(3000);
  });

  it("✔ Không thể farm vô hạn: diminishing returns via exponent", () => {
    const lowQuality = computeContentScore(
      Array.from({ length: 100 }, () => ({ pillarSum: 1.0, type: "post" as const })),
    );
    const highQuality = computeContentScore([{ pillarSum: 9.5, type: "post" }]);

    // 100 low-quality posts score less per-post than 1 great post
    expect(lowQuality / 100).toBeLessThan(highQuality);
  });

  it("✔ Chất lượng > số lượng: quality exponent rewards excellence", () => {
    const h_low = normalizeContentScore(3.0); // (0.3)^1.3 ≈ 0.22
    const h_high = normalizeContentScore(9.0); // (0.9)^1.3 ≈ 0.87

    // The gap between low and high is amplified by gamma=1.3
    expect(h_high / h_low).toBeGreaterThan(3);
  });

  it("✔ Bền vững > bùng nổ: consistency multiplier saturates", () => {
    const day1 = computeConsistencyMultiplier(1);
    const day30 = computeConsistencyMultiplier(30);
    const day90 = computeConsistencyMultiplier(90);
    const day365 = computeConsistencyMultiplier(365);

    // Saturating curve: big gains early, diminishing later
    expect(day30 - day1).toBeGreaterThan(day90 - day30);
    // Near-max plateau
    expect(day365).toBeLessThanOrEqual(1.6);
    expect(day365).toBeGreaterThan(1.59);
  });

  it("✔ Eligibility gates work correctly", () => {
    expect(checkMintEligibility({
      pplpAccepted: false, avgRisk: 0, epochLightScore: 50, hasUnresolvedReview: false,
    }).eligible).toBe(false);

    expect(checkMintEligibility({
      pplpAccepted: true, avgRisk: 0.8, epochLightScore: 50, hasUnresolvedReview: false,
    }).eligible).toBe(false);

    expect(checkMintEligibility({
      pplpAccepted: true, avgRisk: 0, epochLightScore: 5, hasUnresolvedReview: false,
    }).eligible).toBe(false);

    expect(checkMintEligibility({
      pplpAccepted: true, avgRisk: 0, epochLightScore: 50, hasUnresolvedReview: true,
    }).eligible).toBe(false);

    expect(checkMintEligibility({
      pplpAccepted: true, avgRisk: 0.3, epochLightScore: 50, hasUnresolvedReview: false,
    }).eligible).toBe(true);
  });
});

// ==================== UTILITY TESTS ====================

describe("Utility: clip function", () => {
  it("clips values correctly", () => {
    expect(clip(0, 10, 5)).toBe(5);
    expect(clip(0, 10, -5)).toBe(0);
    expect(clip(0, 10, 15)).toBe(10);
  });
});

describe("Reputation Weight", () => {
  it("returns w_min for zero contribution", () => {
    const w = computeReputationWeight(0, 0, 0);
    expect(w).toBe(1); // 1 + 0.25*log(1+0) = 1
  });

  it("increases with contribution and is capped at w_max", () => {
    const w = computeReputationWeight(1000, 1.0, 1.0);
    expect(w).toBeLessThanOrEqual(2.0);
  });
});
