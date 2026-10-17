/**
 * Brace-balanced JSON tool-call parser for Coordinator Gate.
 *
 * Why brace-balanced?
 *   Model may emit `code_content` containing JSX/TS like `{count}` or `{ x: 1 }`,
 *   which breaks naive `slice(firstBrace, lastBrace)` parsers. We MUST walk the
 *   string and count braces, ignoring braces inside strings and respecting
 *   escape characters.
 */

export type ValidTool =
  | "read_file"
  | "search_repo"
  | "search_symbol"
  | "search_route"
  | "search_i18n_key"
  | "evolve_workspace"
  | "propose_edit";
const VALID_TOOLS = new Set<ValidTool>([
  "read_file",
  "search_repo",
  "search_symbol",
  "search_route",
  "search_i18n_key",
  "evolve_workspace",
  "propose_edit",
]);

export interface ParsedToolCall {
  tool: ValidTool;
  args: Record<string, unknown>;
  /** The exact substring (incl. fences if present) that matched. Used to strip from rationale. */
  raw: string;
}

/** Walk from `start` (must point to `{`) and return the index AFTER the matching `}`. */
function findBalancedEnd(text: string, start: number): number {
  if (text[start] !== "{") return -1;
  let depth = 0;
  let inStr = false;
  let strCh = "";
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inStr) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === strCh) {
        inStr = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      strCh = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function validate(obj: unknown): { tool: ValidTool; args: Record<string, unknown> } | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const tool = o.tool;
  const args = o.args;
  if (typeof tool !== "string") return null;
  if (!VALID_TOOLS.has(tool as ValidTool)) return null;
  if (!args || typeof args !== "object" || Array.isArray(args)) return null;
  return { tool: tool as ValidTool, args: args as Record<string, unknown> };
}

/**
 * Try to extract a tool call. Strategy:
 *  1. Look for ```json ... ``` fenced block, brace-balanced parse inside.
 *  2. Otherwise scan whole text for the first `{` whose balanced object parses
 *     to a valid tool call.
 */
export function tryExtractToolCall(text: string): ParsedToolCall | null {
  if (!text) return null;

  // 1) Fenced ```json ... ```
  const fenceRe = /```json\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    const inner = m[1];
    const start = inner.indexOf("{");
    if (start === -1) continue;
    const end = findBalancedEnd(inner, start);
    if (end === -1) continue;
    try {
      const obj = JSON.parse(inner.slice(start, end).trim());
      const v = validate(obj);
      if (v) return { ...v, raw: m[0] };
    } catch {
      /* keep scanning */
    }
  }

  // 2) Raw JSON anywhere in the text — scan every `{`
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    const end = findBalancedEnd(text, i);
    if (end === -1) continue;
    const candidate = text.slice(i, end);
    // Cheap pre-check to avoid parsing every random `{}` in prose.
    if (!candidate.includes('"tool"')) continue;
    try {
      const obj = JSON.parse(candidate);
      const v = validate(obj);
      if (v) return { ...v, raw: candidate };
    } catch {
      /* keep scanning further `{` */
    }
  }

  return null;
}

/**
 * Strip every fenced ```json block AND every brace-balanced JSON object that
 * contains a `"tool"` key — used both when persisting assistant rationale and
 * when rendering messages in the UI.
 */
export function stripToolCalls(text: string): string {
  if (!text) return "";
  let out = text.replace(/```json\s*[\s\S]*?```/gi, "");

  // Remove raw brace-balanced objects containing a "tool" key.
  // Iterate until stable to catch multiple occurrences.
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (let i = 0; i < out.length; i++) {
      if (out[i] !== "{") continue;
      const end = findBalancedEnd(out, i);
      if (end === -1) continue;
      const candidate = out.slice(i, end);
      if (!candidate.includes('"tool"')) continue;
      try {
        const obj = JSON.parse(candidate);
        if (
          obj && typeof obj === "object" &&
          typeof (obj as any).tool === "string" &&
          VALID_TOOLS.has((obj as any).tool)
        ) {
          out = out.slice(0, i) + out.slice(end);
          changed = true;
          break;
        }
      } catch {
        /* not parseable here */
      }
    }
    if (!changed) break;
  }
  return out.trim();
}
