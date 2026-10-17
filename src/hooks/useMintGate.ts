import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MintGate {
  tier: "T0" | "T1" | "T2" | "T3" | "T4";
  tc: number;
  cap_pct: number;
  warning: string | null;
  has_did: boolean;
}

/**
 * Soft mint gate per Identity+Trust v1.
 * - T0 → cap 50%
 * - T1+ → full
 */
export function useMintGate() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["mint-gate", user?.id],
    queryFn: async (): Promise<MintGate | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase.rpc("check_mint_gate", { _user_id: user.id });
      if (error) throw error;
      return data as unknown as MintGate;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}
