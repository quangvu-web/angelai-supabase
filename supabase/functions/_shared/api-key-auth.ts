// Shared API key authentication helper for external app access.
// Mirrors the pattern used inside angel-chat: hash → validate_api_key RPC → increment_api_key_usage.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ApiKeyValidation =
  | { ok: true; userId: string; apiKeyId: string; dailyLimit: number; currentUsage: number }
  | { ok: false; status: "not_found" | "inactive" | "expired" | "rate_limited" | "error"; dailyLimit?: number; currentUsage?: number };

async function hashApiKey(apiKey: string): Promise<string> {
  const data = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function validateApiKey(apiKey: string, supabase: any): Promise<ApiKeyValidation> {
  try {
    const keyHash = await hashApiKey(apiKey);
    const { data, error } = await supabase.rpc("validate_api_key", { _key_hash: keyHash });
    if (error) {
      console.error("validate_api_key error:", error);
      return { ok: false, status: "error" };
    }
    if (!data || data.length === 0) return { ok: false, status: "not_found" };
    const keyData = data[0];
    const status = keyData.status as string;
    if (status === "ok") {
      return {
        ok: true,
        userId: keyData.user_id,
        apiKeyId: keyData.api_key_id,
        dailyLimit: keyData.daily_limit,
        currentUsage: keyData.current_usage,
      };
    }
    return {
      ok: false,
      status: status as any,
      dailyLimit: keyData.daily_limit,
      currentUsage: keyData.current_usage,
    };
  } catch (err) {
    console.error("validateApiKey exception:", err);
    return { ok: false, status: "error" };
  }
}

export function apiKeyErrorResponse(status: ApiKeyValidation extends { ok: false; status: infer S } ? S : never) {
  const map: Record<string, { http: number; message: string }> = {
    not_found: { http: 401, message: "API key không tồn tại hoặc sai định dạng. Kiểm tra lại header x-api-key." },
    inactive: { http: 403, message: "API key đã bị vô hiệu hoá." },
    expired: { http: 403, message: "API key đã hết hạn." },
    rate_limited: { http: 429, message: "API key đã đạt hạn mức sử dụng trong ngày." },
    error: { http: 500, message: "Không xác thực được API key." },
  };
  return map[status] || map.error;
}

export type ResolvedCaller = {
  userId: string;
  via: "api_key" | "jwt";
  apiKeyId?: string;
  authHeader?: string;
};

/**
 * Resolve caller from either `x-api-key` header (external apps) or JWT `Authorization` header (logged-in users).
 * On success returns { userId, via, apiKeyId? }. On failure returns a Response ready to return.
 * When via='api_key', callers should fire-and-forget increment_api_key_usage.
 */
export async function resolveCaller(req: Request, corsHeaders: Record<string, string>): Promise<ResolvedCaller | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return new Response(JSON.stringify({ error: "Auth service not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKeyHeader = req.headers.get("x-api-key");
  if (apiKeyHeader) {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const result = await validateApiKey(apiKeyHeader, admin);
    if (!result.ok) {
      const err = apiKeyErrorResponse(result.status);
      return new Response(
        JSON.stringify({ error: err.message, status: result.status, current_usage: result.currentUsage, daily_limit: result.dailyLimit }),
        { status: err.http, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Fire-and-forget quota increment (validate_api_key already enforces daily cap).
    admin.rpc("increment_api_key_usage", { _api_key_id: result.apiKeyId, _tokens_used: 0 })
      .then(() => {}).catch((e: unknown) => console.warn("increment_api_key_usage:", e));
    return { userId: result.userId, via: "api_key", apiKeyId: result.apiKeyId };
  }

  // Fall back to JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required (JWT or x-api-key)" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Internal server-to-server: service-role bearer + x-internal-user-id header.
  const bearer = authHeader.slice("Bearer ".length).trim();
  const internalUserId = req.headers.get("x-internal-user-id");
  if (bearer === serviceKey && internalUserId) {
    return { userId: internalUserId, via: "jwt", authHeader };
  }
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    return new Response(JSON.stringify({ error: "Invalid authentication" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: data.user.id, via: "jwt", authHeader };
}
