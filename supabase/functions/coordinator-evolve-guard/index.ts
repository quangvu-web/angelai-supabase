// Phase 0 — Safety Gate cho mọi evolve_workspace request từ Coordinator.
// Client KHÔNG gọi Cloudflare Worker trực tiếp nữa; mọi yêu cầu đi qua đây.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BLOCK_PREFIXES = [
  "src/integrations/supabase/",
];
const BLOCK_EXACT = new Set<string>([
  ".env",
  ".env.local",
  ".env.production",
  "package.json",
  "package-lock.json",
  "bun.lockb",
  "vite.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
]);
const BLOCK_TOP_DIRS = ["supabase/", "contracts/", ".github/", "public/sdk/", "public/embed/"];

function validatePayload(args: any): { ok: true } | { ok: false; reason: string } {
  if (!args || typeof args !== "object") return { ok: false, reason: "args_missing" };
  const fp = String(args.file_path || "");
  const bn = String(args.branch_name || "");
  const cm = String(args.commit_message || "");
  const cc = String(args.code_content || "");

  if (!fp.startsWith("src/")) return { ok: false, reason: "path_not_in_whitelist" };
  if (fp.includes("..") || fp.startsWith("/")) return { ok: false, reason: "path_invalid" };
  for (const p of BLOCK_PREFIXES) if (fp.startsWith(p)) return { ok: false, reason: `blocked_prefix:${p}` };
  if (BLOCK_EXACT.has(fp)) return { ok: false, reason: "blocked_exact_file" };
  for (const d of BLOCK_TOP_DIRS) if (fp.startsWith(d)) return { ok: false, reason: `blocked_dir:${d}` };

  if (!/^angel\/[a-z0-9-]+$/.test(bn)) return { ok: false, reason: "branch_name_invalid" };
  if (!cm.trim() || cm.length > 200) return { ok: false, reason: "commit_message_invalid" };
  if (!cc || cc.length < 1) return { ok: false, reason: "code_content_empty" };

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Role check
    const { data: roleData } = await adminClient
      .from("user_roles").select("role").eq("user_id", userId)
      .in("role", ["coordinator", "admin"]);
    if (!roleData || roleData.length === 0) {
      await adminClient.from("angel_evolution_log").insert({
        coordinator_id: userId, tool_call: {}, status: "rejected",
        reject_reason: "role_required_coordinator_or_admin",
      });
      return new Response(JSON.stringify({ error: "Coordinator access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const args = body?.args || body;

    // Validate
    const v = validatePayload(args);
    if (!v.ok) {
      await adminClient.from("angel_evolution_log").insert({
        coordinator_id: userId, tool_call: { args }, status: "rejected",
        reject_reason: v.reason,
      });
      return new Response(JSON.stringify({ error: "Payload rejected", reason: v.reason }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5/hour, 20/day per coordinator (defense layer)
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { count: hourCount } = await adminClient
      .from("angel_evolution_log").select("*", { count: "exact", head: true })
      .eq("coordinator_id", userId).gte("created_at", oneHourAgo)
      .in("status", ["dispatched", "pr_opened", "build_failed"]);
    const { count: dayCount } = await adminClient
      .from("angel_evolution_log").select("*", { count: "exact", head: true })
      .eq("coordinator_id", userId).gte("created_at", oneDayAgo)
      .in("status", ["dispatched", "pr_opened", "build_failed"]);

    if ((hourCount ?? 0) >= 5 || (dayCount ?? 0) >= 20) {
      await adminClient.from("angel_evolution_log").insert({
        coordinator_id: userId, tool_call: { args }, status: "rate_limited",
        reject_reason: `hour=${hourCount}/5 day=${dayCount}/20`,
      });
      return new Response(JSON.stringify({ error: "Rate limit exceeded", hour: hourCount, day: dayCount }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert dispatched log
    const { data: logRow, error: insertErr } = await adminClient
      .from("angel_evolution_log").insert({
        coordinator_id: userId, tool_call: { args }, status: "dispatched",
        pr_branch: args.branch_name,
      }).select("id").single();
    if (insertErr || !logRow) {
      return new Response(JSON.stringify({ error: "Log insert failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const logId = logRow.id;

    // Forward to Cloudflare Worker
    const workerUrl = Deno.env.get("EVOLVE_WORKER_URL");
    const workerToken = Deno.env.get("EVOLVE_WORKER_TOKEN");
    if (!workerUrl) {
      return new Response(JSON.stringify({ error: "EVOLVE_WORKER_URL not configured", log_id: logId }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workerPayload = { ...args, log_id: logId };
    const workerHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (workerToken) workerHeaders["Authorization"] = `Bearer ${workerToken}`;

    const workerResp = await fetch(workerUrl, {
      method: "POST", headers: workerHeaders, body: JSON.stringify(workerPayload),
    });
    const workerData = await workerResp.json().catch(() => ({}));

    await adminClient.from("angel_evolution_log").update({
      github_status: workerData?.github_status ?? workerResp.status,
    }).eq("id", logId);

    return new Response(JSON.stringify({
      ok: workerResp.ok, log_id: logId,
      github_status: workerData?.github_status ?? workerResp.status,
      worker: workerData,
    }), {
      status: workerResp.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[coordinator-evolve-guard] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
