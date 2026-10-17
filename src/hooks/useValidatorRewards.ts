import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PendingRewards {
  total: number;
  count: number;
  by_source: Record<string, number>;
}

export function useValidatorPendingRewards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["validator-pending-rewards", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("get_validator_pending_rewards");
      if (error) throw error;
      return data as unknown as PendingRewards;
    },
    enabled: !!user,
  });
}

export function useValidatorRewardHistory(limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["validator-reward-history", user?.id, limit],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("validator_rewards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

export function useClaimValidatorRewards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_validator_rewards");
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["validator-pending-rewards"] });
      qc.invalidateQueries({ queryKey: ["validator-reward-history"] });
      qc.invalidateQueries({ queryKey: ["camly-coin-balance"] });
    },
  });
}

export function useSlashValidator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { stake_id: string; reason: string; slash_pct?: number }) => {
      const { data, error } = await supabase.rpc("slash_validator", {
        _stake_id: params.stake_id,
        _reason: params.reason,
        _slash_pct: params.slash_pct ?? 0.5,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["top-validators"] });
      qc.invalidateQueries({ queryKey: ["org-by-did"] });
    },
  });
}
