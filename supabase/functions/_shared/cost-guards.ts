import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCloudUsage } from "./cloud-usage-log.ts";

export const costCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonResponse(body: unknown, status = 200, headers = costCorsHeaders): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export type AuthenticatedUser = {
  userId: string;
  authHeader: string;
};

export type UserOrServiceRole = {
  userId: string | null;
  authHeader: string;
  isServiceRole: boolean;
};

export async function requireAuthenticatedUser(req: Request): Promise<AuthenticatedUser | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Authentication required" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Auth service is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    return jsonResponse({ error: "Invalid authentication" }, 401);
  }

  return { userId: data.user.id, authHeader };
}

export async function requireUserOrServiceRole(req: Request): Promise<UserOrServiceRole | Response> {
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (authHeader && serviceKey && bearer === serviceKey) {
    return { userId: null, authHeader, isServiceRole: true };
  }

  const auth = await requireAuthenticatedUser(req);
  if (auth instanceof Response) return auth;
  return { userId: auth.userId, authHeader: auth.authHeader, isServiceRole: false };
}

export async function requireAdmin(req: Request): Promise<{ adminUserId: string; authHeader: string } | Response> {
  const auth = await requireAuthenticatedUser(req);
  if (auth instanceof Response) return auth;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Database service is not configured" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error || !data) {
    return jsonResponse({ error: "Admin access required" }, 403);
  }

  return { adminUserId: auth.userId, authHeader: auth.authHeader };
}

export async function requireAdminOrServiceRole(
  req: Request,
): Promise<{ adminUserId: string | null; authHeader: string; isServiceRole: boolean } | Response> {
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (authHeader && serviceKey && bearer === serviceKey) {
    return { adminUserId: null, authHeader, isServiceRole: true };
  }

  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;
  return { adminUserId: admin.adminUserId, authHeader: admin.authHeader, isServiceRole: false };
}

export async function rateLimitCostlyAction(opts: {
  userId: string;
  action: string;
  limit: number;
  increment?: boolean;
}): Promise<{ allowed: true; currentCount?: number; dailyLimit?: number } | Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Rate limit service is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const rpc = opts.increment ? "check_and_increment_ai_usage" : "check_ai_usage_only";
  const { data, error } = await supabase.rpc(rpc, {
    _user_id: opts.userId,
    _usage_type: opts.action,
    _daily_limit: opts.limit,
  });

  if (error) {
    console.error(`[cost-guard] ${rpc} failed`, error);
    return jsonResponse({ error: "Could not check usage limit" }, 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    return jsonResponse({
      error: "Daily limit reached",
      limit_reached: true,
      current_count: row.current_count,
      daily_limit: row.daily_limit ?? opts.limit,
    }, 429);
  }

  return { allowed: true, currentCount: row?.current_count, dailyLimit: row?.daily_limit ?? opts.limit };
}

export function withCloudUsage(
  functionName: string,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const started = performance.now();
    let ok = true;
    try {
      const response = await handler(req);
      ok = response.status < 500;
      return response;
    } catch (error) {
      ok = false;
      throw error;
    } finally {
      if (req.method !== "OPTIONS") {
        logCloudUsage(functionName, performance.now() - started, ok).catch(() => {});
      }
    }
  };
}

export async function logAiProviderUsage(row: {
  functionName: string;
  provider: string;
  model?: string;
  status?: number;
  userId?: string | null;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    await supabase.from("ai_provider_usage_log").insert({
      function_name: row.functionName,
      provider: row.provider,
      model: row.model ?? null,
      status: row.status ?? null,
      user_id: row.userId ?? null,
      estimated_input_tokens: row.estimatedInputTokens ?? null,
      estimated_output_tokens: row.estimatedOutputTokens ?? null,
      metadata: row.metadata ?? {},
    });
  } catch (_error) {
    // Cost logging must never break product traffic.
  }
}
