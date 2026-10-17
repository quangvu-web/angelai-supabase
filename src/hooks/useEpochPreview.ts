import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface EpochPreview {
  my_light_score: number;
  total_light: number;
  mint_pool: number;
  estimated_allocation: number;
  my_ratio: number;
  is_eligible: boolean;
  ineligibility_reason: string;
  days_remaining: number;
  epoch_period: string;
  // Vesting breakdown
  instant_amount: number;
  locked_amount: number;
  vesting_days: number;
  // Epoch layers
  micro_epoch_score: number;
  validation_epoch_score: number;
  mint_epoch_progress: number;
  // Adaptive mint components
  adaptive_mint_base: number;
  adaptive_mint_contribution: number;
  adaptive_mint_ecosystem: number;
  discipline_modulator: number;
}

export function useEpochPreview() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["epoch-preview", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.rpc("preview_epoch_allocation", {
        _user_id: user.id,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as EpochPreview | null;
    },
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  const preview = data ?? null;

  return {
    preview,
    isLoading,
    refetch,
    // Derived helpers
    vestingBreakdown: preview ? {
      instant: preview.instant_amount,
      locked: preview.locked_amount,
      vestingDays: preview.vesting_days,
      instantPercent: preview.estimated_allocation > 0
        ? Math.round((preview.instant_amount / preview.estimated_allocation) * 100)
        : 15,
    } : null,
    epochLayers: preview ? {
      micro: preview.micro_epoch_score,
      validation: preview.validation_epoch_score,
      mintProgress: Math.round((preview.mint_epoch_progress || 0) * 100),
    } : null,
    mintEngine: preview ? {
      base: preview.adaptive_mint_base,
      contribution: preview.adaptive_mint_contribution,
      ecosystem: preview.adaptive_mint_ecosystem,
      discipline: preview.discipline_modulator,
      total: preview.adaptive_mint_base + preview.adaptive_mint_contribution + preview.adaptive_mint_ecosystem,
    } : null,
  };
}
