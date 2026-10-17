/**
 * Activation Thresholds — GAP #13
 * 
 * Kiểm tra ngưỡng kích hoạt tính năng dựa trên Display Light Score + Trust Level.
 * Dữ liệu gốc từ pplp_parameter_config.activation_thresholds.
 */

import { supabase } from "@/integrations/supabase/client";

export type FeatureKey =
  | 'earn_basic'
  | 'community_interact'
  | 'governance_vote'
  | 'create_proposal'
  | 'mentor_role'
  | 'validator_role';

export interface FeatureGateStatus {
  unlocked: boolean;
  required_light: number;
  current_light: number;
  required_trust: string;
  current_trust: string;
  required_streak: number;
  current_streak: number;
  label: string;
}

export type ActivationResult = Record<FeatureKey, FeatureGateStatus>;

/**
 * Gọi RPC check_feature_activation để kiểm tra toàn bộ cổng tính năng
 */
export async function checkFeatureActivation(userId: string): Promise<ActivationResult | null> {
  const { data, error } = await supabase.rpc('check_feature_activation', {
    _user_id: userId,
  });

  if (error) {
    console.error('[Activation] Failed to check:', error);
    return null;
  }

  return data as unknown as ActivationResult;
}

/**
 * Kiểm tra nhanh 1 tính năng cụ thể
 */
export async function isFeatureUnlocked(userId: string, feature: FeatureKey): Promise<boolean> {
  const result = await checkFeatureActivation(userId);
  if (!result) return false;
  return result[feature]?.unlocked ?? false;
}

/**
 * Fallback client-side check (khi không muốn gọi RPC)
 */
export function checkFeatureLocal(
  displayLight: number,
  trustLevel: string,
  streakDays: number,
  feature: FeatureKey,
): boolean {
  const THRESHOLDS: Record<FeatureKey, { light: number; trust: string; streak: number }> = {
    earn_basic: { light: 10, trust: 'basic', streak: 0 },
    community_interact: { light: 30, trust: 'basic', streak: 0 },
    governance_vote: { light: 200, trust: 'verified', streak: 0 },
    create_proposal: { light: 350, trust: 'strong', streak: 0 },
    mentor_role: { light: 150, trust: 'verified', streak: 30 },
    validator_role: { light: 300, trust: 'strong', streak: 60 },
  };

  const TRUST_ORDER: Record<string, number> = {
    unverified: 0, basic: 1, verified: 2, strong: 3, core: 4,
  };

  const req = THRESHOLDS[feature];
  if (!req) return false;

  return (
    displayLight >= req.light &&
    (TRUST_ORDER[trustLevel] ?? 0) >= (TRUST_ORDER[req.trust] ?? 0) &&
    streakDays >= req.streak
  );
}
