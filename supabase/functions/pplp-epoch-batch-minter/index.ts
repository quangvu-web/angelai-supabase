import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.16.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BSC_TESTNET_RPC_LIST = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
  "https://bsc-testnet.blockpi.network/v1/rpc/public",
  "https://rpc.ankr.com/bsc_testnet_chapel",
];

const CONTRACT_ADDRESS = "0x39A1b047D5d143f8874888cfa1d30Fb2AE6F0CD6";

const CONTRACT_ABI = [
  "function nonces(address) view returns (uint256)",
  "function isAttester(address) view returns (bool)",
  "function attesterThreshold() view returns (uint256)",
  "function actions(bytes32) view returns (bool allowed, uint32 version, bool deprecated)",
  "function lockWithPPLP(address user, string action, uint256 amount, bytes32 evidenceHash, bytes[] sigs)",
  "function epochDuration() view returns (uint256)",
  "function epochMintCap() view returns (uint256)",
  "function epochs(bytes32) view returns (uint64 start, uint256 minted)",
];

const PPLP_DOMAIN = {
  name: "FUN Money",
  version: "1.2.1",
  chainId: 97,
  verifyingContract: CONTRACT_ADDRESS,
};

const PPLP_LOCK_TYPES = {
  PureLoveProof: [
    { name: "user", type: "address" },
    { name: "actionHash", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "evidenceHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
};

/** Max continuation depth to prevent infinite loops */
const MAX_CONTINUATION_DEPTH = 20;
/** Delay (seconds) before self-invoking continuation */
const CONTINUATION_DELAY_SECONDS = 5;
/** Max retries per user for race-condition EPOCH_CAP between estimateGas and TX */
const MAX_RACE_RETRIES_PER_USER = 3;
/** Base backoff delay in ms for race-condition retries */
const RACE_RETRY_BASE_DELAY_MS = 2000;

function hashActionName(name: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(name));
}

/** Check if an error message indicates an EPOCH_CAP revert */
function isEpochCapError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return lower.includes("epoch_cap") || lower.includes("epoch cap") ||
    (lower.includes("epoch") && lower.includes("cap"));
}

async function getProvider(): Promise<ethers.JsonRpcProvider | null> {
  for (const rpc of BSC_TESTNET_RPC_LIST) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      const network = await Promise.race([
        provider.getNetwork(),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 5000)),
      ]);
      if (network.chainId === 97n) return provider;
    } catch { continue; }
  }
  return null;
}

interface EpochInfo {
  epochDuration: bigint;
  epochMintCap: bigint;
  currentEpochMinted: bigint;
  remainingCap: bigint;
  currentEpochKey: string;
  epochResetTimestamp: bigint;
  blockTimestamp: bigint;
}

async function getEpochInfo(contract: ethers.Contract, provider: ethers.JsonRpcProvider): Promise<EpochInfo> {
  const [epochDuration, epochMintCap] = await Promise.all([
    contract.epochDuration(),
    contract.epochMintCap(),
  ]);

  const block = await provider.getBlock("latest");
  const timestamp = BigInt(block!.timestamp);
  const currentEpochIndex = timestamp / epochDuration;
  const epochResetTimestamp = (currentEpochIndex + 1n) * epochDuration;

  const epochKey = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [currentEpochIndex]));
  const epochData = await contract.epochs(epochKey);
  const currentEpochMinted = epochData.minted;
  const remainingCap = epochMintCap > currentEpochMinted ? epochMintCap - currentEpochMinted : 0n;

  const secondsUntilReset = Number(epochResetTimestamp - timestamp);
  console.log(`[BatchMinter] Epoch info: duration=${epochDuration}, cap=${epochMintCap}, minted=${currentEpochMinted}, remaining=${remainingCap}, reset_in=${secondsUntilReset}s`);

  return { epochDuration, epochMintCap, currentEpochMinted, remainingCap, currentEpochKey: epochKey, epochResetTimestamp, blockTimestamp: timestamp };
}

/** Build the epoch_info response object */
function epochInfoResponse(epochInfo: EpochInfo, extraFields: Record<string, unknown> = {}) {
  const secondsUntilReset = Number(epochInfo.epochResetTimestamp - epochInfo.blockTimestamp);
  const resetAtISO = new Date(Number(epochInfo.epochResetTimestamp) * 1000).toISOString();
  return {
    cap: epochInfo.epochMintCap.toString(),
    minted: epochInfo.currentEpochMinted.toString(),
    remaining: epochInfo.remainingCap.toString(),
    reset_in_seconds: secondsUntilReset,
    reset_at: resetAtISO,
    ...extraFields,
  };
}

/** Handle epoch cap reached: count pending, schedule post-reset, return response */
async function handleEpochCapReached(
  supabase: ReturnType<typeof createClient>,
  epochInfo: EpochInfo,
  continuationDepth: number,
  dryRun: boolean,
  extraResults: {
    processed: number;
    successCount: number;
    failCount: number;
    totalFunMinted: number;
    skippedUsers: number;
    results: unknown[];
  },
): Promise<Response> {
  const secondsUntilReset = Number(epochInfo.epochResetTimestamp - epochInfo.blockTimestamp);

  // Count all remaining signed requests (not just this batch)
  const { count } = await supabase
    .from("pplp_mint_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "signed");
  const pendingSigned = count || 0;

  console.log(`[BatchMinter] ⏸ EPOCH_CAP reached. ${pendingSigned} signed requests waiting. Epoch resets in ${secondsUntilReset}s (${Math.round(secondsUntilReset / 60)} min)`);

  // Schedule post-epoch continuation
  let continuationScheduled = false;
  if (pendingSigned > 0 && secondsUntilReset > 0 && secondsUntilReset <= 86400 && !dryRun) {
    await schedulePostEpochReset(supabase, secondsUntilReset + 60);
    continuationScheduled = true;
    console.log(`[BatchMinter] ✓ Post-epoch job scheduled for ${new Date(Number(epochInfo.epochResetTimestamp) * 1000 + 60000).toISOString()}`);
  }

  return new Response(JSON.stringify({
    success: true,
    dry_run: dryRun,
    epoch_cap_hit: true,
    epoch_info: epochInfoResponse(epochInfo),
    processed: extraResults.processed,
    success_count: extraResults.successCount,
    fail_count: extraResults.failCount,
    total_fun_minted: extraResults.totalFunMinted,
    skipped_too_large: extraResults.skippedUsers,
    pending_signed: pendingSigned,
    continuation_depth: continuationDepth,
    continuation_scheduled: continuationScheduled,
    next_attempt_at: continuationScheduled
      ? new Date(Number(epochInfo.epochResetTimestamp) * 1000 + 60000).toISOString()
      : null,
    message: `Epoch cap reached. ${extraResults.successCount} minted this run, ${pendingSigned} remaining. Next epoch in ${Math.round(secondsUntilReset / 60)} min.`,
    results: extraResults.results,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/**
 * Schedule a continuation call via pg_net (fire-and-forget).
 */
async function scheduleContinuation(
  supabase: ReturnType<typeof createClient>,
  depth: number,
  delaySec: number,
): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const functionUrl = `${supabaseUrl}/functions/v1/pplp-epoch-batch-minter`;

    console.log(`[BatchMinter] Scheduling continuation depth=${depth + 1} in ${delaySec}s`);

    const { error } = await supabase.rpc("_batch_minter_schedule_continuation", {
      _url: functionUrl,
      _api_key: anonKey,
      _depth: depth + 1,
      _delay_seconds: delaySec,
    });

    if (error) {
      console.warn(`[BatchMinter] pg_net schedule failed: ${error.message}, using direct fetch fallback`);
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ dry_run: false, _continuation_depth: depth + 1 }),
        signal: controller.signal,
      }).catch(() => { /* fire-and-forget */ });
      return true;
    }
    return true;
  } catch (err) {
    console.error(`[BatchMinter] Continuation scheduling error:`, err);
    return false;
  }
}

/**
 * Schedule a one-time pg_cron job to fire after the epoch resets.
 */
async function schedulePostEpochReset(
  supabase: ReturnType<typeof createClient>,
  delaySeconds: number,
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const functionUrl = `${supabaseUrl}/functions/v1/pplp-epoch-batch-minter`;

    const targetTime = new Date(Date.now() + delaySeconds * 1000);
    const minute = targetTime.getUTCMinutes();
    const hour = targetTime.getUTCHours();
    const day = targetTime.getUTCDate();
    const month = targetTime.getUTCMonth() + 1;

    const jobName = `batch-minter-post-epoch-${Date.now()}`;
    const cronExpr = `${minute} ${hour} ${day} ${month} *`;

    console.log(`[BatchMinter] Scheduling post-epoch job "${jobName}" at ${cronExpr} UTC (in ~${Math.round(delaySeconds / 60)} min)`);

    const { error } = await supabase.rpc("_batch_minter_schedule_post_epoch", {
      _job_name: jobName,
      _cron_expr: cronExpr,
      _url: functionUrl,
      _api_key: anonKey,
    });

    if (error) {
      console.warn(`[BatchMinter] Failed to schedule post-epoch job via RPC: ${error.message}`);
    } else {
      console.log(`[BatchMinter] ✓ Post-epoch job scheduled successfully`);
    }
  } catch (err) {
    console.error(`[BatchMinter] Error scheduling post-epoch reset:`, err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const signerPrivateKey = Deno.env.get("ATTESTER_PRIVATE_KEY") || Deno.env.get("TREASURY_PRIVATE_KEY");

    if (!signerPrivateKey) {
      return new Response(JSON.stringify({ error: "No signer key configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const formattedKey = signerPrivateKey.startsWith("0x") ? signerPrivateKey : `0x${signerPrivateKey}`;

    let dryRun = false;
    let continuationDepth = 0;
    try {
      const body = await req.json();
      dryRun = !!body?.dry_run;
      continuationDepth = body?._continuation_depth || 0;
    } catch { /* no body */ }

    console.log(`[BatchMinter] ▶ Starting run (depth=${continuationDepth}, dry_run=${dryRun})`);

    if (continuationDepth >= MAX_CONTINUATION_DEPTH) {
      console.warn(`[BatchMinter] Max continuation depth ${MAX_CONTINUATION_DEPTH} reached, stopping`);
      return new Response(JSON.stringify({
        success: true,
        message: `Max continuation depth reached (${MAX_CONTINUATION_DEPTH}). Will resume on next cron run.`,
        continuation_depth: continuationDepth,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Connect to BSC
    const provider = await getProvider();
    if (!provider) {
      return new Response(JSON.stringify({ error: "All BSC RPCs failed" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const signer = new ethers.Wallet(formattedKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // 2. Read on-chain epoch info
    let epochInfo = await getEpochInfo(contract, provider);

    // Early exit: epoch cap already 0
    if (epochInfo.remainingCap === 0n) {
      return handleEpochCapReached(supabase, epochInfo, continuationDepth, dryRun, {
        processed: 0, successCount: 0, failCount: 0, totalFunMinted: 0, skippedUsers: 0, results: [],
      });
    }

    // 3. Fetch signed requests
    const { data: signedRequests, error: fetchErr } = await supabase
      .from("pplp_mint_requests")
      .select("*")
      .in("status", ["signed"])
      .order("amount", { ascending: true }) // smallest first to maximize users per epoch
      .limit(500);

    if (fetchErr) throw fetchErr;

    if (!signedRequests || signedRequests.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No signed requests to process",
        processed: 0,
        epoch_info: epochInfoResponse(epochInfo),
        continuation_depth: continuationDepth,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Group by user (wallet_address)
    const userGroups: Record<string, typeof signedRequests> = {};
    for (const r of signedRequests) {
      const key = r.recipient_address;
      if (!userGroups[key]) userGroups[key] = [];
      userGroups[key].push(r);
    }

    // 5. Process users — with pre-flight estimateGas to detect EPOCH_CAP before sending TX
    let totalMintedThisRun = 0n;
    let remainingCap = epochInfo.remainingCap;
    const results: Array<{ user: string; amount: number; tx_hash: string | null; error: string | null }> = [];
    const UNIFIED_ACTION = "FUN_REWARD";
    const actionHash = hashActionName(UNIFIED_ACTION);
    let epochCapHit = false;
    let skippedUsers = 0;

    for (const [walletAddress, userRequests] of Object.entries(userGroups)) {
      // Check local remaining cap tracker
      if (remainingCap <= 0n) {
        console.log(`[BatchMinter] ⏸ Local cap tracker exhausted, stopping.`);
        epochCapHit = true;
        break;
      }

      const totalUserFUN = userRequests.reduce((s, r) => s + r.amount, 0);
      const totalUserWei = BigInt(totalUserFUN) * BigInt(10 ** 18);

      // Pre-flight: skip if user amount exceeds our tracked remaining cap
      if (totalUserWei > remainingCap) {
        console.log(`[BatchMinter] ⏭ Skip ${walletAddress}: needs ${totalUserFUN} FUN, only ${Number(remainingCap / BigInt(10**18))} FUN remaining`);
        skippedUsers++;
        continue;
      }

      if (dryRun) {
        results.push({ user: walletAddress, amount: totalUserFUN, tx_hash: null, error: "dry_run" });
        remainingCap -= totalUserWei;
        totalMintedThisRun += totalUserWei;
        continue;
      }

      // Retry loop for race-condition EPOCH_CAP between estimateGas and TX
      let userSuccess = false;
      for (let attempt = 0; attempt <= MAX_RACE_RETRIES_PER_USER; attempt++) {
        if (attempt > 0) {
          // Exponential backoff: 2s, 4s, 6s
          const backoffMs = RACE_RETRY_BASE_DELAY_MS * attempt;
          console.log(`[BatchMinter] 🔄 Retry ${attempt}/${MAX_RACE_RETRIES_PER_USER} for ${walletAddress} after ${backoffMs}ms backoff`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));

          // Re-check epoch cap after backoff — cap may have been fully consumed
          const freshEpoch = await getEpochInfo(contract, provider);
          if (freshEpoch.remainingCap <= 0n) {
            console.log(`[BatchMinter] ⏸ Epoch cap exhausted during retry backoff for ${walletAddress}`);
            epochInfo = freshEpoch;
            epochCapHit = true;
            results.push({ user: walletAddress, amount: totalUserFUN, tx_hash: null, error: "epoch_cap_wait" });
            break;
          }
          if (totalUserWei > freshEpoch.remainingCap) {
            console.log(`[BatchMinter] ⏸ Remaining cap (${Number(freshEpoch.remainingCap / BigInt(10**18))} FUN) < user need (${totalUserFUN} FUN) on retry`);
            epochInfo = freshEpoch;
            epochCapHit = true;
            results.push({ user: walletAddress, amount: totalUserFUN, tx_hash: null, error: "epoch_cap_wait" });
            break;
          }
          remainingCap = freshEpoch.remainingCap;
        }

        try {
          const nonce = await contract.nonces(walletAddress);
          const combinedEvidence = userRequests.map(r => r.evidence_hash || ethers.ZeroHash).join("");
          const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes(combinedEvidence));

          const message = {
            user: walletAddress,
            actionHash,
            amount: totalUserWei,
            evidenceHash,
            nonce,
          };

          const signature = await signer.signTypedData(PPLP_DOMAIN, PPLP_LOCK_TYPES, message);

          // ====== PRE-FLIGHT: estimateGas to detect EPOCH_CAP before spending gas ======
          try {
            await contract.lockWithPPLP.estimateGas(walletAddress, UNIFIED_ACTION, totalUserWei, evidenceHash, [signature]);
          } catch (estimateErr: any) {
            const estimateMsg = estimateErr?.message || String(estimateErr);

            if (isEpochCapError(estimateMsg)) {
              console.log(`[BatchMinter] ⏸ EPOCH_CAP detected at estimateGas for ${walletAddress} (${totalUserFUN} FUN). Stopping batch gracefully.`);
              epochInfo = await getEpochInfo(contract, provider);
              epochCapHit = true;
              results.push({ user: walletAddress, amount: totalUserFUN, tx_hash: null, error: "epoch_cap_wait" });
              break; // breaks retry loop; outer epochCapHit check stops user loop
            }

            // Non-epoch error at estimateGas — skip this user (no retry)
            console.error(`[BatchMinter] ✗ estimateGas failed for ${walletAddress}: ${estimateMsg}`);
            const requestIds = userRequests.map(r => r.id);
            await supabase
              .from("pplp_mint_requests")
              .update({ on_chain_error: estimateMsg.slice(0, 500) })
              .in("id", requestIds);
            results.push({ user: walletAddress, amount: totalUserFUN, tx_hash: null, error: estimateMsg.slice(0, 200) });
            userSuccess = true; // not retryable, exit retry loop
            break;
          }

          // ====== SEND TX (estimateGas passed) ======
          console.log(`[BatchMinter] 🔗 lockWithPPLP: user=${walletAddress}, amount=${totalUserFUN} FUN (${totalUserWei} wei)${attempt > 0 ? ` [retry ${attempt}]` : ""}`);
          const tx = await contract.lockWithPPLP(walletAddress, UNIFIED_ACTION, totalUserWei, evidenceHash, [signature]);
          const receipt = await tx.wait(1);

          if (receipt.status === 0) {
            throw new Error(`TX reverted: ${receipt.hash}`);
          }

          console.log(`[BatchMinter] ✓ ${walletAddress}: ${totalUserFUN} FUN → TX: ${receipt.hash}${attempt > 0 ? ` (after ${attempt} retries)` : ""}`);

          // Update mint requests to minted
          const requestIds = userRequests.map(r => r.id);
          await supabase
            .from("pplp_mint_requests")
            .update({
              status: "minted",
              tx_hash: receipt.hash,
              minted_at: new Date().toISOString(),
              on_chain_error: null,
            })
            .in("id", requestIds);

          // Update pplp_actions
          const actionIds = userRequests.map(r => r.action_id);
          await supabase
            .from("pplp_actions")
            .update({
              status: "minted",
              minted_at: new Date().toISOString(),
            })
            .in("id", actionIds);

          // Notification (non-fatal)
          try {
            await supabase.from("notifications").insert({
              user_id: userRequests[0].actor_id,
              type: "mint_approved",
              title: `✅ ${totalUserFUN.toLocaleString()} FUN đã mint on-chain!`,
              content: `FUN Money đã được lock on-chain thành công. Vào trang Mint để Activate & Claim.`,
              reference_id: userRequests[0].action_id,
              reference_type: "pplp_action",
              metadata: { tx_hash: receipt.hash, amount: totalUserFUN, retries: attempt },
            });
          } catch { /* non-fatal */ }

          results.push({ user: walletAddress, amount: totalUserFUN, tx_hash: receipt.hash, error: null });
          remainingCap -= totalUserWei;
          totalMintedThisRun += totalUserWei;
          userSuccess = true;
          break; // success — exit retry loop

        } catch (err: any) {
          const errMsg = err?.message || String(err);
          console.error(`[BatchMinter] ✗ ${walletAddress} (attempt ${attempt}): ${errMsg}`);

          if (isEpochCapError(errMsg)) {
            // TX-level EPOCH_CAP (race condition: cap filled between estimateGas and TX)
            if (attempt < MAX_RACE_RETRIES_PER_USER) {
              console.log(`[BatchMinter] 🔄 Race-condition EPOCH_CAP for ${walletAddress}. Will retry (${attempt + 1}/${MAX_RACE_RETRIES_PER_USER}) with backoff.`);
              continue; // retry with backoff
            }

            // Exhausted retries — treat as epoch cap hit, stop processing
            console.log(`[BatchMinter] ⏸ EPOCH_CAP persists after ${MAX_RACE_RETRIES_PER_USER} retries for ${walletAddress}. Stopping batch.`);
            epochInfo = await getEpochInfo(contract, provider);
            epochCapHit = true;
            results.push({ user: walletAddress, amount: totalUserFUN, tx_hash: null, error: "epoch_cap_wait" });
            break;
          }

          // Non-epoch error — mark on the requests, no retry
          const requestIds = userRequests.map(r => r.id);
          await supabase
            .from("pplp_mint_requests")
            .update({ on_chain_error: errMsg.slice(0, 500) })
            .in("id", requestIds);
          results.push({ user: walletAddress, amount: totalUserFUN, tx_hash: null, error: errMsg.slice(0, 200) });
          userSuccess = true; // not retryable
          break;
        }
      } // end retry loop

      if (epochCapHit) break; // stop processing other users
    }

    // 6. Summarize
    const successCount = results.filter(r => r.tx_hash).length;
    const failCount = results.filter(r => r.error && r.error !== "dry_run" && r.error !== "epoch_cap_wait").length;
    const epochCapWaitCount = results.filter(r => r.error === "epoch_cap_wait").length;

    console.log(`[BatchMinter] ■ Run complete: ✓${successCount} ✗${failCount} ⏸${epochCapWaitCount} ⏭${skippedUsers} | ${Number(totalMintedThisRun / BigInt(10**18))} FUN minted`);

    // 7. Handle epoch cap hit — delegate to unified handler
    if (epochCapHit) {
      return handleEpochCapReached(supabase, epochInfo, continuationDepth, dryRun, {
        processed: results.length,
        successCount,
        failCount,
        totalFunMinted: Number(totalMintedThisRun / BigInt(10**18)),
        skippedUsers,
        results: results.slice(0, 50),
      });
    }

    // 8. Self-continuation if more remain but cap not hit (timeout scenario)
    // Count actual remaining: total signed minus what we successfully minted or dry-ran
    const mintedOrDryRan = results.filter(r => r.tx_hash || r.error === "dry_run").length;
    const pendingRemaining = signedRequests.length - mintedOrDryRan + skippedUsers;
    let continuationScheduled = false;

    if (!dryRun && pendingRemaining > 0) {
      continuationScheduled = await scheduleContinuation(supabase, continuationDepth, CONTINUATION_DELAY_SECONDS);
      console.log(`[BatchMinter] Immediate continuation scheduled: ${continuationScheduled}`);
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      epoch_cap_hit: false,
      epoch_info: {
        ...epochInfoResponse(epochInfo),
        minted_before: epochInfo.currentEpochMinted.toString(),
        minted_this_run: totalMintedThisRun.toString(),
        remaining_after: remainingCap.toString(),
      },
      processed: results.length,
      success_count: successCount,
      fail_count: failCount,
      skipped_too_large: skippedUsers,
      total_fun_minted: Number(totalMintedThisRun / BigInt(10**18)),
      pending_remaining: pendingRemaining,
      continuation_depth: continuationDepth,
      continuation_scheduled: continuationScheduled,
      results: results.slice(0, 50),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[BatchMinter] Fatal error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
