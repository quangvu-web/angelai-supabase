import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Token contracts to monitor ──
const TOKEN_CONTRACTS: Record<string, { address: string; giftType: string; decimals: number }> = {
  CAMLY: {
    address: "0x0910320181889fefde0bb1ca63962b0a8882e413",
    giftType: "web3_CAMLY",
    decimals: 3,
  },
  USDT: {
    address: "0x55d398326f99059ff775485246999027b3197955",
    giftType: "web3_USDT",
    decimals: 18,
  },
  FUN: {
    address: "0x39a1b047d5d143f8874888cfa1d30fb2ae6f0cd6",
    giftType: "web3_FUN",
    decimals: 18,
  },
};

// ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7163c13e156eb6ca621e7a8a005";

// Block range per eth_getLogs query (public RPCs typically allow 5000)
const BLOCKS_PER_QUERY = 2000;
// Max blocks to process per invocation (prevent edge function timeout)
const MAX_BLOCKS_PER_RUN = 10000;
// Max addresses per topic filter batch
const MAX_ADDRS_PER_BATCH = 50;

// BSC Mainnet RPC fallbacks
const DEFAULT_RPC_URLS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc-rpc.publicnode.com",
];

// ── RPC Helpers ──

function padAddress(addr: string): string {
  return "0x" + addr.replace("0x", "").toLowerCase().padStart(64, "0");
}

function unpadAddress(padded: string): string {
  return "0x" + padded.slice(-40).toLowerCase();
}

function toHex(n: number): string {
  return "0x" + n.toString(16);
}

interface TransferLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

async function rpcCall(rpcUrls: string[], method: string, params: unknown[]): Promise<unknown> {
  let lastError: Error | null = null;
  for (const url of rpcUrls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) {
        lastError = new Error(`RPC ${method}: ${json.error.message}`);
        continue;
      }
      return json.result;
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError || new Error(`All RPCs failed for ${method}`);
}

async function getLatestBlock(rpcUrls: string[]): Promise<number> {
  const hex = await rpcCall(rpcUrls, "eth_blockNumber", []) as string;
  return parseInt(hex, 16);
}

async function getTransferLogs(
  rpcUrls: string[],
  contractAddress: string,
  fromBlock: number,
  toBlock: number,
  topicIndex: 1 | 2,
  addresses: string[],
): Promise<TransferLog[]> {
  const paddedAddrs = addresses.map(padAddress);
  const topics: (string | string[] | null)[] = [TRANSFER_TOPIC, null, null];
  topics[topicIndex] = paddedAddrs.length === 1 ? paddedAddrs[0] : paddedAddrs;

  const result = await rpcCall(rpcUrls, "eth_getLogs", [{
    address: contractAddress,
    fromBlock: toHex(fromBlock),
    toBlock: toHex(toBlock),
    topics,
  }]);

  return Array.isArray(result) ? result : [];
}

async function getBlockTimestamp(rpcUrls: string[], blockHex: string): Promise<number> {
  const block = await rpcCall(rpcUrls, "eth_getBlockByNumber", [blockHex, false]) as { timestamp: string } | null;
  return block ? parseInt(block.timestamp, 16) : Math.floor(Date.now() / 1000);
}

// ── Main Handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Build RPC URL list (env override + fallbacks)
    const envRpc = Deno.env.get("BSC_RPC_URL");
    const rpcUrls = envRpc ? [envRpc, ...DEFAULT_RPC_URLS] : DEFAULT_RPC_URLS;

    // ── Auth: determine caller type ──
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCronCall =
      (cronSecret && req.headers.get("x-cron-secret") === cronSecret) ||
      req.headers.get("x-cron-source") === "internal";

    let callerType: "admin" | "cron" | "user" = "user";
    let callerUserId: string | null = null;

    if (isCronCall) {
      callerType = "cron";
      console.log("Cron caller verified");
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await anonClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      callerUserId = user.id;
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      callerType = roleData ? "admin" : "user";
    }

    // ── Get wallets to scan ──
    let walletData: Array<{ user_id: string; wallet_address: string }> | null;

    if (callerType === "user" && callerUserId) {
      const { data } = await adminClient
        .from("user_wallet_addresses")
        .select("user_id, wallet_address")
        .eq("user_id", callerUserId)
        .not("wallet_address", "is", null);
      walletData = data;
    } else {
      const { data } = await adminClient
        .from("user_wallet_addresses")
        .select("user_id, wallet_address")
        .not("wallet_address", "is", null);
      walletData = data;
    }

    if (!walletData || walletData.length === 0) {
      return new Response(
        JSON.stringify({
          error: callerType === "user" ? "No wallet address registered" : "No wallet addresses found",
          synced: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const walletToUser = new Map<string, string>();
    for (const w of walletData) {
      if (w.wallet_address) walletToUser.set(w.wallet_address.toLowerCase(), w.user_id);
    }

    console.log(`Caller: ${callerType}, wallets: ${walletToUser.size}`);

    // ── Get last synced block ──
    const { data: syncState } = await adminClient
      .from("sync_state")
      .select("value_num")
      .eq("key", "last_synced_block")
      .maybeSingle();

    const latestBlock = await getLatestBlock(rpcUrls);

    // Default start: 1M blocks ago (~35 days on BSC at 3s/block)
    let fromBlock = syncState?.value_num
      ? Number(syncState.value_num)
      : Math.max(0, latestBlock - 1_000_000);

    if (fromBlock >= latestBlock) {
      return new Response(
        JSON.stringify({ success: true, message: "Already up to date", latestBlock }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const toBlock = Math.min(fromBlock + MAX_BLOCKS_PER_RUN, latestBlock);

    console.log(`Scanning blocks ${fromBlock} → ${toBlock} (${toBlock - fromBlock} blocks, latest: ${latestBlock})`);

    // ── Get existing tx hashes to skip duplicates ──
    const { data: existingGifts } = await adminClient
      .from("coin_gifts")
      .select("tx_hash")
      .not("tx_hash", "is", null);

    const existingHashes = new Set(
      (existingGifts || []).map((g) => g.tx_hash?.toLowerCase()),
    );

    // ── Fetch Transfer logs via BSC RPC ──
    const allLogs: Array<TransferLog & { _giftType: string; _decimals: number }> = [];
    let rpcCallCount = 0;

    const walletAddrs = Array.from(walletToUser.keys());

    // Split wallets into batches for topic filter
    const walletBatches: string[][] = [];
    for (let i = 0; i < walletAddrs.length; i += MAX_ADDRS_PER_BATCH) {
      walletBatches.push(walletAddrs.slice(i, i + MAX_ADDRS_PER_BATCH));
    }

    for (const [tokenName, config] of Object.entries(TOKEN_CONTRACTS)) {
      console.log(`Scanning ${tokenName}...`);

      for (let blockStart = fromBlock; blockStart < toBlock; blockStart += BLOCKS_PER_QUERY) {
        const blockEnd = Math.min(blockStart + BLOCKS_PER_QUERY - 1, toBlock);

        for (const batch of walletBatches) {
          // Transfers FROM registered wallets
          try {
            const fromLogs = await getTransferLogs(rpcUrls, config.address, blockStart, blockEnd, 1, batch);
            rpcCallCount++;
            for (const log of fromLogs) {
              allLogs.push({ ...log, _giftType: config.giftType, _decimals: config.decimals });
            }
          } catch (err) {
            console.error(`RPC error (from) ${tokenName} blocks ${blockStart}-${blockEnd}:`, String(err));
          }

          // Transfers TO registered wallets
          try {
            const toLogs = await getTransferLogs(rpcUrls, config.address, blockStart, blockEnd, 2, batch);
            rpcCallCount++;
            for (const log of toLogs) {
              allLogs.push({ ...log, _giftType: config.giftType, _decimals: config.decimals });
            }
          } catch (err) {
            console.error(`RPC error (to) ${tokenName} blocks ${blockStart}-${blockEnd}:`, String(err));
          }
        }
      }
    }

    // ── Deduplicate by tx hash (keep first event per tx, matching original behavior) ──
    const uniqueByTxHash = new Map<string, typeof allLogs[0]>();
    for (const log of allLogs) {
      const txHash = log.transactionHash.toLowerCase();
      if (!uniqueByTxHash.has(txHash)) {
        uniqueByTxHash.set(txHash, log);
      }
    }

    console.log(`Found ${uniqueByTxHash.size} unique transfers (${rpcCallCount} RPC calls)`);

    // ── Filter: skip existing, match to registered wallets ──
    // For user sync, need ALL registered wallets for counterparty resolution
    let fullWalletToUser = walletToUser;
    if (callerType === "user") {
      const { data: allWallets } = await adminClient
        .from("user_wallet_addresses")
        .select("user_id, wallet_address")
        .not("wallet_address", "is", null);
      fullWalletToUser = new Map<string, string>();
      for (const w of (allWallets || [])) {
        if (w.wallet_address) fullWalletToUser.set(w.wallet_address.toLowerCase(), w.user_id);
      }
    }

    const newEvents: Array<typeof allLogs[0] & { fromAddr: string; toAddr: string }> = [];
    let skippedExisting = 0;
    let skippedNoMatch = 0;

    for (const [txHash, log] of uniqueByTxHash) {
      if (existingHashes.has(txHash)) {
        skippedExisting++;
        continue;
      }

      const fromAddr = unpadAddress(log.topics[1]);
      const toAddr = unpadAddress(log.topics[2]);
      const senderId = fullWalletToUser.get(fromAddr);
      const receiverId = fullWalletToUser.get(toAddr);

      if (!senderId && !receiverId) {
        skippedNoMatch++;
        continue;
      }

      // Parse value
      const rawValue = log.data && log.data !== "0x" ? BigInt(log.data) : BigInt(0);
      const amount = Number(rawValue) / (10 ** log._decimals);
      if (amount <= 0) {
        skippedNoMatch++;
        continue;
      }

      newEvents.push({ ...log, fromAddr, toAddr });
    }

    console.log(`New events to insert: ${newEvents.length} (skipped existing: ${skippedExisting}, no match: ${skippedNoMatch})`);

    // ── Batch-fetch block timestamps only for new events ──
    const blockNumbers = new Set<string>();
    for (const ev of newEvents) {
      blockNumbers.add(ev.blockNumber);
    }

    const blockTimestamps = new Map<string, number>();
    for (const blockHex of blockNumbers) {
      try {
        const ts = await getBlockTimestamp(rpcUrls, blockHex);
        blockTimestamps.set(blockHex, ts);
        rpcCallCount++;
      } catch (err) {
        console.error(`Failed to get timestamp for block ${blockHex}:`, String(err));
        blockTimestamps.set(blockHex, Math.floor(Date.now() / 1000));
      }
    }

    // ── Insert new records ──
    let synced = 0;
    let failed = 0;

    for (const ev of newEvents) {
      const senderId = fullWalletToUser.get(ev.fromAddr) || "00000000-0000-0000-0000-000000000000";
      const receiverId = fullWalletToUser.get(ev.toAddr) || "00000000-0000-0000-0000-000000000000";

      const rawValue = ev.data && ev.data !== "0x" ? BigInt(ev.data) : BigInt(0);
      const amount = Number(rawValue) / (10 ** ev._decimals);
      const timestamp = blockTimestamps.get(ev.blockNumber) || Math.floor(Date.now() / 1000);

      const { error: insertError } = await adminClient.from("coin_gifts").insert({
        sender_id: senderId,
        receiver_id: receiverId,
        amount,
        tx_hash: ev.transactionHash,
        gift_type: ev._giftType,
        context_type: "direct",
        message: null,
        created_at: new Date(timestamp * 1000).toISOString(),
      });

      if (insertError) {
        if (insertError.message?.includes("duplicate") || insertError.message?.includes("unique")) {
          skippedExisting++;
        } else {
          console.error(`Insert error for ${ev.transactionHash}:`, insertError.message);
          failed++;
        }
      } else {
        synced++;
        existingHashes.add(ev.transactionHash.toLowerCase());
      }
    }

    // ── Update sync state ──
    await adminClient.from("sync_state").upsert({
      key: "last_synced_block",
      value_num: toBlock,
      updated_at: new Date().toISOString(),
    });

    const result = {
      success: true,
      callerType,
      walletsScanned: walletToUser.size,
      blocksProcessed: toBlock - fromBlock,
      fromBlock,
      toBlock,
      latestBlock,
      transfersFound: uniqueByTxHash.size,
      synced,
      skipped: skippedExisting + skippedNoMatch,
      failed,
      rpcCalls: rpcCallCount,
      catchUpRemaining: latestBlock - toBlock,
    };

    console.log("RPC sync result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
