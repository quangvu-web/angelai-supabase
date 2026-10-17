import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TrustTier = "T0" | "T1" | "T2" | "T3" | "T4";

export interface TrustProfile {
  id: string;
  did_id: string;
  user_id: string;
  tc: number;
  trust_tier: TrustTier;
  vs: number;
  bs: number;
  ss: number;
  os: number;
  hs: number;
  risk_factor: number;
  sybil_risk: "low" | "medium" | "high" | "critical";
  fraud_risk: "low" | "medium" | "high" | "critical";
  last_computed_at: string;
  last_activity_at?: string | null;
  decay_factor?: number | null;
}

export function useTrustProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["trust-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("trust_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as TrustProfile | null;
    },
    enabled: !!user?.id,
  });
}
