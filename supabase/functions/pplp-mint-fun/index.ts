/**
 * pplp-mint-fun — Edge Function for Multisig 3-of-3 Mint Flow
 * 
 * Creates mint requests WITHOUT auto-signing.
 * GOV Attesters sign via MetaMask on AttesterPanel.
 * 
 * Input: { action_ids: string[], recipient_address: string }
 * Output: { success: true, mint_request_id, amount, amount_wei, ... }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "https://esm.sh/ethers@6.16.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_ID = "angel_ai";
const CONTRACT_ADDRESS = "0x39A1b047D5d143f8874888cfa1d30Fb2AE6F0CD6";
const BSC_TESTNET_CHAIN_ID = 97n;
const UNIFIED_ACTION = "FUN_REWARD";
const MAX_REQUESTS_PER_DAY = 2;
const MIN_AMOUNT = 200;

const BSC_TESTNET_RPC_LIST = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://bsc-testnet.blockpi.network/v1/rpc/public",
  "https://rpc.ankr.com/bsc_testnet_chapel",
];

const CONTRACT_ABI = [
  "function nonces(address) view returns (uint256)",
  "function isAttester(address) view returns (bool)",
];

function hashActionName(name: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(name));
}

function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function getOnChainNonce(walletAddress: string): Promise<bigint | null> {
  for (const rpcUrl of BSC_TESTNET_RPC_LIST) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000)
      );
      const network = await Promise.race([provider.getNetwork(), timeout]);
      if (network.chainId !== BSC_TESTNET_CHAIN_ID) continue;

      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const nonce = await Promise.race([contract.nonces(walletAddress), timeout]);
      return nonce;
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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action_ids, recipient_address } = await req.json();

    // Validate inputs
    if (!action_ids?.length) {
      return new Response(JSON.stringify({ error: "action_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!recipient_address || !isValidAddress(recipient_address)) {
      return new Response(JSON.stringify({ error: "Valid recipient_address required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check suspension
    const { data: suspension } = await supabase
      .from("user_suspensions")
      .select("id")
      .eq("user_id", user.id)
      .is("lifted_at", null)
      .maybeSingle();

    if (suspension) {
      return new Response(JSON.stringify({ error: "Account suspended" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check daily cap
    const today = new Date().toISOString().split("T")[0];
    const { count: todayCount } = await supabase
      .from("pplp_mint_requests")
      .select("*", { count: "exact", head: true })
      .eq("actor_id", user.id)
      .eq("platform_id", PLATFORM_ID)
      .gte("created_at", `${today}T00:00:00Z`);

    if ((todayCount || 0) >= MAX_REQUESTS_PER_DAY) {
      return new Response(
        JSON.stringify({ error: `Tối đa ${MAX_REQUESTS_PER_DAY} request/ngày` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch & validate actions
    const { data: actions, error: actionsError } = await supabase
      .from("pplp_actions")
      .select("*, pplp_scores(*)")
      .in("id", action_ids)
      .eq("actor_id", user.id);

    if (actionsError || !actions?.length) {
      return new Response(JSON.stringify({ error: "Actions not found or not yours" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate total reward from scored actions
    // Hybrid model: final_reward=0 is informational, use base_reward for per-action mint
    let totalReward = 0;
    for (const action of actions) {
      const score = Array.isArray(action.pplp_scores)
        ? action.pplp_scores[0]
        : action.pplp_scores;
      if (!score || score.decision !== "pass") continue;
      totalReward += score.base_reward || score.final_reward || 0;
    }

    if (totalReward < MIN_AMOUNT) {
      return new Response(
        JSON.stringify({ error: `Tối thiểu ${MIN_AMOUNT} FUN/request`, current: totalReward }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Flat 99/1 split (hotfix 2026-06-02): user 99%, ecosystem 1% chia đều 3 bucket
    // (genesis_community, fun_platform, fun_partners). Bỏ mô hình cascading cũ
    // (1% + 0.99% + 0.98% ≈ 2.93%) vì làm user thiệt ~2% và lệch spec on-chain 99/1.
    const totalBig = BigInt(totalReward);
    const userAmount = (totalBig * 99n) / 100n;
    const ecoTotal = totalBig - userAmount;
    const ecoEach = ecoTotal / 3n;
    const ecoRemainder = ecoTotal - ecoEach * 2n; // dồn phần lẻ vào fun_platform
    const distribution: Record<string, bigint> = {
      genesis_community: ecoEach,
      fun_platform: ecoRemainder,
      fun_partners: ecoEach,
    };
    const amountWei = (userAmount * BigInt(10 ** 18)).toString();

    // Get on-chain nonce
    const nonce = await getOnChainNonce(recipient_address);
    if (nonce === null) {
      return new Response(
        JSON.stringify({ error: "Cannot reach BSC Testnet" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build hashes
    const actionHash = hashActionName(UNIFIED_ACTION);
    let evidenceHash = ethers.ZeroHash;
    if (actions[0]?.evidence_hash) {
      const raw = actions[0].evidence_hash;
      evidenceHash = /^0x[a-fA-F0-9]{64}$/.test(raw)
        ? raw
        : ethers.keccak256(ethers.toUtf8Bytes(raw));
    }

    // Create mint request with status pending_sig (NO auto-signing)
    const { data: mintRequest, error: insertError } = await supabase
      .from("pplp_mint_requests")
      .insert({
        action_id: action_ids[0], // Primary action
        actor_id: user.id,
        recipient_address,
        amount: Number(userAmount),
        amount_wei: amountWei,
        action_hash: actionHash,
        evidence_hash: evidenceHash,
        nonce: Number(nonce),
        status: "pending_sig",
        platform_id: PLATFORM_ID,
        multisig_signatures: {},
        multisig_completed_groups: [],
        multisig_required_groups: ["will", "wisdom", "love"],
        policy_version: 1,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log distribution
    await supabase.from("fun_distribution_logs").insert({
      action_id: action_ids[0],
      actor_id: user.id,
      mint_request_id: mintRequest.id,
      total_reward: totalReward,
      user_amount: Number(userAmount),
      user_percentage: Number((userAmount * 10000n) / BigInt(totalReward)) / 100,
      genesis_amount: Number(distribution["genesis_community"] || 0n),
      genesis_percentage: Number(((distribution["genesis_community"] || 0n) * 10000n) / BigInt(totalReward)) / 100,
      platform_amount: Number(distribution["fun_platform"] || 0n),
      platform_percentage: Number(((distribution["fun_platform"] || 0n) * 10000n) / BigInt(totalReward)) / 100,
      partners_amount: Number(distribution["fun_partners"] || 0n),
      partners_percentage: Number(((distribution["fun_partners"] || 0n) * 10000n) / BigInt(totalReward)) / 100,
    });

    return new Response(
      JSON.stringify({
        success: true,
        mint_request_id: mintRequest.id,
        amount: Number(userAmount),
        amount_wei: amountWei,
        nonce: Number(nonce),
        action_hash: actionHash,
        evidence_hash: evidenceHash,
        status: "pending_sig",
        message: "Request created. Awaiting 3-of-3 GOV signatures.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("pplp-mint-fun error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
