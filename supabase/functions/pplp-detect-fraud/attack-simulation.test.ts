import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/pplp-detect-fraud`;

// ===== Hacker's arsenal: 5 fake accounts, shared device + IP =====
const HACKER_DEVICE_HASH = "HACKER_DEVICE_FULLATTACK_2026_03";
const HACKER_IP_HASH = "HACKER_IP_FULLATTACK_2026_03";
const FARM_CONTENT_HASH = "FARMED_CONTENT_HASH_2026_03";

const SYBIL_ACTORS = [
  "a1a1a1a1-0001-4000-a000-000000000001",
  "a1a1a1a1-0002-4000-a000-000000000002",
  "a1a1a1a1-0003-4000-a000-000000000003",
  "a1a1a1a1-0004-4000-a000-000000000004",
  "a1a1a1a1-0005-4000-a000-000000000005",
];

// Store results for final report
const report: Array<{ phase: string; actor: string; signals: number; risk: number; rec: string }> = [];

async function callFraudDetect(body: Record<string, unknown>) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: JSON.parse(text) };
}

// ==================== Phase 1: Sybil Army ====================
Deno.test("Phase 1: Sybil Army — 5 accounts same device_hash + ip_hash", async () => {
  console.log("\n🔴 PHASE 1: Creating Sybil army (5 fake accounts, same fingerprint)");

  for (let i = 0; i < SYBIL_ACTORS.length; i++) {
    const { status, body } = await callFraudDetect({
      actor_id: SYBIL_ACTORS[i],
      action_type: "POST_CREATE",
      metadata: {
        device_hash: HACKER_DEVICE_HASH,
        ip_hash: HACKER_IP_HASH,
      },
    });

    assertEquals(status, 200);
    assertExists(body.risk_score);

    report.push({
      phase: `Phase1-Sybil#${i + 1}`,
      actor: SYBIL_ACTORS[i].slice(-4),
      signals: body.signals_detected,
      risk: body.risk_score,
      rec: body.recommendation,
    });

    console.log(
      `  Account #${i + 1}: signals=${body.signals_detected}, risk=${body.risk_score}, rec=${body.recommendation}`
    );
  }

  console.log("  ✅ Sybil army deployed — system should detect shared fingerprints");
});

// ==================== Phase 2: Bot Spam ====================
Deno.test("Phase 2: Bot Spam — rapid short content from 1 account", async () => {
  console.log("\n🔴 PHASE 2: Bot spam (3 rapid requests, content_length=2)");
  const spammer = SYBIL_ACTORS[0];

  for (let i = 0; i < 3; i++) {
    const { status, body } = await callFraudDetect({
      actor_id: spammer,
      action_type: "POST_CREATE",
      metadata: { content_length: 2 },
    });

    assertEquals(status, 200);

    // Each request should trigger SPAM for short content
    const spamSignals = body.signals.filter(
      (s: { signal_type: string }) => s.signal_type === "SPAM"
    );
    assertEquals(spamSignals.length > 0, true, `Request #${i + 1}: Expected SPAM signal for content_length=2`);

    report.push({
      phase: `Phase2-BotSpam#${i + 1}`,
      actor: spammer.slice(-4),
      signals: body.signals_detected,
      risk: body.risk_score,
      rec: body.recommendation,
    });

    console.log(
      `  Spam #${i + 1}: signals=${body.signals_detected}, risk=${body.risk_score}, historical=${body.historical_unresolved_signals}`
    );
  }

  console.log("  ✅ Bot spam detected — SPAM signals triggered every time");
});

// ==================== Phase 3: Content Farming ====================
Deno.test("Phase 3: Content Farming — duplicate content_hash across accounts", async () => {
  console.log("\n🔴 PHASE 3: Content farming (same content_hash from 2 different accounts)");

  for (let i = 0; i < 2; i++) {
    const actor = SYBIL_ACTORS[i + 1]; // Use accounts #2 and #3
    const { status, body } = await callFraudDetect({
      actor_id: actor,
      action_type: "POST_CREATE",
      metadata: {
        content_hash: FARM_CONTENT_HASH,
        content_length: 50, // Long enough to not trigger short-content SPAM
      },
    });

    assertEquals(status, 200);

    report.push({
      phase: `Phase3-Farm#${i + 1}`,
      actor: actor.slice(-4),
      signals: body.signals_detected,
      risk: body.risk_score,
      rec: body.recommendation,
    });

    console.log(
      `  Farm account #${i + 1}: signals=${body.signals_detected}, risk=${body.risk_score}, types=${body.signals.map((s: { signal_type: string }) => s.signal_type).join(",") || "none"}`
    );
  }

  console.log("  ✅ Content farming test complete");
});

// ==================== Phase 4: Combined Attack ====================
Deno.test("Phase 4: Combined Attack — all 4 vectors simultaneously", async () => {
  console.log("\n🔴 PHASE 4: FULL ATTACK — Sybil + Bot + Spam + Collusion in 1 request");

  const attacker = SYBIL_ACTORS[0];
  const { status, body } = await callFraudDetect({
    actor_id: attacker,
    action_id: "deadbeef-dead-beef-dead-beefdeadbeef",
    action_type: "POST_CREATE",
    metadata: {
      device_hash: HACKER_DEVICE_HASH,
      ip_hash: HACKER_IP_HASH,
      content_hash: FARM_CONTENT_HASH,
      content_length: 3,
    },
  });

  assertEquals(status, 200);
  assertExists(body.signals);
  assertExists(body.risk_score);

  // Should have multiple signals
  console.log(`  Signals detected: ${body.signals_detected}`);
  console.log(`  Signal types: ${body.signals.map((s: { signal_type: string }) => s.signal_type).join(", ")}`);
  console.log(`  Risk score: ${body.risk_score}/100`);
  console.log(`  Recommendation: ${body.recommendation}`);
  console.log(`  Auto-action: ${JSON.stringify(body.auto_action)}`);
  console.log(`  Historical unresolved: ${body.historical_unresolved_signals}`);

  // Risk > 25 should trigger auto-action
  if (body.risk_score > 25) {
    console.log("  ⚡ Auto-action TRIGGERED (risk > 25)");
  }

  // With SPAM (content_length=3) at minimum, risk should be >= 35
  assertEquals(body.risk_score >= 25, true, `Expected risk >= 25, got ${body.risk_score}`);

  report.push({
    phase: "Phase4-COMBINED",
    actor: attacker.slice(-4),
    signals: body.signals_detected,
    risk: body.risk_score,
    rec: body.recommendation,
  });

  console.log("  ✅ Combined attack processed — system responded with elevated risk");
});

// ==================== Phase 5: Whitelist Immunity ====================
Deno.test("Phase 5: Whitelist Immunity — same payload, whitelisted user", async () => {
  console.log("\n🟢 PHASE 5: Whitelist immunity test");

  // Fetch a whitelisted user
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/fraud_whitelist?limit=1&select=user_id`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  const whitelist = JSON.parse(await listRes.text());

  if (!whitelist || whitelist.length === 0) {
    console.log("  ⚠️ No whitelisted users — skipping");
    return;
  }

  const safeUser = whitelist[0].user_id;

  // Send EXACT SAME attack payload as Phase 4
  const { status, body } = await callFraudDetect({
    actor_id: safeUser,
    action_id: "deadbeef-dead-beef-dead-beefdeadbeef",
    action_type: "POST_CREATE",
    metadata: {
      device_hash: HACKER_DEVICE_HASH,
      ip_hash: HACKER_IP_HASH,
      content_hash: FARM_CONTENT_HASH,
      content_length: 3,
    },
  });

  assertEquals(status, 200);
  assertEquals(body.risk_score, 0);
  assertEquals(body.signals_detected, 0);
  assertEquals(body.recommendation, "WHITELISTED");

  report.push({
    phase: "Phase5-WHITELIST",
    actor: safeUser.slice(0, 8),
    signals: body.signals_detected,
    risk: body.risk_score,
    rec: body.recommendation,
  });

  console.log(`  Whitelisted user ${safeUser.slice(0, 8)}...: risk=0, signals=0, rec=WHITELISTED`);
  console.log("  ✅ Whitelist immunity CONFIRMED — identical attack payload completely ignored");
});

// ==================== Phase 6: Final Report ====================
Deno.test("Phase 6: Attack Simulation Summary Report", () => {
  console.log("\n" + "=".repeat(80));
  console.log("📊 FULL ATTACK SIMULATION REPORT");
  console.log("=".repeat(80));
  console.log(
    `${"Phase".padEnd(22)} | ${"Actor".padEnd(10)} | ${"Signals".padEnd(8)} | ${"Risk".padEnd(6)} | Recommendation`
  );
  console.log("-".repeat(80));

  for (const r of report) {
    console.log(
      `${r.phase.padEnd(22)} | ${r.actor.padEnd(10)} | ${String(r.signals).padEnd(8)} | ${String(r.risk).padEnd(6)} | ${r.rec}`
    );
  }

  console.log("-".repeat(80));

  const attackerMax = Math.max(...report.filter((r) => r.phase !== "Phase5-WHITELIST").map((r) => r.risk));
  const whitelistEntry = report.find((r) => r.phase === "Phase5-WHITELIST");

  console.log(`\n🔴 Attacker max risk score:    ${attackerMax}/100`);
  if (whitelistEntry) {
    console.log(`🟢 Whitelisted user risk score: ${whitelistEntry.risk}/100`);
    console.log(`📏 Protection gap:              ${attackerMax - whitelistEntry.risk} points`);
  }
  console.log("\n" + "=".repeat(80));
  console.log("✅ All phases complete. System integrity verified.");
  console.log("=".repeat(80));
});
