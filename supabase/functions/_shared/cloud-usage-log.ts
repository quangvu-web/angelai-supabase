// Lightweight fire-and-forget logger for Cloud Usage Observability.
// Each edge function can call `logCloudUsage(name, ms, ok)` at the end of a request.
// Writes are aggregated into the current-hour bucket on `cloud_usage_snapshots`.
//
// Cost model (Supabase Edge Functions pricing, subject to change):
//   $0.00000210 per compute-ms + $0.0000004 per invocation.
// The number is an estimate for observability — the source of truth remains
// the Cloud & AI balance dashboard.

const COST_PER_MS = 0.00000210;
const COST_PER_INVOCATION = 0.0000004;

function bucketStart(now = new Date()): string {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export async function logCloudUsage(
  functionName: string,
  durationMs: number,
  ok: boolean,
): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;

    const cost =
      (durationMs || 0) * COST_PER_MS + COST_PER_INVOCATION;

    const payload = {
      _function_name: functionName,
      _bucket_start: bucketStart(),
      _duration_ms: Math.max(0, Math.round(durationMs || 0)),
      _error: !ok,
      _cost: cost,
    };

    // Fire-and-forget: don't await response body.
    await fetch(`${url}/rest/v1/rpc/log_cloud_usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (_e) {
    // Observability must never break the caller.
  }
}
