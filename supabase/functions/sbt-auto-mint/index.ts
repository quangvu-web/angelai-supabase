// SBT Auto-Mint Edge Function (Phase 5 — P)
// Pulls pending items from sbt_onchain_queue and mints on BSC Testnet.
// Falls back to "simulation mode" when SBT_CONTRACT_ADDRESS is not set —
// records a synthetic tx_hash so the pipeline can be tested end-to-end.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.16.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BSC_TESTNET_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
  "https://bsc-testnet.blockpi.network/v1/rpc/public",
];

// Minimal SBT (ERC-5114-style) ABI — adjust when real contract deployed.
const SBT_ABI = [
  "function mint(address to, string tokenURI) returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

const MAX_BATCH = 10; // mint up to N per invocation to stay within Edge time limit

async function recordJobRun(
  supabase: any,
  startedAt: number,
  status: "success" | "skipped" | "failed",
  processedCount: number,
  errorCount = 0,
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from("system_job_runs").insert({
      job_name: "sbt-auto-mint",
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      status,
      processed_count: processedCount,
      skipped_count: status === "skipped" ? 1 : 0,
      error_count: errorCount,
      metadata,
    });
  } catch (error) {
    console.warn("[SBTAutoMint] job run log skipped:", error);
  }
}

async function getProvider(): Promise<ethers.JsonRpcProvider | null> {
  for (const rpc of BSC_TESTNET_RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(rpc);
      const net = await Promise.race([
        p.getNetwork(),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 5000)),
      ]);
      if (net.chainId === 97n) return p;
    } catch { continue; }
  }
  return null;
}

interface QueueItem {
  id: string;
  sbt_id: string;
  user_id: string;
  wallet_address: string;
  network: string;
  metadata_uri: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let dryRun = false;
    let limit = MAX_BATCH;
    try {
      const body = await req.json();
      dryRun = !!body?.dry_run;
      if (typeof body?.limit === "number") limit = Math.min(body.limit, MAX_BATCH);
    } catch { /* no body */ }

    const { data: pendingItem, error: pendingError } = await supabase
      .from("sbt_onchain_queue")
      .select("id")
      .eq("network", "bsc-testnet")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pendingError) throw pendingError;

    if (!pendingItem) {
      await recordJobRun(supabase, startedAt, "skipped", 0, 0, { reason: "no_pending_sbt" });
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: "no_pending_sbt",
        processed: 0,
        results: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contractAddress = Deno.env.get("SBT_CONTRACT_ADDRESS"); // optional
    const minterKey = Deno.env.get("SBT_MINTER_PRIVATE_KEY") || Deno.env.get("ATTESTER_PRIVATE_KEY");
    const simulationMode = !contractAddress || !minterKey;

    let provider: ethers.JsonRpcProvider | null = null;
    let signer: ethers.Wallet | null = null;
    let contract: ethers.Contract | null = null;

    if (!simulationMode) {
      provider = await getProvider();
      if (!provider) {
        return new Response(JSON.stringify({ error: "All BSC RPCs failed" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const formatted = minterKey!.startsWith("0x") ? minterKey! : `0x${minterKey}`;
      signer = new ethers.Wallet(formatted, provider);
      contract = new ethers.Contract(contractAddress!, SBT_ABI, signer);
    }

    const results: Array<{ queue_id: string; status: string; tx_hash?: string; error?: string }> = [];
    let processed = 0;

    for (let i = 0; i < limit; i++) {
      // claim next pending
      const { data: claim, error: claimErr } = await supabase.rpc("claim_next_sbt_mint", {
        _network: "bsc-testnet",
        _max_retry: 3,
      });
      if (claimErr) throw claimErr;
      if (!claim?.success || !claim?.item) break;

      const item = claim.item as QueueItem;
      processed++;

      if (dryRun) {
        results.push({ queue_id: item.id, status: "dry_run" });
        // release back to pending
        await supabase.from("sbt_onchain_queue")
          .update({ status: "pending", processed_at: null })
          .eq("id", item.id);
        continue;
      }

      try {
        let txHash: string;
        let blockNumber = 0;
        let tokenId: string;
        let usedContract: string;

        if (simulationMode) {
          // synthesize a deterministic pseudo-tx
          txHash = "0xSIM" + ethers.keccak256(ethers.toUtf8Bytes(item.id)).slice(5, 65);
          blockNumber = Math.floor(Date.now() / 1000);
          tokenId = item.sbt_id.replace(/-/g, "").slice(0, 16);
          usedContract = "0xSIMULATION";
          console.log(`[SBTAutoMint][SIM] queue=${item.id} → ${txHash}`);
        } else {
          const tokenURI = item.metadata_uri ?? `did://sbt/${item.sbt_id}`;
          const tx = await contract!.mint(item.wallet_address, tokenURI);
          const receipt = await tx.wait(1);
          if (receipt.status === 0) throw new Error(`TX reverted: ${receipt.hash}`);
          txHash = receipt.hash;
          blockNumber = receipt.blockNumber;
          // best-effort token id from event log; fall back to totalSupply
          try {
            const total: bigint = await contract!.totalSupply();
            tokenId = total.toString();
          } catch {
            tokenId = "0";
          }
          usedContract = contractAddress!;
          console.log(`[SBTAutoMint] queue=${item.id} → ${txHash}`);
        }

        const { error: markErr } = await supabase.rpc("mark_sbt_minted", {
          _queue_id: item.id,
          _tx_hash: txHash,
          _block_number: blockNumber,
          _on_chain_token_id: tokenId,
          _contract_address: usedContract,
        });
        if (markErr) throw markErr;

        // notify user
        try {
          await supabase.from("notifications").insert({
            user_id: item.user_id,
            type: "sbt_minted",
            title: simulationMode ? "🎖️ SBT đã mint (simulation)" : "🎖️ SBT đã mint on-chain!",
            content: simulationMode
              ? "Hệ thống đang chạy ở chế độ simulation. SBT sẽ on-chain thực sự khi smart contract được deploy."
              : `SBT của bạn đã được khắc on-chain. Tx: ${txHash.slice(0,10)}...`,
            reference_id: item.sbt_id,
            reference_type: "sbt",
            metadata: { tx_hash: txHash, network: item.network, simulation: simulationMode },
          });
        } catch { /* non-fatal */ }

        results.push({ queue_id: item.id, status: "minted", tx_hash: txHash });
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error(`[SBTAutoMint] FAIL queue=${item.id}: ${msg}`);
        await supabase.rpc("mark_sbt_failed", {
          _queue_id: item.id,
          _error_message: msg.slice(0, 500),
        });
        results.push({ queue_id: item.id, status: "failed", error: msg.slice(0, 200) });
      }
    }

    await recordJobRun(supabase, startedAt, "success", processed, results.filter((r) => r.status === "failed").length, {
      simulation_mode: simulationMode,
      dry_run: dryRun,
    });

    return new Response(JSON.stringify({
      success: true,
      simulation_mode: simulationMode,
      dry_run: dryRun,
      processed,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[SBTAutoMint] Fatal:", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
