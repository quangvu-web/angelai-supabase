import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OrgProfile {
  id: string;
  did_id: string;
  user_id: string;
  display_name: string;
  slug: string | null;
  logo_url: string | null;
  banner_url: string | null;
  website: string | null;
  category: string;
  description: string | null;
  member_count: number;
  is_verified: boolean;
  created_at: string;
}

export interface ValidatorStake {
  id: string;
  did_id: string;
  amount: number;
  locked_until: string;
  status: "active" | "unstaking" | "released" | "slashed";
  created_at: string;
}

/** Fetch any org/validator by DID string or slug — public */
export function useOrgByDid(didOrSlug: string | undefined) {
  return useQuery({
    queryKey: ["org-by-did", didOrSlug],
    queryFn: async () => {
      if (!didOrSlug) return null;
      const { data, error } = await supabase.rpc("get_org_by_did", { _did: didOrSlug });
      if (error) throw error;
      return data as any;
    },
    enabled: !!didOrSlug,
  });
}

/** Fetch own org profile (if any) */
export function useMyOrgProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-org-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("org_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as OrgProfile | null;
    },
    enabled: !!user,
  });
}

/** Fetch own active validator stakes */
export function useMyStakes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-stakes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("validator_stakes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ValidatorStake[];
    },
    enabled: !!user,
  });
}

/** Top validators leaderboard */
export function useTopValidators(limit = 20) {
  return useQuery({
    queryKey: ["top-validators", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_top_validators", { _limit: limit });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

/** Register as org / validator */
export function useRegisterOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      entity_type: "org" | "validator";
      display_name: string;
      category?: string;
      description?: string;
      website?: string;
      logo_url?: string;
    }) => {
      const { data, error } = await supabase.rpc("register_org_or_validator", {
        _entity_type: params.entity_type,
        _display_name: params.display_name,
        _category: params.category ?? "community",
        _description: params.description ?? null,
        _website: params.website ?? null,
        _logo_url: params.logo_url ?? null,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-org-profile"] });
      qc.invalidateQueries({ queryKey: ["user-did"] });
    },
  });
}

/** Stake Camly Coin as validator */
export function useStakeValidator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number) => {
      const { data, error } = await supabase.rpc("stake_for_validator", { _amount: amount });
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-stakes"] });
      qc.invalidateQueries({ queryKey: ["camly-coin-balance"] });
    },
  });
}

/** Unstake (after lock period) */
export function useUnstakeValidator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stakeId: string) => {
      const { data, error } = await supabase.rpc("unstake_validator", { _stake_id: stakeId });
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-stakes"] });
      qc.invalidateQueries({ queryKey: ["camly-coin-balance"] });
    },
  });
}
