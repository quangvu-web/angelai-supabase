import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TrustTrendPoint {
  snapshot_date: string;
  tc: number;
  trust_tier: string;
  decay_factor: number;
  days_inactive: number;
}

export function useTrustTrend(days = 30) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trust-trend", user?.id, days],
    queryFn: async () => {
      if (!user?.id) return [] as TrustTrendPoint[];
      const { data, error } = await supabase.rpc("get_trust_trend", {
        _user_id: user.id,
        _days: days,
      });
      if (error) throw error;
      return (data || []) as TrustTrendPoint[];
    },
    enabled: !!user?.id,
  });
}
