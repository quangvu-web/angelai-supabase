// Golden master capture harness.
// Run:  deno run --allow-write supabase/functions/pplp-score-action/__golden__/capture.ts
// Produces golden.json from the FROZEN legacy-snapshot.ts.
// GOLDEN IMMUTABILITY: never re-run this to make a new implementation pass.

import { snapshotCalculate, type SnapshotInput } from "./legacy-snapshot.ts";
import { DEFAULT_CONFIG, DEFAULT_PASS_CONTEXT, DEFAULT_SIGNALS, FIXTURES } from "./fixtures.ts";

export interface GoldenCase {
  case_id: string;
  fixture: string;
  mode: "A_null_ai" | "B_pinned_ai";
  result: unknown;
}

export function buildInput(fixtureIndex: number, mode: "A_null_ai" | "B_pinned_ai"): SnapshotInput {
  const f = FIXTURES[fixtureIndex];
  return {
    action: f.action,
    aiAnalysis: mode === "A_null_ai" ? null : f.ai,
    config: f.config ?? DEFAULT_CONFIG,
    signals: f.signals ?? DEFAULT_SIGNALS,
    passContext: f.passContext ?? DEFAULT_PASS_CONTEXT,
    minLightScore: f.minLightScore ?? 0.1,
  };
}

export function captureAll(): GoldenCase[] {
  const cases: GoldenCase[] = [];
  for (let i = 0; i < FIXTURES.length; i++) {
    for (const mode of ["A_null_ai", "B_pinned_ai"] as const) {
      cases.push({
        case_id: `${FIXTURES[i].name}::${mode}`,
        fixture: FIXTURES[i].name,
        mode,
        result: snapshotCalculate(buildInput(i, mode)),
      });
    }
  }
  return cases;
}

if (import.meta.main) {
  const cases = captureAll();
  const json = JSON.stringify({ version: 1, captured_from: "legacy-snapshot.ts", count: cases.length, cases }, null, 2);
  await Deno.writeTextFile(new URL("./golden.json", import.meta.url), json + "\n");
  console.log(`Golden master captured: ${cases.length} cases`);
}
