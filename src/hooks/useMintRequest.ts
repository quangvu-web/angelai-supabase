import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MintRequest {
  id: string;
  action_id: string;
  actor_id: string;
  recipient_address: string;
  amount: number;
  action_hash: string;
  evidence_hash: string;
  policy_version: number;
  nonce: number;
  signature: string | null;
  signer_address: string | null;
  status: "pending" | "approved" | "signed" | "minted" | "rejected" | "expired";
  tx_hash: string | null;
  minted_at: string | null;
  created_at: string;
  updated_at: string;
  valid_after: string;
  valid_before: string;
}

/**
 * Hook to manage FUN Money mint requests.
 * 
 * EPOCH-BASED MODEL (LS-Math v1.0 §12-14):
 * - Users NO LONGER create per-action mint requests
 * - FUN is allocated monthly from the Mint Pool based on Light Score
 * - Admin triggers epoch allocation at end of each month
 * - Users can only view their allocation status
 */
export function useMintRequest() {
  const { user } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);

  /**
   * Get mint request for a specific action (legacy support)
   */
  const getMintRequest = useCallback(
    async (actionId: string): Promise<MintRequest | null> => {
      const { data } = await supabase
        .from("pplp_mint_requests")
        .select("*")
        .eq("action_id", actionId)
        .maybeSingle();

      return data as MintRequest | null;
    },
    []
  );

  /**
   * Get all epoch-based mint requests for the current user
   */
  const getMyEpochMintRequests = useCallback(
    async (): Promise<MintRequest[]> => {
      if (!user) return [];

      // Epoch mint requests are linked via pplp_mint_allocations
      // Fetch all pending/approved mint requests for this user
      const { data, error } = await supabase
        .from("pplp_mint_requests")
        .select("*")
        .eq("actor_id", user.id)
        .in("status", ["pending", "approved", "signed", "minted"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching epoch mint requests:", error);
        return [];
      }

      return (data || []) as MintRequest[];
    },
    [user]
  );

  return {
    getMintRequest,
    getMyEpochMintRequests,
    isRequesting,
  };
}
