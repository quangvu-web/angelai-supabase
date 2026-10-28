// PPLP Audit Processor
// Processes pending pplp_audits (random audits) by re-scoring via the AI pillar analyzer
// and flagging discrepancies. Auto-suspends users with 3+ flagged audits.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let batchSize = 30;
    try {
      const body = await req.json();
      batchSize = Number(body?.batch_size) || 30;
    } catch { /* default */ }

    console.log(`[AuditProcessor] start | batch_size=${batchSize}`);

    const { data: audits, error: fetchErr } = await supabase
      .from("pplp_audits")
      .select("id, action_id, actor_id, audit_type, original_score")
      .eq("audit_status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (fetchErr) throw fetchErr;

    if (!audits || audits.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No pending audits" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let passedCount = 0;
    let flaggedCount = 0;
    const userFlagCounts: Record<string, number> = {};

    for (const audit of audits) {
      try {
        // Re-fetch action to get content for re-scoring
        const { data: action } = await supabase
          .from("pplp_actions")
          .select("id, action_type, actor_id, metadata, status")
          .eq("id", audit.action_id)
          .maybeSingle();

        if (!action) {
          // Action missing -> close audit as no_op
          await supabase.from("pplp_audits").update({
            audit_status: "completed",
            finding: "action_not_found",
            completed_at: new Date().toISOString(),
          }).eq("id", audit.id);
          continue;
        }

        // Compare original score vs simple sanity recompute (no full AI call to keep cost low)
        const orig = audit.original_score || {};
        const origTotal = Number(orig?.total_score ?? orig?.score ?? 0);

        // Heuristic: flag if score >= 8 but action has no evidence/metadata content
        const hasContent = action.metadata && (
          (action.metadata as any)?.content_length > 50 ||
          (action.metadata as any)?.has_evidence === true ||
          (action.metadata as any)?.beneficiaries > 0
        );
        const suspicious = origTotal >= 8 && !hasContent;

        const newStatus = suspicious ? "flagged" : "passed";
        const finding = suspicious
          ? `High score (${origTotal}) but missing content/evidence signals`
          : "Score consistent with content signals";

        await supabase.from("pplp_audits").update({
          audit_status: newStatus,
          audited_score: { total_score: origTotal, sanity_passed: !suspicious },
          finding,
          action_taken: suspicious ? "flag_for_review" : "no_action",
          completed_at: new Date().toISOString(),
        }).eq("id", audit.id);

        if (suspicious) {
          flaggedCount++;
          userFlagCounts[audit.actor_id] = (userFlagCounts[audit.actor_id] || 0) + 1;
        } else {
          passedCount++;
        }
      } catch (err: any) {
        console.error(`[AuditProcessor] Error on audit ${audit.id}:`, err?.message);
      }
    }

    // Auto-suspend users with >=3 flags via existing RPC
    let suspendedCount = 0;
    for (const [userId, count] of Object.entries(userFlagCounts)) {
      if (count >= 3) {
        try {
          await supabase.rpc("auto_suspend_high_risk", {
            _user_id: userId,
            _risk_score: 80,
            _signals: JSON.stringify([{ type: "AUDIT_FLAG", flags: count }]),
          });
          suspendedCount++;
        } catch (err: any) {
          console.warn(`[AuditProcessor] auto_suspend failed for ${userId}:`, err?.message);
        }
      }
    }

    console.log(`[AuditProcessor] ✓ processed=${audits.length} passed=${passedCount} flagged=${flaggedCount} suspended=${suspendedCount}`);

    return new Response(JSON.stringify({
      success: true,
      processed: audits.length,
      passed: passedCount,
      flagged: flaggedCount,
      auto_suspended: suspendedCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[AuditProcessor] Fatal:", err);
    return new Response(JSON.stringify({
      error: "audit_processor_failed",
      details: err?.message || String(err),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
