// Connector Indexer — quét BSC Testnet để xác định First On-chain Giver
// Chạy theo cron mỗi 5 phút (hoặc gọi trực tiếp với { user_id } để force scan).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHAIN_ID = 97; // BSC Testnet
const BSC_TESTNET_RPCS = [
  "https://data-seed-prebsc-1-s1.binance.org:8545",
  "https://data-seed-prebsc-2-s1.binance.org:8545",
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bsc-testnet.public.blastapi.io",
];

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7163c13e156eb6ca621e7a8a005";

const BLOCKS_PER_QUERY = 2000;
const MAX_USERS_PER_RUN = 50;

interface TokenMeta {
  symbol: string;
  decimals: number;
  minRaw: bigint;
}

interface ConnectorParams {
  windowHours: number;
  maxPerWalletPerDay: number;
  disputeWindowDays: number;
  confirmations: number;
  rewardPLS: number;
}

const DEFAULT_PARAMS: ConnectorParams = {
  windowHours: 48,
  maxPerWalletPerDay: 5,
  disputeWindowDays: 7,
  confirmations: 12,
  rewardPLS: 5,
};

async function loadParams(supabase: any): Promise<ConnectorParams> {
  const { data } = await supabase
    .from("pplp_parameter_config")
    .select("key, value")
    .in("key", [
      "connector_window_hours",
      "connector_max_per_wallet_per_day",
      "connector_dispute_window_days",
      "connector_confirmations",
      "connector_reward_pls",
    ]);
  const m: Record<string, number> = {};
  for (const r of data ?? []) {
    const v = typeof r.value === "number"
      ? r.value
      : Number(typeof r.value === "string" ? r.value : JSON.stringify(r.value));
    if (!Number.isNaN(v)) m[r.key] = v;
  }
  return {
    windowHours: m.connector_window_hours ?? DEFAULT_PARAMS.windowHours,
    maxPerWalletPerDay: m.connector_max_per_wallet_per_day ?? DEFAULT_PARAMS.maxPerWalletPerDay,
    disputeWindowDays: m.connector_dispute_window_days ?? DEFAULT_PARAMS.disputeWindowDays,
    confirmations: m.connector_confirmations ?? DEFAULT_PARAMS.confirmations,
    rewardPLS: m.connector_reward_pls ?? DEFAULT_PARAMS.rewardPLS,
  };
}

async function loadWhitelist(supabase: any): Promise<{
  byContract: Map<string, TokenMeta>;
  native: TokenMeta | null;
}> {
  const { data } = await supabase
    .from("connector_token_whitelist")
    .select("token_address, symbol, decimals, min_value_raw, active")
    .eq("chain_id", CHAIN_ID)
    .eq("active", true);
  const byContract = new Map<string, TokenMeta>();
  let native: TokenMeta | null = null;
  for (const r of data ?? []) {
    const meta: TokenMeta = {
      symbol: r.symbol,
      decimals: r.decimals,
      minRaw: BigInt(r.min_value_raw ?? 0),
    };
    if (r.token_address === "native") native = meta;
    else byContract.set(String(r.token_address).toLowerCase(), meta);
  }
  return { byContract, native };
}

function toHex(n: number): string {
  return "0x" + n.toString(16);
}
function unpadAddress(padded: string): string {
  return "0x" + padded.slice(-40).toLowerCase();
}
function padAddress(addr: string): string {
  return "0x" + addr.replace("0x", "").toLowerCase().padStart(64, "0");
}

async function rpc(method: string, params: unknown[]): Promise<any> {
  let lastErr: unknown;
  for (const url of BSC_TESTNET_RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (json.error) {
        lastErr = new Error(`${method}: ${json.error.message}`);
        continue;
      }
      return json.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error(`All RPCs failed for ${method}`);
}

async function getLatestBlock(): Promise<number> {
  const hex = (await rpc("eth_blockNumber", [])) as string;
  return parseInt(hex, 16);
}

async function getBlockByTimestamp(targetTs: number, latest: number): Promise<number> {
  // Estimate using BSC ~3s per block, then snap. Good enough for window scan.
  const nowSec = Math.floor(Date.now() / 1000);
  const delta = Math.max(0, nowSec - targetTs);
  const estimated = Math.max(0, latest - Math.floor(delta / 3) - 10);
  return estimated;
}

interface Log {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
}

async function getIncomingTransferLogs(
  toWallet: string,
  fromBlock: number,
  toBlock: number,
): Promise<Log[]> {
  const topics: (string | null)[] = [TRANSFER_TOPIC, null, padAddress(toWallet)];
  const all: Log[] = [];
  for (let s = fromBlock; s <= toBlock; s += BLOCKS_PER_QUERY) {
    const e = Math.min(s + BLOCKS_PER_QUERY - 1, toBlock);
    try {
      const res = (await rpc("eth_getLogs", [
        { fromBlock: toHex(s), toBlock: toHex(e), topics },
      ])) as Log[];
      if (Array.isArray(res)) all.push(...res);
    } catch (err) {
      console.error(`getLogs ${s}-${e}: ${String(err)}`);
    }
  }
  return all;
}

// Native BNB scan — only invoked for tail-window users (≤ 6h remaining)
// Strategy: walk recent blocks via eth_getBlockByNumber(blockTag, true) and
// inspect tx.to == wallet AND tx.value > 0 AND tx.input == '0x' (no contract call).
// Capped at NATIVE_SCAN_MAX_BLOCKS to keep RPC load bounded.
const NATIVE_SCAN_MAX_BLOCKS = 500;

interface NativeCandidate {
  blockNumber: number;
  txIndex: number;
  txHash: string;
  fromWallet: string;
  rawValue: bigint; // wei
}

async function getNativeTransfersTo(
  wallet: string,
  fromBlock: number,
  toBlock: number,
): Promise<NativeCandidate[]> {
  const target = wallet.toLowerCase();
  const span = Math.max(0, toBlock - fromBlock + 1);
  if (span === 0) return [];
  // Scan only the most recent NATIVE_SCAN_MAX_BLOCKS within the window
  const start = span > NATIVE_SCAN_MAX_BLOCKS ? toBlock - NATIVE_SCAN_MAX_BLOCKS + 1 : fromBlock;
  const out: NativeCandidate[] = [];
  for (let bn = start; bn <= toBlock; bn++) {
    try {
      const block = await rpc("eth_getBlockByNumber", [toHex(bn), true]);
      if (!block || !Array.isArray(block.transactions)) continue;
      for (const tx of block.transactions) {
        const to = (tx?.to || "").toLowerCase();
        if (to !== target) continue;
        const input = (tx?.input || "0x").toLowerCase();
        if (input !== "0x") continue; // skip contract calls
        const valHex: string = tx?.value || "0x0";
        const raw = BigInt(valHex);
        if (raw === 0n) continue;
        out.push({
          blockNumber: parseInt(tx.blockNumber, 16),
          txIndex: parseInt(tx.transactionIndex, 16),
          txHash: tx.hash,
          fromWallet: String(tx.from || "").toLowerCase(),
          rawValue: raw,
        });
      }
    } catch (err) {
      console.warn(`native scan block ${bn} failed: ${String(err)}`);
    }
  }
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return "0x" + Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface Candidate {
  blockNumber: number;
  txIndex: number;
  txHash: string;
  fromWallet: string;
  tokenContract: string;
  tokenSymbol: string;
  rawValue: bigint;
  decimals: number;
}

function meetsThreshold(cand: Candidate, meta: TokenMeta): boolean {
  return cand.rawValue >= meta.minRaw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let onlyUserId: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.user_id) onlyUserId = String(body.user_id);
    }
  } catch (_) { /* ignore */ }

  try {
    const params = await loadParams(supabase);
    const { byContract, native } = await loadWhitelist(supabase);
    if (byContract.size === 0) {
      console.log("no active token whitelist; skipping ERC20 scan");
    }

    let q = supabase
      .from("profiles")
      .select("user_id, created_at, connector_window_expires_at, has_connector")
      .eq("has_connector", false)
      .gt("connector_window_expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(MAX_USERS_PER_RUN);
    if (onlyUserId) q = q.eq("user_id", onlyUserId);

    const { data: users, error: usersErr } = await q;
    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const latest = await getLatestBlock();
    const safeHead = latest - params.confirmations;
    let processed = 0;
    let claimed = 0;

    for (const u of users) {
      processed++;

      const { data: wallets } = await supabase
        .from("user_wallet_addresses")
        .select("wallet_address")
        .eq("user_id", u.user_id);
      const myWallets = (wallets ?? [])
        .map((w: any) => String(w.wallet_address || "").toLowerCase())
        .filter(Boolean);

      const { data: did } = await supabase
        .from("user_dids")
        .select("did, wallet_address, secondary_wallets")
        .eq("user_id", u.user_id)
        .maybeSingle();
      const newcomerDid = did?.did ?? null;
      if (did?.wallet_address) myWallets.push(String(did.wallet_address).toLowerCase());
      if (Array.isArray(did?.secondary_wallets)) {
        for (const w of did.secondary_wallets) {
          if (typeof w === "string") myWallets.push(w.toLowerCase());
        }
      }
      const myWalletSet = new Set(myWallets);

      if (myWalletSet.size === 0) {
        await supabase.from("connector_events").insert({
          newcomer_user_id: u.user_id,
          reason: "no_wallet_linked",
          payload: {},
        });
        continue;
      }

      const createdSec = Math.floor(new Date(u.created_at).getTime() / 1000);
      const expireSec = Math.min(
        Math.floor(new Date(u.connector_window_expires_at).getTime() / 1000),
        Math.floor(Date.now() / 1000),
      );
      const fromBlock = await getBlockByTimestamp(createdSec, latest);
      const toBlock = Math.min(
        await getBlockByTimestamp(expireSec, latest) + 100,
        safeHead,
      );
      if (toBlock <= fromBlock) continue;

      const candidates: Candidate[] = [];
      for (const w of myWalletSet) {
        const logs = await getIncomingTransferLogs(w, fromBlock, toBlock);
        for (const log of logs) {
          const fromAddr = unpadAddress(log.topics[1]);
          if (myWalletSet.has(fromAddr)) continue;
          const tokenContract = log.address.toLowerCase();
          const meta = byContract.get(tokenContract);
          if (!meta) continue;
          const rawValue = log.data && log.data !== "0x" ? BigInt(log.data) : 0n;
          if (rawValue === 0n) continue;
          candidates.push({
            blockNumber: parseInt(log.blockNumber, 16),
            txIndex: parseInt(log.transactionIndex, 16),
            txHash: log.transactionHash,
            fromWallet: fromAddr,
            tokenContract,
            tokenSymbol: meta.symbol,
            rawValue,
            decimals: meta.decimals,
          });
        }
      }

      // Native BNB scan — only when window remaining ≤ 6h to bound RPC load
      const remainingMs = new Date(u.connector_window_expires_at).getTime() - Date.now();
      const inTailWindow = remainingMs > 0 && remainingMs <= 6 * 3600 * 1000;
      if (native && inTailWindow) {
        for (const w of myWalletSet) {
          const natTxs = await getNativeTransfersTo(w, fromBlock, toBlock);
          for (const tx of natTxs) {
            if (myWalletSet.has(tx.fromWallet)) continue;
            candidates.push({
              blockNumber: tx.blockNumber,
              txIndex: tx.txIndex,
              txHash: tx.txHash,
              fromWallet: tx.fromWallet,
              tokenContract: "native",
              tokenSymbol: native.symbol,
              rawValue: tx.rawValue,
              decimals: native.decimals,
            });
          }
        }
      }

      candidates.sort((a, b) =>
        a.blockNumber - b.blockNumber || a.txIndex - b.txIndex
      );

      let chosen: Candidate | null = null;
      let chosenMeta: TokenMeta | null = null;
      for (const cand of candidates) {
        const meta = cand.tokenContract === "native"
          ? native!
          : byContract.get(cand.tokenContract)!;
        if (!meetsThreshold(cand, meta)) {
          await supabase.from("connector_events").insert({
            newcomer_user_id: u.user_id,
            candidate_wallet: cand.fromWallet,
            tx_hash: cand.txHash,
            reason: "below_threshold",
            payload: { token: cand.tokenSymbol, value: cand.rawValue.toString() },
          });
          continue;
        }

        const { data: senderWallet } = await supabase
          .from("user_wallet_addresses")
          .select("user_id")
          .ilike("wallet_address", cand.fromWallet)
          .maybeSingle();
        const connectorUserId = senderWallet?.user_id ?? null;

        if (connectorUserId === u.user_id) {
          await supabase.from("connector_events").insert({
            newcomer_user_id: u.user_id,
            candidate_wallet: cand.fromWallet,
            tx_hash: cand.txHash,
            reason: "same_owner",
            payload: {},
          });
          continue;
        }

        if (connectorUserId) {
          const { data: trust } = await supabase
            .from("trust_profile")
            .select("sybil_risk, fraud_risk")
            .eq("user_id", connectorUserId)
            .maybeSingle();
          if (trust && (trust.sybil_risk === "critical" || trust.fraud_risk === "critical")) {
            await supabase.from("connector_events").insert({
              newcomer_user_id: u.user_id,
              candidate_wallet: cand.fromWallet,
              tx_hash: cand.txHash,
              reason: "sybil_blocked",
              payload: { sybil_risk: trust.sybil_risk, fraud_risk: trust.fraud_risk },
            });
            continue;
          }
        }

        const since = new Date(Date.now() - 86_400_000).toISOString();
        const { count } = await supabase
          .from("connectors")
          .select("id", { count: "exact", head: true })
          .eq("connector_wallet", cand.fromWallet)
          .gte("created_at", since);
        if ((count ?? 0) >= params.maxPerWalletPerDay) {
          await supabase.from("connector_events").insert({
            newcomer_user_id: u.user_id,
            candidate_wallet: cand.fromWallet,
            tx_hash: cand.txHash,
            reason: "wallet_daily_cap",
            payload: { count },
          });
          continue;
        }

        chosen = cand;
        chosenMeta = meta;
        break;
      }

      if (!chosen || !chosenMeta) continue;

      const evidenceHash = await sha256Hex(
        `${chosen.txHash}|${CHAIN_ID}|${newcomerDid ?? u.user_id}|${chosen.fromWallet}`,
      );
      const tokenAmount = Number(chosen.rawValue) / Math.pow(10, chosen.decimals);

      const { data: senderWallet2 } = await supabase
        .from("user_wallet_addresses")
        .select("user_id")
        .ilike("wallet_address", chosen.fromWallet)
        .maybeSingle();
      const connectorUserId = senderWallet2?.user_id ?? null;

      const { data: claimRes, error: claimErr } = await supabase.rpc(
        "claim_connector_slot",
        {
          p_newcomer_user_id: u.user_id,
          p_newcomer_did: newcomerDid,
          p_connector_user_id: connectorUserId,
          p_connector_wallet: chosen.fromWallet,
          p_tx_hash: chosen.txHash,
          p_chain_id: CHAIN_ID,
          p_token_symbol: chosen.tokenSymbol,
          p_token_amount: tokenAmount,
          p_block_number: chosen.blockNumber,
          p_tx_index: chosen.txIndex,
          p_evidence_hash: evidenceHash,
        },
      );

      if (claimErr) {
        console.error(`claim error for ${u.user_id}:`, claimErr);
        await supabase.from("connector_events").insert({
          newcomer_user_id: u.user_id,
          candidate_wallet: chosen.fromWallet,
          tx_hash: chosen.txHash,
          reason: "claim_error",
          payload: { error: String(claimErr.message ?? claimErr) },
        });
        continue;
      }

      if (!claimRes) {
        await supabase.from("connector_events").insert({
          newcomer_user_id: u.user_id,
          candidate_wallet: chosen.fromWallet,
          tx_hash: chosen.txHash,
          reason: "slot_taken",
          payload: {},
        });
        continue;
      }

      claimed++;
      const connectorId = String(claimRes);

      await supabase.from("connector_events").insert({
        newcomer_user_id: u.user_id,
        candidate_wallet: chosen.fromWallet,
        tx_hash: chosen.txHash,
        reason: "eligible",
        payload: {
          token: chosen.tokenSymbol,
          value: chosen.rawValue.toString(),
          block: chosen.blockNumber,
          tx_index: chosen.txIndex,
          connector_user_id: connectorUserId,
          connector_id: connectorId,
        },
      });

      // Reward log + PPLP action (Network pillar) — only for internal Connector
      if (connectorUserId) {
        let pplpActionId: string | null = null;
        try {
          const { data: act } = await supabase
            .from("pplp_actions")
            .insert({
              actor_id: connectorUserId,
              action_type: "connector_first_giver",
              platform_id: "angel_ai",
              evidence_hash: evidenceHash,
              metadata: {
                newcomer_user_id: u.user_id,
                tx_hash: chosen.txHash,
                token: chosen.tokenSymbol,
                amount: tokenAmount,
                pillar: "network",
                score_added: params.rewardPLS,
              },
              status: "pending",
            })
            .select("id")
            .maybeSingle();
          pplpActionId = act?.id ?? null;
        } catch (e) {
          console.warn("pplp_actions insert skipped:", String(e));
        }

        // Enqueue SBT LIGHT_CONNECTOR — requires Connector to have a DID + wallet
        let sbtQueued = false;
        try {
          const { data: connectorDid } = await supabase
            .from("user_dids")
            .select("id, did, wallet_address")
            .eq("user_id", connectorUserId)
            .maybeSingle();

          const connectorWallet = (connectorDid?.wallet_address as string | null)?.toLowerCase()
            || chosen.fromWallet.toLowerCase();

          if (connectorDid?.id) {
            // 1) Registry record (audit / browse)
            const { data: regRow } = await supabase
              .from("sbt_registry")
              .insert({
                token_id: `pending:${connectorId}`,
                did_id: connectorDid.id,
                user_id: connectorUserId,
                sbt_type: "light_connector",
                sbt_subtype: "first_on_chain_giver",
                issuer: "system",
                status: "pending_mint",
                evidence_hash: evidenceHash,
                trust_weight: params.rewardPLS,
                privacy_level: "public",
                metadata: {
                  newcomer_user_id: u.user_id,
                  tx_hash: chosen.txHash,
                  chain_id: CHAIN_ID,
                  badge_type_id: 7,
                  connector_id: connectorId,
                },
              })
              .select("id")
              .maybeSingle();

            // 2) On-chain mint queue (consumed by sbt-auto-mint)
            if (regRow?.id) {
              await supabase.from("sbt_onchain_queue").insert({
                sbt_id: regRow.id,
                did_id: connectorDid.id,
                user_id: connectorUserId,
                network: "bsc-testnet",
                wallet_address: connectorWallet,
                metadata_uri: `did://sbt/light_connector/${connectorId}`,
                status: "pending",
              });
              sbtQueued = true;
            }
          }
        } catch (e) {
          console.warn("sbt enqueue skipped:", String(e));
        }

        await supabase.from("connector_rewards_log").insert({
          connector_id: connectorId,
          connector_user_id: connectorUserId,
          newcomer_user_id: u.user_id,
          score_added: params.rewardPLS,
          pillar: "network",
          sbt_queued: sbtQueued,
          pplp_action_id: pplpActionId,
        });

      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed, claimed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("connector-indexer error:", error);
    const msg = error instanceof Error ? error.message : "internal";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
