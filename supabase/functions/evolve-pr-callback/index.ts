// Callback gọi từ GitHub Actions sau khi tạo PR (Phase 0).
// Cập nhật angel_evolution_log với pr_url + build_passed.
// Auth: shared secret qua header x-callback-secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-callback-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const expected = Deno.env.get("EVOLVE_CALLBACK_SECRET");
    const provided = req.headers.get("x-callback-secret");
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "Invalid callback secret" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const logId = body?.log_id;
    const prUrl = body?.pr_url || null;
    const buildPassed = body?.build_passed === true || body?.build_passed === "true";

    if (!logId) {
      return new Response(JSON.stringify({ error: "log_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const status = buildPassed ? "pr_opened" : "build_failed";
    const { error } = await adminClient.from("angel_evolution_log")
      .update({ status, pr_url: prUrl, build_passed: buildPassed })
      .eq("id", logId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, log_id: logId, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[evolve-pr-callback] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
