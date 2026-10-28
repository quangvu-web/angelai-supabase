import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.16.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BSC_TESTNET_RPC_LIST = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
  "https://bsc-testnet.blockpi.network/v1/rpc/public",
  "https://rpc.ankr.com/bsc_testnet_chapel",
];

const BSC_TESTNET_CHAIN_ID = 97n;

// TODO: Update after deploying FUNMoneyMinter
const CONTRACT_ADDRESS = ""; // FUNMoneyMinter address

const CONTRACT_ABI = [
  "function mintValidatedAction(bytes32 actionId, address user, uint256 totalMint, bytes32 validationDigest)",
  "function processedActionIds(bytes32) view returns (bool)",
  "function authorizedMinters(address) view returns (bool)",
];

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function uuidToBytes32(uuid: string): string {
  const hex = uuid.replace(/-/g, "");
  return "0x" + hex.padStart(64, "0");
}

async function getValidatedProvider() {
  for (const rpcUrl of BSC_TESTNET_RPC_LIST) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000)
      );
      const network = await Promise.race([provider.getNetwork(), timeout]);
      if (network.chainId !== BSC_TESTNET_CHAIN_ID) continue;

      if (CONTRACT_ADDRESS) {
        const code = await Promise.race([provider.getCode(CONTRACT_ADDRESS), timeout]);
        if (code === "0x" || code.length < 4) continue;
      }

      console.log(`[Batch Lock] ✓ RPC ${rpcUrl}`);
      return provider;
    } catch {
      continue;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const minterPrivateKey = Deno.env.get("MINTER_PRIVATE_KEY") || Deno.env.get("ATTESTER_PRIVATE_KEY") || Deno.env.get("TREASURY_PRIVATE_KEY");

    if (!minterPrivateKey) {
      return new Response(
        JSON.stringify({ error: "MINTER_PRIVATE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!CONTRACT_ADDRESS) {
      return new Response(
        JSON.stringify({ error: "FUNMoneyMinter contract not deployed yet. Update CONTRACT_ADDRESS." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate admin
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { actor_id, wallet_address } = await req.json();

    if (!actor_id || !wallet_address || !isValidAddress(wallet_address)) {
      return new Response(
        JSON.stringify({ error: "actor_id and valid wallet_address required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // CHECK SUSPENSION & FRAUD
    // ============================================

    const { data: suspension } = await supabase
      .from("user_suspensions")
      .select("id")
      .eq("user_id", actor_id)
      .is("lifted_at", null)
      .maybeSingle();

    if (suspension) {
      return new Response(
        JSON.stringify({ error: "User is suspended", actor_id }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: wlEntry } = await supabase
      .from("fraud_whitelist")
      .select("id")
      .eq("user_id", actor_id)
      .maybeSingle();

    if (!wlEntry) {
      const { count: fraudCount } = await supabase
        .from("pplp_fraud_signals")
        .select("*", { count: "exact", head: true })
        .eq("actor_id", actor_id)
        .eq("is_resolved", false)
        .gte("severity", 4);

      if (fraudCount && fraudCount > 0) {
        console.log(`[Batch Lock] Skipped ${actor_id}: ${fraudCount} unresolved fraud signals (severity >= 4)`);
        return new Response(
          JSON.stringify({ success: false, blocked: true, reason: "unresolved_fraud_signals", count: fraudCount, actor_id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ============================================
    // FETCH ALL PENDING MINT REQUESTS
    // ============================================

    const { data: pendingRequests, error: fetchErr } = await supabase
      .from("pplp_mint_requests")
      .select("*, pplp_actions!inner(id, action_type, actor_id, evidence_hash, metadata)")
      .eq("actor_id", actor_id)
      .eq("recipient_address", wallet_address)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending requests", details: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: "No pending mint requests found", actor_id, wallet_address, actions_count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Batch Lock] Found ${pendingRequests.length} pending requests for ${actor_id} → ${wallet_address}`);

    // ============================================
    // CALCULATE TOTAL MINT AMOUNT
    // ============================================

    const WEI = BigInt(10 ** 18);
    let totalMintWei = 0n;

    const actionResults: Array<{
      request: typeof pendingRequests[0];
      totalReward: number;
    }> = [];

    const evidenceHashes: string[] = [];

    for (const req of pendingRequests) {
      const totalAmountRaw = BigInt(req.amount);
      totalMintWei += totalAmountRaw * WEI;

      const evHash = req.evidence_hash || ethers.ZeroHash;
      if (evHash && /^0x[a-fA-F0-9]{64}$/.test(evHash)) {
        evidenceHashes.push(evHash);
      } else if (evHash && evHash !== ethers.ZeroHash) {
        evidenceHashes.push(ethers.keccak256(ethers.toUtf8Bytes(evHash)));
      }

      actionResults.push({ request: req, totalReward: req.amount });
    }

    // Aggregated validation digest
    evidenceHashes.sort();
    const validationDigest = evidenceHashes.length > 0
      ? ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
          evidenceHashes.map(() => "bytes32"),
          evidenceHashes
        ))
      : ethers.ZeroHash;

    const totalRewardAll = actionResults.reduce((s, a) => s + a.totalReward, 0);

    console.log(`[Batch Lock] Total: ${totalRewardAll} FUN (${totalMintWei} wei), ${pendingRequests.length} actions`);

    // ============================================
    // GET PROVIDER & EXECUTE ON-CHAIN
    // ============================================

    const provider = await getValidatedProvider();
    if (!provider) {
      return new Response(
        JSON.stringify({ error: "All BSC Testnet RPCs failed" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedKey = minterPrivateKey.startsWith("0x") ? minterPrivateKey : `0x${minterPrivateKey}`;
    const signer = new ethers.Wallet(formattedKey, provider);
    const signerAddress = signer.address;

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Generate a unique actionId for this batch
    const batchActionId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "bytes32"],
        [wallet_address, totalMintWei, validationDigest]
      )
    );

    let txHash: string | null = null;
    let onChainError: string | null = null;

    try {
      // Check if already processed
      const alreadyProcessed = await contract.processedActionIds(batchActionId);
      if (alreadyProcessed) {
        console.log(`[Batch Lock] Action already processed: ${batchActionId}`);
        const requestIds = pendingRequests.map((r) => r.id);
        await supabase
          .from("pplp_mint_requests")
          .update({ status: "minted", on_chain_error: "ALREADY_PROCESSED" })
          .in("id", requestIds);

        return new Response(
          JSON.stringify({ success: true, skipped: true, message: "Action already processed on-chain", actor_id }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check authorized minter
      const isAuthorized = await contract.authorizedMinters(signerAddress);
      if (!isAuthorized) {
        onChainError = "MINTER_NOT_AUTHORIZED";
        throw new Error(`Signer ${signerAddress} is not an authorized minter`);
      }

      console.log(`[Batch Lock] Calling mintValidatedAction: user=${wallet_address}, totalMint=${totalMintWei} wei`);

      const tx = await contract.mintValidatedAction(
        batchActionId,
        wallet_address,
        totalMintWei,
        validationDigest
      );

      console.log(`[Batch Lock] ⏳ TX sent: ${tx.hash}`);
      const receipt = await tx.wait(1);

      if (receipt.status === 0) {
        onChainError = "CONTRACT_REVERT";
        throw new Error(`TX ${receipt.hash} reverted`);
      }

      txHash = receipt.hash;
      console.log(`[Batch Lock] ✓ TX confirmed: ${txHash} in block ${receipt.blockNumber}`);
    } catch (txErr: any) {
      const errMsg = txErr?.message || String(txErr);
      console.error(`[Batch Lock] On-chain error:`, errMsg);

      if (!onChainError) {
        if (errMsg.includes("insufficient funds") || errMsg.includes("gas")) {
          onChainError = "INSUFFICIENT_GAS";
        } else if (errMsg.includes("already processed")) {
          onChainError = "ALREADY_PROCESSED";
        } else {
          onChainError = "CONTRACT_REVERT";
        }
      }

      const requestIds = pendingRequests.map((r) => r.id);
      await supabase
        .from("pplp_mint_requests")
        .update({
          status: "signed",
          signer_address: signerAddress,
          on_chain_error: onChainError,
        })
        .in("id", requestIds);

      return new Response(
        JSON.stringify({
          error: "On-chain transaction failed",
          on_chain_error: onChainError,
          details: errMsg.slice(0, 300),
          actions_count: pendingRequests.length,
          total_amount: totalRewardAll,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // UPDATE DB RECORDS
    // ============================================

    const freshSupabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date().toISOString();

    // The on-chain split is 99/1, calculate for DB logging
    const userAmount = Math.floor(totalRewardAll * 0.99);
    const platformAmount = totalRewardAll - userAmount;

    const requestIds = pendingRequests.map((r) => r.id);
    await freshSupabase
      .from("pplp_mint_requests")
      .update({
        status: "minted",
        tx_hash: txHash,
        minted_at: now,
        signer_address: signerAddress,
        on_chain_error: null,
      })
      .in("id", requestIds);

    const actionIds = pendingRequests.map((r) => r.action_id);
    await freshSupabase
      .from("pplp_actions")
      .update({
        status: "minted",
        minted_at: now,
        mint_request_hash: batchActionId,
      })
      .in("id", actionIds);

    // Distribution logs
    const distributionLogs = actionResults.map((ar) => ({
      action_id: ar.request.action_id,
      actor_id: actor_id,
      total_reward: ar.totalReward,
      user_amount: Math.floor(ar.totalReward * 0.99),
      user_percentage: 0.99,
      genesis_amount: 0,
      genesis_percentage: 0,
      platform_amount: ar.totalReward - Math.floor(ar.totalReward * 0.99),
      platform_percentage: 0.01,
      partners_amount: 0,
      partners_percentage: 0,
      fund_processing_status: "completed",
      mint_request_id: ar.request.id,
    }));

    try {
      await freshSupabase.from("fun_distribution_logs").insert(distributionLogs);
    } catch (logErr) {
      console.warn("[Batch Lock] Distribution log insert failed (non-fatal):", logErr);
    }

    // Update PoPL score
    try {
      await freshSupabase.rpc("update_popl_score", {
        _user_id: actor_id,
        _action_type: "batch_mint",
        _is_positive: true,
      });
    } catch {}

    // Notification
    try {
      const actionTypes = [...new Set(
        pendingRequests.map((r) => (r.pplp_actions as any)?.action_type || "UNKNOWN")
      )];

      await freshSupabase.from("notifications").insert({
        user_id: actor_id,
        type: "mint_approved",
        title: `✅ ${userAmount.toLocaleString()} FUN đã mint thành công! (${pendingRequests.length} hành động)`,
        content: `${pendingRequests.length} hành động (${actionTypes.join(", ")}) đã được mint on-chain. 99% cho bạn, 1% cho platform.`,
        reference_id: pendingRequests[0].action_id,
        reference_type: "pplp_action",
        metadata: {
          tx_hash: txHash,
          amount: userAmount,
          total_reward: totalRewardAll,
          actions_count: pendingRequests.length,
          action_types: actionTypes,
          batch: true,
        },
      });
    } catch (notifErr) {
      console.warn("[Batch Lock] Notification failed (non-fatal):", notifErr);
    }

    console.log(`[Batch Lock] ✓ Batch complete: ${pendingRequests.length} actions, ${userAmount}/${totalRewardAll} FUN, TX: ${txHash}`);

    return new Response(
      JSON.stringify({
        success: true,
        tx_hash: txHash,
        actions_count: pendingRequests.length,
        total_reward: totalRewardAll,
        user_amount: userAmount,
        platform_amount: platformAmount,
        actor_id,
        wallet_address,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Batch Lock] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
