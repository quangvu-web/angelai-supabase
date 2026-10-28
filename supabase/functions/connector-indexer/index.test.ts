// Connector Indexer — Invariant test (Phase B)
// Verifies the contract: every successful Connector claim MUST result in a
// `sbt_onchain_queue` row (via sbt_registry.evidence_hash).
//
// This is a black-box integration test. It does not mock anything; it runs
// against the deployed function + production DB and checks the invariant on
// real data.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/connector-indexer`;
const REST = `${SUPABASE_URL}/rest/v1`;

const headers = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path: string) {
  const res = await fetch(`${REST}${path}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`REST ${path} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ============================================================
// Test 1 — Indexer is reachable & responds with ok=true shape
// ============================================================
Deno.test("connector-indexer: invocation returns ok shape", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const text = await res.text();
  assertEquals(res.status, 200, `Expected 200, got ${res.status}: ${text}`);
  const body = JSON.parse(text);
  assertEquals(body.ok, true);
  assert(typeof body.processed === "number", "missing processed counter");
  // `claimed` is only present when there were users in the 48h window to process
  if (body.processed > 0) {
    assert(typeof body.claimed === "number", "missing claimed counter when processed > 0");
  }
});

// ============================================================
// Test 2 — INVARIANT: every confirmed Connector with a Connector
// user_id and an existing DID must have a sbt_onchain_queue row.
// ============================================================
Deno.test("connector-indexer invariant: every confirmed connector has sbt_onchain_queue row", async () => {
  // Pull confirmed connectors from the last 30 days (limit 100)
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  const connectors = await rest(
    `/connectors?select=id,connector_user_id,evidence_hash,confirmed_at&status=eq.confirmed&confirmed_at=gte.${cutoff}&order=confirmed_at.desc&limit=100`,
  );

  if (connectors.length === 0) {
    console.log("⚠️ No confirmed connectors in last 30d — skipping invariant check");
    return;
  }

  let checked = 0;
  let missingQueue = 0;
  const failures: string[] = [];

  for (const c of connectors) {
    if (!c.connector_user_id || !c.evidence_hash) continue;

    // Connector must have a DID for SBT enqueue to be required
    const dids = await rest(
      `/user_dids?select=id&user_id=eq.${c.connector_user_id}&limit=1`,
    );
    if (dids.length === 0) continue; // not eligible for SBT enqueue

    checked++;

    // Look up registry row by evidence_hash + light_connector
    const reg = await rest(
      `/sbt_registry?select=id&sbt_type=eq.light_connector&evidence_hash=eq.${c.evidence_hash}&limit=1`,
    );
    if (reg.length === 0) {
      missingQueue++;
      failures.push(`connector=${c.id}: missing sbt_registry`);
      continue;
    }

    // Then queue row must exist (any status — pending/processing/minted/cancelled)
    const queue = await rest(
      `/sbt_onchain_queue?select=id,status&sbt_id=eq.${reg[0].id}&limit=1`,
    );
    if (queue.length === 0) {
      missingQueue++;
      failures.push(`connector=${c.id} sbt_id=${reg[0].id}: missing sbt_onchain_queue`);
    }
  }

  console.log(`Invariant check: ${checked} eligible connectors checked, ${missingQueue} missing queue rows`);
  if (failures.length) console.log("Failures:\n" + failures.join("\n"));

  assertEquals(missingQueue, 0, `${missingQueue}/${checked} eligible connectors are missing their sbt_onchain_queue row`);
});

// ============================================================
// Test 3 — Schema sanity: queue row points back to a valid registry
// (Sample-based — light join via sbt_registry)
// ============================================================
Deno.test("sbt_onchain_queue: light_connector rows have valid metadata_uri", async () => {
  // Find recent registry rows of type light_connector
  const regs = await rest(
    `/sbt_registry?select=id&sbt_type=eq.light_connector&order=created_at.desc&limit=20`,
  );
  if (regs.length === 0) {
    console.log("⚠️ No light_connector SBT records yet — skipping URI check");
    return;
  }

  for (const r of regs) {
    const queue = await rest(
      `/sbt_onchain_queue?select=metadata_uri,wallet_address,network&sbt_id=eq.${r.id}&limit=1`,
    );
    if (queue.length === 0) continue; // covered by test 2
    const q = queue[0];
    assertEquals(q.network, "bsc-testnet");
    assert(
      typeof q.wallet_address === "string" && q.wallet_address.startsWith("0x") && q.wallet_address.length === 42,
      `invalid wallet_address: ${q.wallet_address}`,
    );
    assert(
      typeof q.metadata_uri === "string" && q.metadata_uri.includes("light_connector"),
      `metadata_uri must reference light_connector, got: ${q.metadata_uri}`,
    );
  }
});

// ============================================================
// Test 4 — Full sanity sweep: EVERY queue row whose sbt_id maps to a
// light_connector registry MUST satisfy:
//   - network = 'bsc-testnet'
//   - wallet_address is a valid 0x... 42-char hex
//   - metadata_uri is a string containing 'light_connector'
// Walks the entire table in pages (no limit cap on coverage).
// ============================================================
Deno.test("sbt_onchain_queue sanity (FULL): all light_connector rows valid", async () => {
  // 1) Pull every light_connector registry id (paged)
  const PAGE = 1000;
  const lcIds: string[] = [];
  let offset = 0;
  while (true) {
    const batch = await rest(
      `/sbt_registry?select=id&sbt_type=eq.light_connector&order=created_at.asc&offset=${offset}&limit=${PAGE}`,
    );
    if (batch.length === 0) break;
    for (const r of batch) lcIds.push(r.id);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  if (lcIds.length === 0) {
    console.log("⚠️ No light_connector SBT records — sanity sweep skipped");
    return;
  }

  // 2) Fetch all queue rows referencing those sbt_ids (chunked IN clause)
  const CHUNK = 50;
  type QueueRow = {
    id: string; sbt_id: string; network: string;
    wallet_address: string; metadata_uri: string | null; status: string;
  };
  const rows: QueueRow[] = [];
  for (let i = 0; i < lcIds.length; i += CHUNK) {
    const chunk = lcIds.slice(i, i + CHUNK);
    const inList = chunk.join(",");
    const part = await rest(
      `/sbt_onchain_queue?select=id,sbt_id,network,wallet_address,metadata_uri,status&sbt_id=in.(${inList})`,
    );
    rows.push(...part);
  }

  console.log(`Sanity sweep: ${lcIds.length} light_connector registry rows → ${rows.length} queue rows`);

  const violations: string[] = [];
  for (const r of rows) {
    if (r.network !== "bsc-testnet") {
      violations.push(`queue=${r.id}: network='${r.network}' (expected 'bsc-testnet')`);
    }
    const w = r.wallet_address;
    if (typeof w !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(w)) {
      violations.push(`queue=${r.id}: invalid wallet_address='${w}'`);
    }
    if (typeof r.metadata_uri !== "string" || !r.metadata_uri.includes("light_connector")) {
      violations.push(`queue=${r.id}: metadata_uri='${r.metadata_uri}' missing 'light_connector'`);
    }
  }

  if (violations.length) {
    console.log("VIOLATIONS:\n" + violations.join("\n"));
  }
  assertEquals(violations.length, 0, `${violations.length}/${rows.length} light_connector queue rows violate sanity rules`);
});

// ============================================================
// Test 5 — Evidence hash linkage
// Every light_connector queue row MUST resolve to a sbt_registry row that
// has a non-empty evidence_hash. Additionally, when registry.metadata
// carries `connector_id`, the queue.metadata_uri MUST embed that same id —
// guaranteeing the URI does not point to the wrong connector record.
// ============================================================
Deno.test("sbt_onchain_queue: light_connector rows have valid evidence_hash linkage", async () => {
  // 1) Pull recent light_connector registry rows with their evidence_hash + metadata
  const regs = await rest(
    `/sbt_registry?select=id,evidence_hash,metadata&sbt_type=eq.light_connector&order=created_at.desc&limit=200`,
  );
  if (regs.length === 0) {
    console.log("⚠️ No light_connector SBT records — evidence_hash linkage check skipped");
    return;
  }

  // Index by registry id for cross-check
  const regById = new Map<string, { evidence_hash: string | null; metadata: any }>();
  for (const r of regs) regById.set(r.id, { evidence_hash: r.evidence_hash, metadata: r.metadata });

  // 2) Fetch queue rows for those registry ids (chunked)
  const ids = Array.from(regById.keys());
  const CHUNK = 50;
  type QRow = { id: string; sbt_id: string; metadata_uri: string | null };
  const queueRows: QRow[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const inList = ids.slice(i, i + CHUNK).join(",");
    const part = await rest(
      `/sbt_onchain_queue?select=id,sbt_id,metadata_uri&sbt_id=in.(${inList})`,
    );
    queueRows.push(...part);
  }

  console.log(
    `Evidence linkage: ${regs.length} registry rows → ${queueRows.length} queue rows checked`,
  );

  const violations: string[] = [];
  // hex pattern: optional 0x + at least 32 hex chars (sha256 / keccak256 / md5+)
  const HEX_HASH = /^(0x)?[a-fA-F0-9]{32,}$/;

  for (const q of queueRows) {
    const reg = regById.get(q.sbt_id);
    if (!reg) {
      violations.push(`queue=${q.id}: sbt_id=${q.sbt_id} does not resolve to a light_connector registry row`);
      continue;
    }

    // (a) evidence_hash must be present + look like a hash
    const ev = reg.evidence_hash;
    if (!ev || typeof ev !== "string" || !HEX_HASH.test(ev)) {
      violations.push(`queue=${q.id}: linked registry has invalid evidence_hash='${ev}'`);
    }

    // (b) connector_id consistency: registry.metadata.connector_id must
    //     appear inside queue.metadata_uri (e.g. did://sbt/light_connector/<id>)
    const connectorIdInRegistry: string | undefined = reg.metadata?.connector_id;
    if (connectorIdInRegistry) {
      if (typeof q.metadata_uri !== "string" || !q.metadata_uri.includes(connectorIdInRegistry)) {
        violations.push(
          `queue=${q.id}: metadata_uri='${q.metadata_uri}' does not embed connector_id='${connectorIdInRegistry}' from registry`,
        );
      }
    }
  }

  if (violations.length) {
    console.log("EVIDENCE LINKAGE VIOLATIONS:\n" + violations.join("\n"));
  }
  assertEquals(
    violations.length,
    0,
    `${violations.length}/${queueRows.length} queue rows fail evidence_hash linkage check`,
  );
});
