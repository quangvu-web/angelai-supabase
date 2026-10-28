import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !adminUser) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all active temporary suspensions
    const { data: tempSuspensions, error: fetchErr } = await supabase
      .from("user_suspensions")
      .select("id, user_id")
      .eq("suspension_type", "temporary")
      .is("lifted_at", null);

    if (fetchErr) throw fetchErr;

    if (!tempSuspensions || tempSuspensions.length === 0) {
      return new Response(JSON.stringify({ success: true, converted: 0, withdrawals_rejected: 0, mints_rejected: 0 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userIds = [...new Set(tempSuspensions.map(s => s.user_id))];
    const suspensionIds = tempSuspensions.map(s => s.id);

    // 1. Convert all temporary → permanent
    const { error: updateErr } = await supabase
      .from("user_suspensions")
      .update({ suspension_type: "permanent", suspended_until: null })
      .in("id", suspensionIds);

    if (updateErr) throw updateErr;

    // 2. Reject all pending withdrawals & refund balance
    const { data: pendingWithdrawals } = await supabase
      .from("coin_withdrawals")
      .select("id, user_id, amount")
      .in("user_id", userIds)
      .eq("status", "pending");

    let withdrawalsRejected = 0;
    if (pendingWithdrawals && pendingWithdrawals.length > 0) {
      const { error: wdErr } = await supabase
        .from("coin_withdrawals")
        .update({
          status: "failed",
          admin_notes: "Từ chối — Chuyển đổi sang cấm vĩnh viễn",
          processed_at: new Date().toISOString(),
          processed_by: adminUser.id,
        })
        .in("id", pendingWithdrawals.map(w => w.id));

      if (!wdErr) {
        withdrawalsRejected = pendingWithdrawals.length;
        // Note: The update_withdrawal_stats trigger handles refund automatically when status changes to 'failed'
      }
    }

    // 3. Reject all pending/pending_sig mint requests
    const { data: pendingMints } = await supabase
      .from("pplp_mint_requests")
      .select("id")
      .in("requester_id", userIds)
      .in("status", ["pending", "pending_sig"]);

    let mintsRejected = 0;
    if (pendingMints && pendingMints.length > 0) {
      const { error: mintErr } = await supabase
        .from("pplp_mint_requests")
        .update({
          status: "rejected",
          reject_reason: "Tài khoản bị chuyển sang cấm vĩnh viễn",
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminUser.id,
        })
        .in("id", pendingMints.map(m => m.id));

      if (!mintErr) {
        mintsRejected = pendingMints.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        converted: userIds.length,
        withdrawals_rejected: withdrawalsRejected,
        mints_rejected: mintsRejected,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Convert temp to permanent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
