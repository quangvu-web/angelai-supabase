import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MintCycle {
  id: string;
  cycle_number: number;
  cycle_type: string;
  start_date: string;
  end_date: string;
  total_mint_pool: number;
  total_light_contribution: number;
  status: string;
}

export interface MintAllocation {
  id: string;
  cycle_id: string;
  user_id: string;
  user_light_contribution: number;
  allocation_ratio: number;
  fun_allocated: number;
  status: string;
}

export function useMintCycle() {
  const { user } = useAuth();

  const { data: currentCycle, isLoading: cycleLoading } = useQuery({
    queryKey: ["mint-cycle-current"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pplp_mint_cycles")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as MintCycle | null;
    },
  });

  const { data: myAllocation, isLoading: allocationLoading } = useQuery({
    queryKey: ["mint-allocation", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get latest allocation from pplp_mint_allocations
      const { data: pplp, error: pplpError } = await (supabase as any)
        .from("pplp_mint_allocations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pplpError) throw pplpError;
      if (!pplp) return null;

      // Cross-reference with pplp_mint_requests to get actual claimable amount
      const { data: mintReqs } = await supabase
        .from("pplp_mint_requests")
        .select("amount, status")
        .eq("actor_id", user.id)
        .in("status", ["pending_sig", "signed", "pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Use mint request amount if exists (actual claimable), otherwise allocation
      if (mintReqs && mintReqs.amount > 0) {
        return {
          ...pplp,
          fun_allocated: mintReqs.amount,
        } as MintAllocation;
      }

      return pplp as MintAllocation;
    },
    enabled: !!user?.id,
  });

  const { data: recentCycles } = useQuery({
    queryKey: ["mint-cycles-recent"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pplp_mint_cycles")
        .select("*")
        .order("cycle_number", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as MintCycle[];
    },
  });

  const timeRemaining = currentCycle
    ? Math.max(0, new Date(currentCycle.end_date).getTime() - Date.now())
    : 0;

  const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));

  return {
    currentCycle,
    myAllocation,
    recentCycles: recentCycles || [],
    daysRemaining,
    hoursRemaining,
    isLoading: cycleLoading || allocationLoading,
  };
}
