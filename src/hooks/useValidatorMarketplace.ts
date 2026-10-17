import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ValidatorSort = "top_stake" | "most_active" | "best_uptime" | "newest";

export interface MarketplaceValidator {
  did_id: string;
  display_name: string;
  slug: string | null;
  logo_url: string | null;
  category: string;
  is_verified: boolean;
  description: string | null;
  total_stake: number;
  staker_count: number;
  attestation_count_30d: number;
  avg_weight: number;
  tier: string;
  sybil_risk: string;
  uptime_score: number;
  registered_at: string;
}

export function useValidatorMarketplace(params: {
  category?: string | null;
  sort?: ValidatorSort;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const { category = null, sort = "top_stake", search = "", limit = 24, offset = 0 } = params;
  return useQuery({
    queryKey: ["validator-marketplace", category, sort, search, limit, offset],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_validator_marketplace_list", {
        _category: category,
        _sort: sort,
        _search: search || null,
        _limit: limit,
        _offset: offset,
      });
      if (error) throw error;
      return (data || []) as MarketplaceValidator[];
    },
  });
}

export function useMyValidatorPortfolio() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-validator-portfolio", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("get_my_validator_portfolio");
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });
}

export function useValidatorDetailExtended(didId: string | undefined) {
  return useQuery({
    queryKey: ["validator-detail-extended", didId],
    queryFn: async () => {
      if (!didId) return null;
      const { data, error } = await supabase.rpc("get_validator_detail_extended", { _did_id: didId });
      if (error) throw error;
      return data as any;
    },
    enabled: !!didId,
  });
}
