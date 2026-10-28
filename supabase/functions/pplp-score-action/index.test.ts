import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/pplp-score-action`;

async function callScoreAction(body: Record<string, unknown>, expectedStatus?: number) {
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
  if (expectedStatus) assertEquals(res.status, expectedStatus);
  return { status: res.status, body: JSON.parse(text) };
}

// ==================== Test Suite 2: pplp-score-action Integration Tests ====================

Deno.test("Missing action_id → 400", async () => {
  const { status, body } = await callScoreAction({});
  assertEquals(status, 400);
  assertEquals(body.error, "action_id is required");
});

Deno.test("Non-existent action_id → 404", async () => {
  const { status, body } = await callScoreAction({
    action_id: "00000000-0000-0000-0000-000000000000",
  });
  assertEquals(status, 404);
  assertEquals(body.error, "Action not found");
});

Deno.test("Already scored action → 200 with idempotent response", async () => {
  // Use a real scored action from DB — fetch one first
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pplp_actions?status=neq.pending&limit=1&select=id`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  const actions = JSON.parse(await listRes.text());

  if (!actions || actions.length === 0) {
    console.log("⚠️ No scored actions found — skipping idempotent test");
    return;
  }

  const { status, body } = await callScoreAction({ action_id: actions[0].id });
  assertEquals(status, 200);
  assertEquals(body.success, true);
  assertEquals(body.message, "Action already scored");
  assertExists(body.action_id);
});

Deno.test("Valid pending action → response schema validation", async () => {
  // Fetch a pending action
  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pplp_actions?status=eq.pending&limit=1&select=id`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
  );
  const actions = JSON.parse(await listRes.text());

  if (!actions || actions.length === 0) {
    console.log("⚠️ No pending actions found — skipping schema test");
    return;
  }

  const { status, body } = await callScoreAction({ action_id: actions[0].id });
  assertEquals(status, 200);
  assertExists(body.success);
  
  if (body.pillars) {
    // Verify pillar scores exist and are numbers
    for (const pillar of ["S", "T", "H", "C", "U"]) {
      assertExists(body.pillars[pillar], `Missing pillar ${pillar}`);
      assertEquals(typeof body.pillars[pillar], "number");
    }
    // Verify multipliers
    assertExists(body.multipliers);
    assertEquals(typeof body.multipliers.Q, "number");
    assertEquals(typeof body.multipliers.I, "number");
    assertEquals(typeof body.multipliers.K, "number");
    // Verify decision
    assertExists(body.decision);
  }
});
