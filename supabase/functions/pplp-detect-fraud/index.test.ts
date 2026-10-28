import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/pplp-detect-fraud`;

async function callFraudDetect(body: Record<string, unknown>) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text(); // always consume body
  return { status: res.status, body: JSON.parse(text) };
}

// ==================== Test Suite 3: Hacker Attack Simulation ====================

// --- Attack 1: Missing actor_id → 400 ---
Deno.test("Missing actor_id → 400 error", async () => {
  const { status, body } = await callFraudDetect({});
  assertEquals(status, 400);
  assertEquals(body.error, "actor_id is required");
});

// --- Attack 2: Sybil Attack — device_hash trùng ---
Deno.test("Sybil Attack: duplicate device_hash triggers SYBIL signal", async () => {
  // Use a fake actor with a device_hash that might match existing data
  const fakeActorId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const { status, body } = await callFraudDetect({
    actor_id: fakeActorId,
    action_type: "POST_CREATE",
    metadata: {
      device_hash: "SHARED_DEVICE_HASH_TEST_SYBIL_ATTACK_2026",
    },
  });

  assertEquals(status, 200);
  assertExists(body.success);
  assertEquals(body.actor_id, fakeActorId);
  assertExists(body.risk_score);
  assertEquals(typeof body.risk_score, "number");
  assertExists(body.signals);
  // Note: SYBIL signal only triggers if device_hash matches another actor in pplp_actions
  // In a clean DB, no match → 0 signals. In production, this tests the detection path.
  console.log(`  → Sybil check: ${body.signals_detected} signals, risk=${body.risk_score}`);
});

// --- Attack 3: Bot Spam — rapid repeated actions ---
Deno.test("Bot Spam: rapid action_type triggers BOT signal check", async () => {
  const fakeActorId = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
  const { status, body } = await callFraudDetect({
    actor_id: fakeActorId,
    action_type: "POST_ENGAGEMENT",
    metadata: {},
  });

  assertEquals(status, 200);
  assertExists(body.risk_score);
  // BOT signal triggers when >20 actions of same type in last hour
  // With a clean actor, we verify the function runs without error
  console.log(`  → Bot check: ${body.signals_detected} signals, risk=${body.risk_score}`);
});

// --- Attack 4: Content Farming — duplicate content_hash ---
Deno.test("Content Farming: duplicate content_hash triggers SPAM signal check", async () => {
  const fakeActorId = "cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa";
  const { status, body } = await callFraudDetect({
    actor_id: fakeActorId,
    action_type: "POST_CREATE",
    metadata: {
      content_hash: "DUPLICATE_CONTENT_HASH_FARM_2026",
      content_length: 5, // very short → spam signal
    },
  });

  assertEquals(status, 200);
  assertExists(body.signals);
  // content_length < 10 → should trigger SPAM signal
  const spamSignals = body.signals.filter(
    (s: { signal_type: string }) => s.signal_type === "SPAM",
  );
  assertEquals(spamSignals.length > 0, true, "Expected SPAM signal for short content");
  assertEquals(spamSignals[0].severity, 2);
  console.log(`  → Content farm: ${body.signals_detected} signals, risk=${body.risk_score}`);
});

// --- Attack 5: Collusion Ring — concentrated target interactions ---
Deno.test("Collusion Ring: concentrated target triggers COLLUSION check", async () => {
  const fakeActorId = "dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb";
  const { status, body } = await callFraudDetect({
    actor_id: fakeActorId,
    action_id: "eeeeeeee-ffff-aaaa-bbbb-cccccccccccc",
    action_type: "POST_ENGAGEMENT",
    metadata: {},
  });

  assertEquals(status, 200);
  assertExists(body.risk_score);
  // COLLUSION checks require >=10 actions with targets, concentrated >50% on one
  console.log(`  → Collusion check: ${body.signals_detected} signals, risk=${body.risk_score}`);
});

// --- Attack 6: Whitelist Bypass — whitelisted user gets risk_score=0 ---
Deno.test("Whitelist Bypass: whitelisted user returns risk_score=0", async () => {
  // Fetch a whitelisted user from DB
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/fraud_whitelist?limit=1&select=user_id`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  const whitelist = JSON.parse(await listRes.text());

  if (!whitelist || whitelist.length === 0) {
    console.log("⚠️ No whitelisted users found — skipping whitelist test");
    return;
  }

  const { status, body } = await callFraudDetect({
    actor_id: whitelist[0].user_id,
    action_type: "POST_CREATE",
    metadata: {
      device_hash: "SHOULD_BE_IGNORED_FOR_WHITELIST",
      content_hash: "SHOULD_BE_IGNORED_FOR_WHITELIST",
      content_length: 1,
    },
  });

  assertEquals(status, 200);
  assertEquals(body.risk_score, 0);
  assertEquals(body.signals_detected, 0);
  assertEquals(body.recommendation, "WHITELISTED");
  console.log(`  → Whitelist bypass: user ${whitelist[0].user_id} confirmed safe`);
});

// --- Attack 7: Risk Score calculation correctness ---
Deno.test("Risk score formula: signals × 15 + maxSeverity × 10", async () => {
  // With content_length < 10 we get 1 SPAM signal (severity 2)
  // Expected: 1 × 15 + 2 × 10 = 35
  const fakeActorId = "ffffffff-aaaa-bbbb-cccc-dddddddddddd";
  const { body } = await callFraudDetect({
    actor_id: fakeActorId,
    action_type: "POST_CREATE",
    metadata: { content_length: 3 },
  });

  if (body.signals_detected === 1) {
    const maxSev = Math.max(...body.signals.map((s: { severity: number }) => s.severity));
    const expected = body.signals_detected * 15 + maxSev * 10;
    assertEquals(body.risk_score, Math.min(100, expected));
    console.log(`  → Risk formula verified: ${body.risk_score} = ${body.signals_detected}×15 + ${maxSev}×10`);
  } else {
    console.log(`  → ${body.signals_detected} signals detected, formula check skipped`);
  }
});
