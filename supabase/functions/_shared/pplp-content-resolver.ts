// ============================================================================
// PPLP content resolver — READ-ONLY, EPHEMERAL.
// Resolves the original text of an action from its source-of-truth entity so
// the analyzer can be evaluated. It NEVER writes to the database and its
// output is never persisted. Only contentLength + contentHash may be logged.
//
// CRITICAL-PATH RULE: this module must never become a dependency of
// authoritative scoring. Any failure returns a status, never throws.
// ============================================================================

export type ResolverStatus =
  | "CONTENT_RESOLVED_REFERENCE"
  | "CONTENT_RESOLVED_REQUEST"
  | "CONTENT_EMPTY"
  | "CONTENT_TOO_SHORT"
  | "CONTENT_SOURCE_NOT_FOUND"
  | "CONTENT_SOURCE_UNSUPPORTED";

export interface ResolvedContent {
  status: ResolverStatus;
  source: string | null;
  /** Ephemeral — in-memory only. Must never be persisted or logged. */
  content: string | null;
  contentLength: number;
  contentHash: string | null;
}

export interface ResolverAction {
  id: string;
  action_type: string;
  metadata?: Record<string, unknown> | null;
}

interface MinimalQuery {
  select: (cols: string) => MinimalQuery;
  eq: (col: string, val: unknown) => MinimalQuery;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error?: unknown }>;
}
export interface MinimalClient {
  from: (table: string) => MinimalQuery;
}

/** action_type → { metadata id key, table, column } */
const REFERENCE_MAP: Record<string, { idKey: string; table: string; column: string }> = {
  QUESTION_ASK: { idKey: "question_id", table: "chat_questions", column: "question_text" },
  JOURNAL_WRITE: { idKey: "journal_id", table: "gratitude_journal", column: "content" },
  GRATITUDE_PRACTICE: { idKey: "journal_id", table: "gratitude_journal", column: "content" },
  // Supported by the resolver, but NOT in the production analyzer whitelist.
  COMMUNITY_POST: { idKey: "post_id", table: "community_posts", column: "content" },
  POST_CREATE: { idKey: "post_id", table: "community_posts", column: "content" },
  CONTENT_CREATE: { idKey: "post_id", table: "community_posts", column: "content" },
};

/** action types whose text lives inline in metadata (no entity reference). */
const INLINE_MAP: Record<string, string> = {
  DONATE_SUPPORT: "message",
  DONATE: "message",
};

export const MIN_ANALYZER_CONTENT_LENGTH = 10;

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function finish(status: ResolverStatus, source: string | null, content: string | null): ResolvedContent {
  return { status, source, content, contentLength: content ? content.length : 0, contentHash: null };
}

/**
 * Priority (Decision 1):
 *   1. Entity reference → single-column SELECT from the source of truth
 *   2. Text supplied with the scoring request (ephemeral, never persisted)
 *   3. Nothing → CONTENT_SOURCE_NOT_FOUND (we never write metadata.content_text)
 */
export async function resolveActionContent(
  supabase: MinimalClient,
  action: ResolverAction,
  requestContent?: string | null,
): Promise<ResolvedContent> {
  const metadata = (action.metadata ?? {}) as Record<string, unknown>;
  let out: ResolvedContent;

  const ref = REFERENCE_MAP[action.action_type];
  const inlineKey = INLINE_MAP[action.action_type];

  if (ref) {
    const id = metadata[ref.idKey];
    if (typeof id === "string" && id.length > 0) {
      try {
        const { data } = await supabase.from(ref.table).select(ref.column).eq("id", id).maybeSingle();
        const text = data ? (data as Record<string, unknown>)[ref.column] : null;
        if (typeof text === "string" && text.trim().length > 0) {
          out = finish("CONTENT_RESOLVED_REFERENCE", `${ref.table}.${ref.column}`, text);
          out.contentHash = await sha256Hex(text);
          if (out.contentLength < MIN_ANALYZER_CONTENT_LENGTH) out.status = "CONTENT_TOO_SHORT";
          return out;
        }
        if (data && (text === null || text === "")) {
          return finish("CONTENT_EMPTY", `${ref.table}.${ref.column}`, null);
        }
        return finish("CONTENT_SOURCE_NOT_FOUND", `${ref.table}.${ref.column}`, null);
      } catch (_e) {
        return finish("CONTENT_SOURCE_NOT_FOUND", `${ref.table}.${ref.column}`, null);
      }
    }
  } else if (inlineKey) {
    const inline = metadata[inlineKey];
    if (typeof inline === "string" && inline.trim().length > 0) {
      out = finish("CONTENT_RESOLVED_REFERENCE", `metadata.${inlineKey}`, inline);
      out.contentHash = await sha256Hex(inline);
      if (out.contentLength < MIN_ANALYZER_CONTENT_LENGTH) out.status = "CONTENT_TOO_SHORT";
      return out;
    }
  }

  if (typeof requestContent === "string" && requestContent.trim().length > 0) {
    out = finish("CONTENT_RESOLVED_REQUEST", "request", requestContent);
    out.contentHash = await sha256Hex(requestContent);
    if (out.contentLength < MIN_ANALYZER_CONTENT_LENGTH) out.status = "CONTENT_TOO_SHORT";
    return out;
  }

  if (!ref && !inlineKey) {
    return finish("CONTENT_SOURCE_UNSUPPORTED", null, null);
  }
  return finish("CONTENT_SOURCE_NOT_FOUND", null, null);
}

/** Strictly `"1"` enables the experimental analyzer path. Everything else = OFF. */
export function isExperimentalAnalyzerEnabled(env?: string | undefined | null): boolean {
  return env === "1";
}
