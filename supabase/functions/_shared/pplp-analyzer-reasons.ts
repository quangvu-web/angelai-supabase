// ============================================================================
// PPLP analyzer observability — reason codes + structured log line.
// OBSERVE ONLY. Nothing here may become a dependency of authoritative scoring.
// Raw content is NEVER logged: only length + sha256 hash.
// ============================================================================

export const ANALYZER_REASONS = {
  ANALYZER_NOT_ELIGIBLE: "ANALYZER_NOT_ELIGIBLE",
  CONTENT_EMPTY: "CONTENT_EMPTY",
  CONTENT_TOO_SHORT: "CONTENT_TOO_SHORT",
  CONTENT_SOURCE_NOT_FOUND: "CONTENT_SOURCE_NOT_FOUND",
  ANALYZER_HTTP_ERROR: "ANALYZER_HTTP_ERROR",
  ANALYZER_TIMEOUT: "ANALYZER_TIMEOUT",
  ANALYZER_INVALID_JSON: "ANALYZER_INVALID_JSON",
  ANALYZER_SCHEMA_INVALID: "ANALYZER_SCHEMA_INVALID",
  ANALYZER_SUCCESS: "ANALYZER_SUCCESS",
} as const;

export type AnalyzerReason = typeof ANALYZER_REASONS[keyof typeof ANALYZER_REASONS];

export interface AnalyzerObservation {
  action_id: string;
  action_type: string;
  content_source: string | null;
  content_length: number;
  content_hash: string | null;
  attempted: boolean;
  status: AnalyzerReason;
  http_status?: number | null;
  duration_ms?: number | null;
}

/** Deterministic mapping from resolver status → analyzer reason code. */
export function reasonFromResolver(
  resolverStatus: string,
  minLength = 10,
  contentLength = 0,
): AnalyzerReason {
  switch (resolverStatus) {
    case "CONTENT_SOURCE_UNSUPPORTED":
      return ANALYZER_REASONS.ANALYZER_NOT_ELIGIBLE;
    case "CONTENT_SOURCE_NOT_FOUND":
      return ANALYZER_REASONS.CONTENT_SOURCE_NOT_FOUND;
    case "CONTENT_EMPTY":
      return ANALYZER_REASONS.CONTENT_EMPTY;
    case "CONTENT_TOO_SHORT":
      return ANALYZER_REASONS.CONTENT_TOO_SHORT;
    case "CONTENT_RESOLVED_REFERENCE":
    case "CONTENT_RESOLVED_REQUEST":
      return contentLength < minLength
        ? ANALYZER_REASONS.CONTENT_TOO_SHORT
        : ANALYZER_REASONS.ANALYZER_SUCCESS;
    default:
      return ANALYZER_REASONS.ANALYZER_NOT_ELIGIBLE;
  }
}

/**
 * Emits one JSON line. Never throws — observability must not affect the
 * authoritative path.
 */
export function logAnalyzerObservation(obs: AnalyzerObservation): void {
  try {
    console.log("[PPLP_ANALYZER_OBS] " + JSON.stringify({
      action_id: obs.action_id,
      action_type: obs.action_type,
      content_source: obs.content_source ?? null,
      content_length: obs.content_length ?? 0,
      content_hash: obs.content_hash ?? null,
      attempted: !!obs.attempted,
      status: obs.status,
      http_status: obs.http_status ?? null,
      duration_ms: obs.duration_ms ?? null,
    }));
  } catch (_e) {
    // swallow
  }
}
