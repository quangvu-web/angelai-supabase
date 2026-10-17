/**
 * useMintSubmit — Hook for Admin to submit mint requests on-chain
 * 
 * FUNMoneyMinter flow (simplified):
 * 1. Check if actionId already processed on-chain
 * 2. Call mintValidatedAction(actionId, user, totalMint, validationDigest)
 * 3. Update status in DB: submitted → confirmed/failed
 * 
 * No more multisig signatures — backend wallet is an authorizedMinter.
 */

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { supabase } from "@/integrations/supabase/client";
import { useWeb3WalletContext } from "@/contexts/Web3WalletContext";
import { FUN_MONEY_ABI, FUN_MONEY_ADDRESSES } from "@/lib/funMoneyABI";
import { toast } from "sonner";
import { getActiveProvider } from "@/lib/walletProviders";

const BSC_TESTNET_CHAIN_ID = 97;

export function useMintSubmit() {
  const { isConnected } = useWeb3WalletContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Check if actionId is already processed on-chain */
  const checkProcessed = useCallback(
    async (actionId: string): Promise<boolean> => {
      try {
        const activeProvider = getActiveProvider();
        if (!activeProvider) throw new Error("No wallet provider");

        const provider = new ethers.BrowserProvider(activeProvider);
        const contractAddress = FUN_MONEY_ADDRESSES[BSC_TESTNET_CHAIN_ID];
        if (!contractAddress) throw new Error("Contract not deployed on this network");

        const contract = new ethers.Contract(contractAddress, FUN_MONEY_ABI, provider);
        const processed = await contract.processedActionIds(actionId);

        if (processed) {
          toast.info("Action này đã được mint on-chain trước đó.");
        }
        return processed;
      } catch (err: any) {
        console.error("Check processed failed:", err);
        toast.error(`Lỗi kiểm tra: ${err?.message}`);
        return false;
      }
    },
    []
  );

  /** Submit a mint request on-chain via mintValidatedAction */
  const submitMint = useCallback(
    async (request: {
      id: string;
      recipient_address: string;
      action_id: string;
      amount_wei: string;
      evidence_hash: string;
    }) => {
      if (!isConnected) {
        toast.error("Vui lòng kết nối ví trước");
        return false;
      }

      setIsSubmitting(true);
      try {
        // Identity+Trust v1: soft mint gate
        const { data: gate } = await supabase.rpc("check_mint_gate", { _user_id: (await supabase.auth.getUser()).data.user?.id || "" });
        const capPct = (gate as any)?.cap_pct ?? 1.0;
        const tier = (gate as any)?.tier ?? "T0";
        let effectiveAmount = BigInt(request.amount_wei);
        if (capPct < 1.0) {
          effectiveAmount = (effectiveAmount * BigInt(Math.round(capPct * 100))) / BigInt(100);
          toast.warning(`Trust Tier ${tier}: nhận ${(capPct * 100).toFixed(0)}% phần thưởng. Verify để mở 100%.`);
        }

        const activeProvider = getActiveProvider();
        if (!activeProvider) throw new Error("No wallet provider");

        const provider = new ethers.BrowserProvider(activeProvider);
        const signer = await provider.getSigner();

        const contractAddress = FUN_MONEY_ADDRESSES[BSC_TESTNET_CHAIN_ID];
        if (!contractAddress) throw new Error("Contract not deployed");

        const contract = new ethers.Contract(contractAddress, FUN_MONEY_ABI, signer);

        // Convert action_id to bytes32
        const actionIdBytes32 = ethers.zeroPadValue(
          ethers.toBeHex(request.action_id.replace(/-/g, ""), 16),
          32
        );

        // Use evidence_hash as validationDigest
        const validationDigest = request.evidence_hash || ethers.ZeroHash;

        // Update status to submitted
        await supabase
          .from("pplp_mint_requests")
          .update({ status: "submitted", updated_at: new Date().toISOString() })
          .eq("id", request.id);

        toast.loading("Đang gửi giao dịch on-chain...", { id: `submit-${request.id}` });

        const tx = await contract.mintValidatedAction(
          actionIdBytes32,
          request.recipient_address,
          effectiveAmount,
          validationDigest
        );

        toast.loading(`TX đã gửi: ${tx.hash.slice(0, 10)}... Đang chờ xác nhận...`, {
          id: `submit-${request.id}`,
        });

        const receipt = await tx.wait(2);

        // Update DB: confirmed
        await supabase
          .from("pplp_mint_requests")
          .update({
            status: "confirmed",
            tx_hash: receipt.hash,
            minted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);

        toast.success(`✅ Mint thành công! TX: ${receipt.hash.slice(0, 10)}...`, {
          id: `submit-${request.id}`,
        });

        return true;
      } catch (err: any) {
        console.error("Submit mint error:", err);

        await supabase
          .from("pplp_mint_requests")
          .update({
            status: "failed",
            on_chain_error: err?.message?.slice(0, 500) || "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);

        toast.error(`❌ Mint thất bại: ${err?.reason || err?.message || "Unknown"}`, {
          id: `submit-${request.id}`,
        });

        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isConnected]
  );

  return {
    checkProcessed,
    submitMint,
    isSubmitting,
  };
}
