import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AscensionHistory = {
  tier: number;
  ascended_at: string;
  camly_burned: number;
  nft_burned_tier: string | null;
};

export type AscensionState = {
  ok: boolean;
  tier: number;
  next_tier: number | null;
  level: number;
  epic_count: number;
  legendary_count: number;
  eligible: boolean;
  bonus_pct: number;
  cost_options: { nft_tier: "epic" | "legendary"; camly: number }[];
  history: AscensionHistory[];
  reason?: string;
};

export type AscendResult = {
  ok: boolean;
  reason?: string;
  new_tier?: number;
  bonus_pct?: number;
  camly_burned?: number;
  title_nft_id?: string;
};

export function useAscension() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ascension-state", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<AscensionState> => {
      const { data, error } = await supabase.rpc("get_ascension_state", { p_user_id: user!.id });
      if (error) throw error;
      return data as unknown as AscensionState;
    },
  });

  const ascend = useMutation({
    mutationFn: async (nft_id: string): Promise<AscendResult> => {
      const { data, error } = await supabase.rpc("ascend_light", { p_nft_id: nft_id });
      if (error) throw error;
      return data as unknown as AscendResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ascension-state"] });
      qc.invalidateQueries({ queryKey: ["mastery"] });
      qc.invalidateQueries({ queryKey: ["camly"] });
      qc.invalidateQueries({ queryKey: ["nft-inventory"] });
    },
  });

  return {
    state: query.data,
    isLoading: query.isLoading,
    ascend: ascend.mutateAsync,
    isAscending: ascend.isPending,
  };
}
