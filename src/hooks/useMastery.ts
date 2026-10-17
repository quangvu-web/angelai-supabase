import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MasteryPerk {
  level_unlocked: number;
  perk_key: string;
}

export interface MasteryState {
  ok: boolean;
  level: number;
  total_xp: number;
  pending_perks: number;
  xp_into_level: number;
  xp_needed_for_next: number;
  perks: MasteryPerk[];
}

export interface MasteryPerkCatalog {
  level: number;
  description: string | null;
  options: Array<{ key: string; label: string; desc: string }>;
}

export function useMastery() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const state = useQuery({
    queryKey: ["mastery-state", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MasteryState | null> => {
      const { data, error } = await supabase.rpc("get_mastery_state");
      if (error) throw error;
      return data as unknown as MasteryState;
    },
    refetchOnWindowFocus: false,
  });

  const catalog = useQuery({
    queryKey: ["mastery-catalog"],
    queryFn: async (): Promise<MasteryPerkCatalog[]> => {
      const { data, error } = await supabase
        .from("mastery_perk_catalog")
        .select("level, description, options")
        .order("level");
      if (error) throw error;
      return (data ?? []) as unknown as MasteryPerkCatalog[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const claimPerk = useMutation({
    mutationFn: async (input: { level: number; perk_key: string }) => {
      const { data, error } = await supabase.rpc("claim_mastery_perk", {
        p_level: input.level,
        p_perk_key: input.perk_key,
      });
      if (error) throw error;
      return data as { ok: boolean; reason?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mastery-state"] });
    },
  });

  return {
    state: state.data,
    isLoading: state.isLoading,
    catalog: catalog.data ?? [],
    claimPerk: claimPerk.mutateAsync,
    isClaiming: claimPerk.isPending,
    refetch: state.refetch,
  };
}
