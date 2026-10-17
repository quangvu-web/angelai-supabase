import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DimensionScoresData {
  identity_score: number;
  activity_score: number;
  onchain_score: number;
  transparency_score: number;
  ecosystem_score: number;
  risk_penalty: number;
  streak_bonus_pct: number;
  total_light_score: number;
  level_name: string;
  inactive_days: number;
  decay_applied: boolean;
  computed_at: string;
}

export function useDimensionScores() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dimension-scores", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_dimension_scores")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as DimensionScoresData | null;
    },
  });
}
