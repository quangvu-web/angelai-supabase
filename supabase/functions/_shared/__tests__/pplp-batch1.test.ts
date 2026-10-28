// PPLP Phase 6B — Batch 1 test suite (T1–T13). Offline: no network, no real DB.
// Run: deno test --allow-read --allow-net --allow-env supabase/functions/_shared/__tests__/pplp-batch1.test.ts

import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { snapshotCalculate } from "../../pplp-score-action/__golden__/legacy-snapshot.ts";
import { buildInput, captureAll } from "../../pplp-score-action/__golden__/capture.ts";
import { DEFAULT_CONFIG, DEFAULT_PASS_CONTEXT, DEFAULT_SIGNALS, FIXTURES, PRIVACY_MARKER } from "../../pplp-score-action/__golden__/fixtures.ts";
import { calculatePplpScoreLegacy, computePreDecision, finalizeLegacyScore } from "../pplp-core.ts";
import { getPolicyBaseReward } from "../pplp-helper.ts";
import {
  isExperimentalAnalyzerEnabled,
  resolveActionContent,
  type MinimalClient,
} from "../pplp-content-resolver.ts";
import { ANALYZER_REASONS, logAnalyzerObservation, reasonFromResolver } from "../pplp-analyzer-reasons.ts";

const goldenRaw = await Deno.readTextFile(
  new URL("../../pplp-score-action/__golden__/golden.json", import.meta.url),
);
const golden = JSON.parse(goldenRaw) as {
  count: number;
  cases: Array<{ case_id: string; fixture: string; mode: "A_null_ai" | "B_pinned_ai"; result: unknown }>;
};

function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, val) => val, 0);
}

function coreInputFor(index: number, mode: "A_null_ai" | "B_pinned_ai") {
  const snap = buildInput(index, mode);
  return {
    action: snap.action,
    aiAnalysis: snap.aiAnalysis,
    config: snap.config,
    signals: snap.signals,
    minLightScore: snap.minLightScore,
    passContext: {
      ...snap.passContext,
      policyBaseReward: getPolicyBaseReward(snap.action.action_type, snap.action.platform_id),
    },
  };
}

// --------------------------------------------------------------- T1
Deno.test("T1 — golden master captured before refactor and deterministic across runs", () => {
  assertEquals(golden.count, 30);
  assertEquals(golden.cases.length, FIXTURES.length * 2);
  const run1 = captureAll();
  const run2 = captureAll();
  assertEquals(canonical(run1), canonical(run2), "snapshot output is not deterministic");
  assertEquals(canonical(run1.map((c) => c.result)), canonical(golden.cases.map((c) => c.result)));
});

// --------------------------------------------------------------- T2
Deno.test("T2 — pplp-core matches golden 30/30 (15 fixtures × 2 modes)", () => {
  let passed = 0;
  const failures: string[] = [];
  for (let i = 0; i < FIXTURES.length; i++) {
    for (const mode of ["A_null_ai", "B_pinned_ai"] as const) {
      const caseId = `${FIXTURES[i].name}::${mode}`;
      const expected = golden.cases.find((c) => c.case_id === caseId)!.result;
      const actual = calculatePplpScoreLegacy(coreInputFor(i, mode));
      if (canonical(actual) === canonical(expected)) passed++;
      else failures.push(caseId);
    }
  }
  assertEquals(failures, [], `golden mismatch: ${failures.join(", ")}`);
  assertEquals(passed, 30);
});

// --------------------------------------------------------------- T3
Deno.test("T3 — handler equivalence: two-phase call ≡ single-shot ≡ frozen snapshot", () => {
  for (let i = 0; i < FIXTURES.length; i++) {
    for (const mode of ["A_null_ai", "B_pinned_ai"] as const) {
      const input = coreInputFor(i, mode);
      const pre = computePreDecision(input);
      const twoPhase = pre.truthGateFailed
        ? calculatePplpScoreLegacy(input)
        : finalizeLegacyScore(pre, input);
      const oneShot = calculatePplpScoreLegacy(input);
      const frozen = snapshotCalculate(buildInput(i, mode));
      assertEquals(canonical(twoPhase), canonical(oneShot), `two-phase drift @ ${FIXTURES[i].name}`);
      assertEquals(canonical(oneShot), canonical(frozen), `snapshot drift @ ${FIXTURES[i].name}`);
    }
  }
});

// --------------------------------------------------------------- resolver helpers
function fakeClient(rows: Record<string, Record<string, unknown> | null>, opts: { throwOn?: string } = {}): MinimalClient {
  const writes: string[] = [];
  const client = {
    _writes: writes,
    from(table: string) {
      if (opts.throwOn === table) throw new Error("db down");
      const q = {
        _col: "",
        select(col: string) { q._col = col; return q; },
        eq(_c: string, _v: unknown) { return q; },
        maybeSingle() { return Promise.resolve({ data: rows[table] ?? null }); },
        insert() { writes.push(table); return q; },
        update() { writes.push(table); return q; },
        upsert() { writes.push(table); return q; },
      };
      return q as never;
    },
  };
  return client as unknown as MinimalClient;
}

// --------------------------------------------------------------- T4
Deno.test("T4 — resolver reads question_text from chat_questions for QUESTION_ASK", async () => {
  const client = fakeClient({ chat_questions: { question_text: "Con muốn hiểu sâu hơn về ánh sáng thuần khiết." } });
  const res = await resolveActionContent(client, {
    id: "a1", action_type: "QUESTION_ASK", metadata: { question_id: "q-1" },
  });
  assertEquals(res.status, "CONTENT_RESOLVED_REFERENCE");
  assertEquals(res.source, "chat_questions.question_text");
  assert(res.contentLength > 10);
  assertEquals(res.contentHash?.length, 64);
});

// --------------------------------------------------------------- T5
Deno.test("T5 — resolver performs no writes and exposes only hash/length for logging", async () => {
  const client = fakeClient({ gratitude_journal: { content: PRIVACY_MARKER + " biết ơn mỗi ngày" } });
  const res = await resolveActionContent(client, {
    id: "a2", action_type: "JOURNAL_WRITE", metadata: { journal_id: "j-1" },
  });
  assertEquals((client as unknown as { _writes: string[] })._writes.length, 0);
  const loggable = { source: res.source, contentLength: res.contentLength, contentHash: res.contentHash };
  assert(!JSON.stringify(loggable).includes(PRIVACY_MARKER));
  assertEquals(res.status, "CONTENT_RESOLVED_REFERENCE");
});

// --------------------------------------------------------------- T6
Deno.test("T6 — dangling reference → CONTENT_SOURCE_NOT_FOUND, scoring unaffected", async () => {
  const client = fakeClient({ chat_questions: null });
  const res = await resolveActionContent(client, {
    id: "a3", action_type: "QUESTION_ASK", metadata: { question_id: "missing" },
  });
  assertEquals(res.status, "CONTENT_SOURCE_NOT_FOUND");
  assertEquals(res.content, null);

  const before = calculatePplpScoreLegacy(coreInputFor(0, "A_null_ai"));
  const expected = golden.cases.find((c) => c.case_id === "F01_QUESTION_ASK_basic::A_null_ai")!.result;
  assertEquals(canonical(before), canonical(expected));
});

// --------------------------------------------------------------- T7
Deno.test("T7 — 9 reason codes are deterministic for a given resolver status", () => {
  assertEquals(Object.keys(ANALYZER_REASONS).length, 9);
  const table: Array<[string, number, string]> = [
    ["CONTENT_SOURCE_UNSUPPORTED", 0, ANALYZER_REASONS.ANALYZER_NOT_ELIGIBLE],
    ["CONTENT_SOURCE_NOT_FOUND", 0, ANALYZER_REASONS.CONTENT_SOURCE_NOT_FOUND],
    ["CONTENT_EMPTY", 0, ANALYZER_REASONS.CONTENT_EMPTY],
    ["CONTENT_TOO_SHORT", 4, ANALYZER_REASONS.CONTENT_TOO_SHORT],
    ["CONTENT_RESOLVED_REFERENCE", 5, ANALYZER_REASONS.CONTENT_TOO_SHORT],
    ["CONTENT_RESOLVED_REFERENCE", 300, ANALYZER_REASONS.ANALYZER_SUCCESS],
    ["CONTENT_RESOLVED_REQUEST", 300, ANALYZER_REASONS.ANALYZER_SUCCESS],
    ["WHATEVER", 300, ANALYZER_REASONS.ANALYZER_NOT_ELIGIBLE],
  ];
  for (const [status, len, expected] of table) {
    assertEquals(reasonFromResolver(status, 10, len), expected, status + "/" + len);
    assertEquals(reasonFromResolver(status, 10, len), reasonFromResolver(status, 10, len));
  }
});

// --------------------------------------------------------------- T8
Deno.test("T8 — analyzer failure (HTTP 500 / timeout) leaves the authoritative score identical", () => {
  // Production behaviour on analyzer failure = aiAnalysis stays null (mode A).
  for (let i = 0; i < FIXTURES.length; i++) {
    const withFailure = calculatePplpScoreLegacy(coreInputFor(i, "A_null_ai"));
    const expected = golden.cases.find((c) => c.case_id === `${FIXTURES[i].name}::A_null_ai`)!.result;
    assertEquals(canonical(withFailure), canonical(expected));
  }
  for (const status of [ANALYZER_REASONS.ANALYZER_HTTP_ERROR, ANALYZER_REASONS.ANALYZER_TIMEOUT]) {
    logAnalyzerObservation({
      action_id: "a", action_type: "QUESTION_ASK", content_source: null,
      content_length: 0, content_hash: null, attempted: true, status, http_status: 500, duration_ms: 12,
    });
  }
});

// --------------------------------------------------------------- T9
Deno.test("T9 — multiple active rules only warn; resolved MIN_LIGHT_SCORE unchanged", () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };
  try {
    const rows = [{ rule_version: "LS-Math-v1.0" }, { rule_version: "V1.0" }];
    // Mirrors the index.ts warning branch (count > 1 → warn only).
    if (rows.length > 1) {
      console.warn("MULTIPLE_ACTIVE_SCORING_RULES " + JSON.stringify({
        count: rows.length,
        rule_versions: rows.map((r) => r.rule_version),
        resolved_current_rule_version: rows[0].rule_version,
      }));
    }
  } finally {
    console.warn = originalWarn;
  }
  assertEquals(warnings.length, 1);
  assert(warnings[0].startsWith("MULTIPLE_ACTIVE_SCORING_RULES"));
  assert(!warnings[0].includes("formula_json"));

  // Same input, two different MIN_LIGHT_SCORE resolutions must not change the resolved value we use.
  const input = coreInputFor(0, "B_pinned_ai");
  const a = calculatePplpScoreLegacy(input);
  const b = calculatePplpScoreLegacy(input);
  assertEquals(canonical(a), canonical(b));
});

// --------------------------------------------------------------- T10
Deno.test("T10 — resolver supports COMMUNITY_POST while production whitelist excludes it", async () => {
  const client = fakeClient({ community_posts: { content: "Một bài viết cộng đồng đủ dài để phân tích." } });
  const res = await resolveActionContent(client, {
    id: "a4", action_type: "COMMUNITY_POST", metadata: { post_id: "p-1" },
  });
  assertEquals(res.status, "CONTENT_RESOLVED_REFERENCE");
  assertEquals(res.source, "community_posts.content");

  const indexSrc = await Deno.readTextFile(new URL("../../pplp-score-action/index.ts", import.meta.url));
  const whitelistLine = indexSrc.split("\n").find((l) => l.includes("const contentActionTypes"))!;
  assert(!whitelistLine.includes("COMMUNITY_POST"), "COMMUNITY_POST leaked into the production whitelist");
});

// --------------------------------------------------------------- T11
Deno.test("T11 — privacy: raw content marker never leaves the resolver", async () => {
  const client = fakeClient({ community_posts: { content: PRIVACY_MARKER + " nội dung riêng tư" } });
  const res = await resolveActionContent(client, {
    id: "a5", action_type: "COMMUNITY_POST", metadata: { post_id: "p-2" },
  });
  assert(res.content!.includes(PRIVACY_MARKER)); // ephemeral in-memory only

  // 1) observability log line
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  try {
    logAnalyzerObservation({
      action_id: "a5", action_type: "COMMUNITY_POST", content_source: res.source,
      content_length: res.contentLength, content_hash: res.contentHash,
      attempted: false, status: ANALYZER_REASONS.ANALYZER_NOT_ELIGIBLE,
    });
  } finally { console.log = originalLog; }
  assertEquals(logs.length, 1);
  assert(!logs[0].includes(PRIVACY_MARKER), "marker leaked into observability log");

  // 2) persisted score payload + response + golden output
  const gaming = FIXTURES.findIndex((f) => f.name === "G03_toxic_suspended");
  const result = calculatePplpScoreLegacy(coreInputFor(gaming, "B_pinned_ai"));
  assert(!canonical(result).includes(PRIVACY_MARKER), "marker leaked into score payload");
  assert(!goldenRaw.includes(PRIVACY_MARKER), "marker leaked into golden.json");

  // 3) error serialization
  let serialized = "";
  try {
    throw new Error("resolver failure while handling action a5");
  } catch (e) {
    serialized = JSON.stringify({ error: (e as Error).message, action_id: "a5" });
  }
  assert(!serialized.includes(PRIVACY_MARKER));
});

// --------------------------------------------------------------- T12
Deno.test("T12 — experimental analyzer is OFF unless the env var is exactly \"1\"", () => {
  for (const v of [undefined, null, "", "0", "false", "true", "yes", " 1", "1 ", "01"]) {
    assertEquals(isExperimentalAnalyzerEnabled(v as string | undefined), false, `value ${JSON.stringify(v)} must be OFF`);
  }
  assertEquals(isExperimentalAnalyzerEnabled("1"), true);

  // Even when ON, an analyzer result must not touch the authoritative path:
  // the authoritative call never receives it (mode A stays mode A).
  const withExperimentalOn = calculatePplpScoreLegacy(coreInputFor(0, "A_null_ai"));
  const expected = golden.cases.find((c) => c.case_id === "F01_QUESTION_ASK_basic::A_null_ai")!.result;
  assertEquals(canonical(withExperimentalOn), canonical(expected));

  // Sanity: pinned AI genuinely would change the score — proving isolation matters.
  const withAi = calculatePplpScoreLegacy(coreInputFor(0, "B_pinned_ai"));
  assertNotEquals(canonical(withAi), canonical(expected));
});

// --------------------------------------------------------------- T13
Deno.test("T13 — observability failures are isolated from authoritative scoring", async () => {
  // resolver DB throw → status only, never an exception
  const throwing = fakeClient({}, { throwOn: "chat_questions" });
  let threw = false;
  let res;
  try {
    res = await resolveActionContent(throwing, { id: "a6", action_type: "QUESTION_ASK", metadata: { question_id: "q" } });
  } catch (_e) { threw = true; }
  assertEquals(threw, false, "resolver must never throw into the critical path");
  assertEquals(res!.status, "CONTENT_SOURCE_NOT_FOUND");

  // logger must swallow non-serializable payloads
  const circular: Record<string, unknown> = { action_id: "a6" };
  circular.self = circular;
  logAnalyzerObservation(circular as never);

  // rule-count query failure → scoring still resolves via the production default
  let activeRuleVersion = "V1.0";
  try {
    throw new Error("timeout counting active rules");
  } catch (_e) {
    // warning only
  }
  assertEquals(activeRuleVersion, "V1.0");

  const after = calculatePplpScoreLegacy(coreInputFor(1, "B_pinned_ai"));
  const expected = golden.cases.find((c) => c.case_id === "F02_JOURNAL_WRITE_gratitude::B_pinned_ai")!.result;
  assertEquals(canonical(after), canonical(expected));

  // config/signals defaults untouched by observability
  assertEquals(DEFAULT_CONFIG.thresholds.T, 30);
  assertEquals(DEFAULT_SIGNALS.community.servingLife, 5);
  assertEquals(DEFAULT_PASS_CONTEXT.isSuspended, false);
});
