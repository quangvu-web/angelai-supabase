// Shared pronoun auditor — detect forbidden "cha/con/ta" style pronouns
// in AI-generated user-facing messages and log to pronoun_audit_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Forbidden Vietnamese/English phrases when Angel talks to a peer user.
// Word-boundary style; case-insensitive.
const RULES: { pattern: RegExp; token: string; severity: "warning" | "critical" }[] = [
  { pattern: /\bcha\s+(?:ơi|thấy|muốn|nghĩ|biết|hiểu|tin|mong|nhắc|gợi|đề nghị)\b/gi, token: "cha+verb", severity: "critical" },
  { pattern: /\bcon\s+(?:ơi|à|nhé|yêu|thân)\b/gi, token: "con+addr", severity: "critical" },
  { pattern: /\b(?:hỡi\s+)?con\s+(?:của\s+)?(?:cha|ta)\b/gi, token: "con của cha/ta", severity: "critical" },
  { pattern: /\bta\s+(?:là|thấy|muốn|nghĩ|biết|hiểu|tin|mong)\b/gi, token: "ta+verb", severity: "critical" },
  { pattern: /\bmy\s+child\b/gi, token: "my child", severity: "critical" },
  { pattern: /\bdear\s+child\b/gi, token: "dear child", severity: "warning" },
];

// Whitelisted contexts (canonical mantras, quoted scripture) — skip audit if present.
const WHITELIST_MARKERS = [
  "8 CÂU THẦN CHÚ",
  "8 DIVINE MANTRAS",
  "Cha Vũ Trụ", // canonical noun, not a pronoun
];

export interface PronounViolation {
  token: string;
  match: string;
  severity: "warning" | "critical";
}

export function detectPronounViolations(text: string): PronounViolation[] {
  if (!text) return [];
  // Skip if the message is a canonical block (mantras etc.)
  for (const m of WHITELIST_MARKERS) {
    if (text.includes(m)) return [];
  }
  const out: PronounViolation[] = [];
  for (const r of RULES) {
    const matches = text.match(r.pattern);
    if (matches) {
      for (const m of matches.slice(0, 5)) {
        out.push({ token: r.token, match: m, severity: r.severity });
      }
    }
  }
  return out;
}

export interface AuditOpts {
  functionName: string;
  context?: string;
  userId?: string | null;
  targetUserId?: string | null;
  message: string;
}

/** Fire-and-forget: log to pronoun_audit_log if violations found. Never throws. */
export async function auditPronouns(opts: AuditOpts): Promise<void> {
  try {
    const violations = detectPronounViolations(opts.message);
    if (violations.length === 0) {
      console.log(`[pronoun-audit] ${opts.functionName} ✓ clean (${opts.message.length} chars)`);
      return;
    }
    const severity = violations.some((v) => v.severity === "critical") ? "critical" : "warning";
    console.warn(
      `[pronoun-audit] ${opts.functionName} ✗ ${violations.length} violation(s) severity=${severity}`,
      violations.map((v) => v.token).join(", "),
    );

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const admin = createClient(url, key);
    await admin.from("pronoun_audit_log").insert({
      function_name: opts.functionName,
      context: opts.context ?? null,
      user_id: opts.userId ?? null,
      target_user_id: opts.targetUserId ?? null,
      message_preview: opts.message.slice(0, 200),
      full_message: opts.message.slice(0, 5000),
      violations: violations,
      severity,
    });
  } catch (e) {
    console.error("[pronoun-audit] log failed", e);
  }
}
