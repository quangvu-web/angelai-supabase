// pplp-mint-auto-expire — chạy mỗi 6h
// Tự động cancel các request pending_sig quá 14 ngày, hoàn allocation về pending để user claim lại
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPIRE_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cutoff = new Date(Date.now() - EXPIRE_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // 1. Find stuck requests
    const { data: stuck, error: e1 } = await supabase
      .from("pplp_mint_requests")
      .select("id, actor_id, amount, created_at")
      .eq("status", "pending_sig")
      .lt("created_at", cutoff);

    if (e1) throw e1;
    if (!stuck || stuck.length === 0) {
      return json({ success: true, expired: 0, message: "No stuck requests" });
    }

    let expired = 0;
    const errors: any[] = [];

    for (const req of stuck) {
      try {
        // Reuse the safe RPC built in Phase 1
        const { error: rpcErr } = await supabase.rpc("cancel_mint_request_safe", {
          p_request_id: req.id,
          p_reason: `Auto-expired after ${EXPIRE_DAYS} days (cron)`,
        });
        if (rpcErr) throw rpcErr;

        // Notify user
        await supabase.from("notifications").insert({
          user_id: req.actor_id,
          type: "mint_expired",
          title: "Yêu cầu mint FUN đã hết hạn",
          message: `Yêu cầu ${Math.round(Number(req.amount))} FUN của bạn đã quá ${EXPIRE_DAYS} ngày chưa đủ chữ ký Attester. FUN đã được hoàn về trạng thái chờ — bạn có thể bấm "Claim FUN" lại trong trang Profile.`,
          data: { request_id: req.id, amount: req.amount },
        });

        expired += 1;
      } catch (err: any) {
        errors.push({ request_id: req.id, error: err.message });
      }
    }

    console.log(`auto-expire: processed ${stuck.length}, expired ${expired}, errors ${errors.length}`);

    return json({
      success: true,
      total_stuck: stuck.length,
      expired,
      errors,
    });
  } catch (err: any) {
    console.error("auto-expire error:", err);
    return json({ error: err.message || String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
