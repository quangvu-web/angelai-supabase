import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ForgeRecipe {
  id: string;
  input_tier: string;
  output_tier: string;
  input_count: number;
  camly_cost: number;
  xp_reward: number;
  output_collection: string;
  echo_chance: number;
  enabled: boolean;
}

export interface ForgeState {
  ok: boolean;
  recipes: ForgeRecipe[];
  tier_counts: Record<string, number>;
  today_burn: number;
  daily_cap: number;
}

export interface NftLite {
  id: string;
  collection_code: string;
  traits: Record<string, unknown>;
  created_at: string;
}

export function useLightForge() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const state = useQuery({
    queryKey: ["forge-state", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ForgeState | null> => {
      const { data, error } = await supabase.rpc("forge_get_my_state");
      if (error) throw error;
      return data as unknown as ForgeState;
    },
    refetchOnWindowFocus: false,
  });

  const myNfts = useQuery({
    queryKey: ["forge-my-nfts", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NftLite[]> => {
      const { data, error } = await supabase
        .from("nft_items")
        .select("id, collection_code, traits, created_at")
        .eq("owner_user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as NftLite[];
    },
    refetchOnWindowFocus: false,
  });

  const combine = useMutation({
    mutationFn: async (input: { recipe_id: string; nft_ids: string[] }) => {
      const { data, error } = await supabase.rpc("forge_combine", {
        p_recipe_id: input.recipe_id,
        p_nft_ids: input.nft_ids,
      });
      if (error) throw error;
      return data as {
        ok: boolean;
        reason?: string;
        output_nft_id?: string;
        output_tier?: string;
        camly_burned?: number;
        xp_awarded?: number;
        echo_granted?: boolean;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forge-state"] });
      qc.invalidateQueries({ queryKey: ["forge-my-nfts"] });
      qc.invalidateQueries({ queryKey: ["user-camly-coins"] });
      qc.invalidateQueries({ queryKey: ["mastery"] });
    },
  });

  return {
    state: state.data,
    nfts: myNfts.data ?? [],
    isLoading: state.isLoading || myNfts.isLoading,
    refetch: () => {
      state.refetch();
      myNfts.refetch();
    },
    combine: combine.mutateAsync,
    isCombining: combine.isPending,
  };
}
