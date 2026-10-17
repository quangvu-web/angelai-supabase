import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWeb3WalletContext } from "@/contexts/Web3WalletContext";
import { getAttesterGroup, isGovAttester } from "@/lib/govGroups";
import { createRealtimeChannelId } from "@/lib/realtime";

/**
 * Returns the number of mint requests waiting for this attester's group signature.
 * Accepts an optional fallback address (e.g. saved wallet from DB).
 */
export function useAttesterPendingCount(savedAddress?: string | null) {
  const { address } = useWeb3WalletContext();
  const connectedIsAttester = address ? isGovAttester(address) : false;
  const savedIsAttester = savedAddress ? isGovAttester(savedAddress) : false;
  const effectiveAddress = connectedIsAttester
    ? address
    : savedIsAttester
      ? savedAddress
      : address || savedAddress || null;
  const [count, setCount] = useState(0);

  const myGroup = effectiveAddress ? getAttesterGroup(effectiveAddress) : null;
  const isAttester = effectiveAddress ? isGovAttester(effectiveAddress) : false;

  const fetchCount = useCallback(async () => {
    if (!myGroup) { setCount(0); return; }

    const { data, error } = await supabase
      .from("pplp_mint_requests")
      .select("id, multisig_completed_groups", { count: "exact", head: false })
      .in("status", ["pending", "pending_sig", "signing"]);

    if (error || !data) { setCount(0); return; }

    // Filter: my group hasn't signed yet
    const pending = data.filter((r: any) => {
      const completed = ((r.multisig_completed_groups as string[]) || []).map((g: string) => g.toLowerCase());
      return !completed.includes(myGroup);
    });

    setCount(pending.length);
  }, [myGroup]);

  useEffect(() => {
    if (!isAttester || !myGroup) { setCount(0); return; }

    fetchCount();

    const channel = supabase
      .channel(createRealtimeChannelId("attester-pending-count"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pplp_mint_requests" },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAttester, myGroup, fetchCount]);

  return { pendingCount: count, isAttester };
}
