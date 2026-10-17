import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FUNMoneyStats {
  totalAllocated: number;  // FUN allocated/pending mint
  totalMinted: number;     // FUN already minted on-chain
  totalPending: number;    // Current epoch Light Score (informational)
  totalAmount: number;
  isLoading: boolean;
}

/**
 * Single source of truth for FUN Money stats.
 * Priority: pplp_mint_requests.amount (actual claimable) > pplp_mint_allocations.fun_allocated (theoretical)
 */
export function useFUNMoneyStats(userId?: string) {
  const [stats, setStats] = useState<FUNMoneyStats>({
    totalAllocated: 0,
    totalMinted: 0,
    totalPending: 0,
    totalAmount: 0,
    isLoading: true,
  });

  const fetchStats = useCallback(async () => {
    if (!userId) {
      setStats(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Use pplp_mint_requests as primary source (actual amounts)
      const { data: mintRequests, error: reqError } = await supabase
        .from("pplp_mint_requests")
        .select("amount, status")
        .eq("actor_id", userId);

      if (reqError) throw reqError;

      let totalMinted = 0;
      let totalAllocated = 0;

      (mintRequests || []).forEach((req) => {
        const amount = req.amount || 0;
        if (req.status === "minted" || req.status === "confirmed") {
          totalMinted += amount;
        } else if (["pending_sig", "signed", "pending", "approved"].includes(req.status)) {
          totalAllocated += amount;
        }
      });

      // Pending = current epoch Light Score contribution (informational)
      const { data: ledgerData } = await supabase
        .from("light_score_ledger")
        .select("final_light_score")
        .eq("user_id", userId);

      const currentLightScore = (ledgerData || []).reduce(
        (sum: number, row: any) => sum + (row.final_light_score || 0), 0
      );

      const totalPending = currentLightScore > 0 ? Math.round(currentLightScore) : 0;

      setStats({
        totalAllocated,
        totalMinted,
        totalPending,
        totalAmount: totalMinted + totalAllocated,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error fetching FUN Money stats:", error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Backwards compatibility
  return {
    ...stats,
    totalScored: stats.totalAllocated,
  };
}
