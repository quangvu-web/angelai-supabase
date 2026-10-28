// api-key-status — Health-check endpoint cho app bên thứ 3.
// Gửi header x-api-key → trả về thông tin quota & tình trạng key.
// KHÔNG tính vào quota (chỉ đọc, không increment).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateApiKey, apiKeyErrorResponse } from "../_shared/api-key-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKeyHeader = req.headers.get("x-api-key");
  if (!apiKeyHeader) {
    return json({ ok: false, error: "missing_x_api_key", message: "Gửi API key qua header x-api-key." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const v = await validateApiKey(apiKeyHeader, admin);
  if (!v.ok) {
    const err = apiKeyErrorResponse(v.status);
    return json({
      ok: false,
      code: v.status,
      error: err.message,
      current_usage: v.currentUsage,
      daily_limit: v.dailyLimit,
    }, err.http);
  }

  // Đọc metadata key + image usage hôm nay.
  const today = new Date().toISOString().split("T")[0];
  const startOfDayUtc = new Date(`${today}T00:00:00.000Z`).toISOString();
  const nextResetUtc = (() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  })();

  const [{ data: keyRow }, { data: imgRow }, { data: hourlyRows }] = await Promise.all([
    admin.from("user_api_keys")
      .select("name, key_prefix, daily_limit, image_daily_limit, is_active, created_at, last_used_at, total_requests")
      .eq("id", v.apiKeyId)
      .maybeSingle(),
    admin.from("ai_usage_tracking")
      .select("usage_count")
      .eq("user_id", v.userId)
      .eq("usage_type", "generate_image")
      .eq("usage_date", today)
      .maybeSingle(),
    admin.from("ai_provider_usage_log")
      .select("function_name, created_at")
      .eq("user_id", v.userId)
      .gte("created_at", startOfDayUtc)
      .limit(5000),
  ]);

  // Group hourly buckets (UTC) for chat vs image.
  const chatByHour: Record<number, number> = {};
  const imageByHour: Record<number, number> = {};
  for (const row of hourlyRows ?? []) {
    const h = new Date((row as any).created_at).getUTCHours();
    const fn = String((row as any).function_name ?? "");
    if (fn === "generate-image" || fn === "edit-image") {
      imageByHour[h] = (imageByHour[h] ?? 0) + 1;
    } else {
      chatByHour[h] = (chatByHour[h] ?? 0) + 1;
    }
  }
  const toSeries = (m: Record<number, number>) =>
    Array.from({ length: 24 }, (_, h) => ({ hour_utc: h, count: m[h] ?? 0 }));

  // Simple projection: at current hour's rate, when will chat quota exhaust?
  const nowHour = new Date().getUTCHours();
  const usedThisHour = (chatByHour[nowHour] ?? 0) + (imageByHour[nowHour] ?? 0);
  const chatRemaining = Math.max(0, (v.dailyLimit ?? 0) - (v.currentUsage ?? 0));
  const projectedExhaustionAt = usedThisHour > 0 && chatRemaining > 0
    ? new Date(Date.now() + Math.round((chatRemaining / usedThisHour) * 3600_000)).toISOString()
    : null;

  return json({
    ok: true,
    key: {
      id: v.apiKeyId,
      name: keyRow?.name ?? null,
      prefix: keyRow?.key_prefix ?? null,
      is_active: keyRow?.is_active ?? true,
      created_at: keyRow?.created_at ?? null,
      last_used_at: keyRow?.last_used_at ?? null,
      total_requests: keyRow?.total_requests ?? 0,
    },
    quota: {
      reset_at_utc: nextResetUtc,
      projected_exhaustion_at: projectedExhaustionAt,
      chat: {
        daily_limit: v.dailyLimit,
        used_today: v.currentUsage,
        remaining: Math.max(0, (v.dailyLimit ?? 0) - (v.currentUsage ?? 0)),
        today_by_hour_utc: toSeries(chatByHour),
      },
      image: {
        daily_limit: keyRow?.image_daily_limit ?? 5,
        used_today: imgRow?.usage_count ?? 0,
        remaining: Math.max(0, (keyRow?.image_daily_limit ?? 5) - (imgRow?.usage_count ?? 0)),
        today_by_hour_utc: toSeries(imageByHour),
      },
    },
    endpoints: {
      health: `${supabaseUrl}/functions/v1/health`,
      chat: `${supabaseUrl}/functions/v1/angel-chat`,
      knowledge_search: `${supabaseUrl}/functions/v1/knowledge-search`,
      generate_image: `${supabaseUrl}/functions/v1/generate-image`,
      edit_image: `${supabaseUrl}/functions/v1/edit-image`,
    },
    note: "Endpoint này chỉ đọc, không tính vào quota. Dùng để app đối tác tự kiểm tra key. Dùng /health cho health-check không cần API key.",
  });
});
