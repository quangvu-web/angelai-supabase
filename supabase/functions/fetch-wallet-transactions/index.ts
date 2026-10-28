import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TREASURY_WALLET = "0x416336c3b7acae89f47ead2707412f20da159ac8";
const CAMLY_CONTRACT = "0x0910320181889fefde0bb1ca63962b0a8882e413";

// Known tokens on BSC Mainnet
const KNOWN_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  "0x0910320181889fefde0bb1ca63962b0a8882e413": { symbol: "CAMLY", name: "Camly Token", decimals: 18 },
  "0x55d398326f99059ff775485246999027b3197955": { symbol: "USDT", name: "Tether USD", decimals: 18 },
  "0x39a1b047d5d143f8874888cfa1d30fb2ae6f0cd6": { symbol: "FUN", name: "FUN Token", decimals: 18 },
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": { symbol: "BUSD", name: "Binance USD", decimals: 18 },
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": { symbol: "WBNB", name: "Wrapped BNB", decimals: 18 },
};

// ERC-20 Transfer event signature
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7163c13e156eb6ca621e7a8a005";
// ERC-20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = "0x70a08231";

// BSC Mainnet RPC fallbacks
const DEFAULT_RPC_URLS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://bsc-dataseed1.ninicoin.io",
  "https://bsc-rpc.publicnode.com",
];

// Max blocks to scan for transaction history (~3.5 days at 3s/block)
const HISTORY_BLOCKS = 100_000;
const BLOCKS_PER_QUERY = 5000;

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

async function getBalance(rpcUrls: string[], address: string): Promise<string> {
  const hex = await rpcCall(rpcUrls, "eth_getBalance", [address, "latest"]) as string;
  return BigInt(hex).toString();
}

async function getTokenBalance(rpcUrls: string[], tokenContract: string, walletAddress: string): Promise<string> {
  const data = BALANCE_OF_SELECTOR + padAddress(walletAddress).slice(2);
  const result = await rpcCall(rpcUrls, "eth_call", [
    { to: tokenContract, data },
    "latest",
  ]) as string;
  return result && result !== "0x" ? BigInt(result).toString() : "0";
}

interface TransferLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

async function getTransferLogs(
  rpcUrls: string[],
  fromBlock: number,
  toBlock: number,
  topicIndex: 1 | 2,
  walletAddress: string,
): Promise<TransferLog[]> {
  const paddedAddr = padAddress(walletAddress);
  const topics: (string | null)[] = [TRANSFER_TOPIC, null, null];
  topics[topicIndex] = paddedAddr;

  const result = await rpcCall(rpcUrls, "eth_getLogs", [{
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { wallet_address } = await req.json();
    if (!wallet_address) {
      return new Response(JSON.stringify({ error: "wallet_address required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const addr = wallet_address.toLowerCase();

    // Verify wallet ownership
    const { data: walletRecord } = await supabase
      .from("user_wallet_addresses")
      .select("id")
      .eq("user_id", user.id)
      .eq("wallet_address", wallet_address)
      .maybeSingle();

    if (!walletRecord) {
      return new Response(JSON.stringify({ error: "Wallet not linked to your account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build RPC URL list
    const envRpc = Deno.env.get("BSC_RPC_URL");
    const rpcUrls = envRpc ? [envRpc, ...DEFAULT_RPC_URLS] : DEFAULT_RPC_URLS;

    // Fetch known Angel AI wallets and user names
    const { data: knownWallets } = await supabase
      .from("user_wallet_addresses")
      .select("wallet_address, user_id");

    const knownSet = new Map<string, string>();
    (knownWallets || []).forEach((w: { wallet_address: string | null; user_id: string }) => {
      if (w.wallet_address) knownSet.set(w.wallet_address.toLowerCase(), w.user_id);
    });

    const userIds = Array.from(new Set(knownSet.values()));
    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      (profiles || []).forEach((p: { user_id: string; display_name: string | null }) => {
        if (p.display_name) nameMap.set(p.user_id, p.display_name);
      });
    }

    // ── Fetch token transfer logs via RPC ──
    const latestBlock = await getLatestBlock(rpcUrls);
    const startBlock = Math.max(0, latestBlock - HISTORY_BLOCKS);

    const allLogs: TransferLog[] = [];

    for (let blockStart = startBlock; blockStart < latestBlock; blockStart += BLOCKS_PER_QUERY) {
      const blockEnd = Math.min(blockStart + BLOCKS_PER_QUERY - 1, latestBlock);

      // Transfers FROM this wallet (all tokens)
      try {
        const fromLogs = await getTransferLogs(rpcUrls, blockStart, blockEnd, 1, addr);
        allLogs.push(...fromLogs);
      } catch (err) {
        console.error(`RPC error (from) blocks ${blockStart}-${blockEnd}:`, String(err));
      }

      // Transfers TO this wallet (all tokens)
      try {
        const toLogs = await getTransferLogs(rpcUrls, blockStart, blockEnd, 2, addr);
        allLogs.push(...toLogs);
      } catch (err) {
        console.error(`RPC error (to) blocks ${blockStart}-${blockEnd}:`, String(err));
      }
    }

    // ── Fetch balances via RPC ──
    let bnbBalance = "0";
    let camlyBalance = "0";
    try {
      const [bnb, camly] = await Promise.all([
        getBalance(rpcUrls, wallet_address),
        getTokenBalance(rpcUrls, "0x0910320181889feFDE0BB1Ca63962b0A8882e413", wallet_address),
      ]);
      bnbBalance = bnb;
      camlyBalance = camly;
    } catch (e) {
      console.error("Balance fetch error:", e);
    }

    // ── Fetch block timestamps for unique blocks ──
    const blockNumbers = new Set<string>();
    for (const log of allLogs) {
      blockNumbers.add(log.blockNumber);
    }

    const blockTimestamps = new Map<string, number>();
    // Batch fetch timestamps (limit to avoid timeout)
    const blockArray = Array.from(blockNumbers).slice(0, 200);
    for (const blockHex of blockArray) {
      try {
        const ts = await getBlockTimestamp(rpcUrls, blockHex);
        blockTimestamps.set(blockHex, ts);
      } catch {
        // Estimate: BSC 3s/block
        const blockNum = parseInt(blockHex, 16);
        const estimatedTs = Math.floor(Date.now() / 1000) - (latestBlock - blockNum) * 3;
        blockTimestamps.set(blockHex, estimatedTs);
      }
    }

    // ── Classify helper ──
    function classify(counterparty: string) {
      const cp = counterparty.toLowerCase();
      if (cp === TREASURY_WALLET) {
        return { source: "angel_ai" as const, counterparty_name: "Angel AI Treasury" };
      }
      const userId = knownSet.get(cp);
      if (userId) {
        return { source: "angel_ai" as const, counterparty_name: nameMap.get(userId) || "Angel AI User" };
      }
      return { source: "external" as const, counterparty_name: undefined };
    }

    // ── Build transactions from logs ──
    const transactions: unknown[] = [];

    for (const log of allLogs) {
      const contractAddr = log.address.toLowerCase();
      const fromAddr = unpadAddress(log.topics[1]);
      const toAddr = unpadAddress(log.topics[2]);
      const direction = fromAddr === addr ? "out" : "in";
      const counterparty = direction === "out" ? toAddr : fromAddr;
      const { source, counterparty_name } = classify(counterparty);

      // Resolve token info
      const tokenInfo = KNOWN_TOKENS[contractAddr] || { symbol: "Unknown", name: "Unknown Token", decimals: 18 };

      // Parse value
      const rawValue = log.data && log.data !== "0x" ? BigInt(log.data).toString() : "0";

      // Get timestamp (estimated if not fetched)
      const blockNum = parseInt(log.blockNumber, 16);
      let timestamp = blockTimestamps.get(log.blockNumber);
      if (!timestamp) {
        timestamp = Math.floor(Date.now() / 1000) - (latestBlock - blockNum) * 3;
      }

      transactions.push({
        hash: log.transactionHash,
        from: fromAddr,
        to: toAddr,
        value: rawValue,
        tokenSymbol: tokenInfo.symbol,
        tokenName: tokenInfo.name,
        tokenDecimal: String(tokenInfo.decimals),
        contractAddress: contractAddr,
        timestamp,
        type: "token",
        source,
        direction,
        counterparty_name,
        status: "confirmed",
      });
    }

    // ── Deduplicate and sort ──
    const seen = new Set<string>();
    const unique = transactions.filter((tx: any) => {
      const key = `${tx.hash}-${tx.type}-${tx.from}-${tx.to}-${tx.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a: any, b: any) => b.timestamp - a.timestamp);

    return new Response(
      JSON.stringify({
        transactions: unique,
        balances: {
          bnb: bnbBalance,
          camly: camlyBalance,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Internal error";
    console.error("fetch-wallet-transactions error:", error);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
