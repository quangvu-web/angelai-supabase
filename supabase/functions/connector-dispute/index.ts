// connector-dispute: user raise dispute hoặc admin resolve
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "raise");

    // Check admin role helper
    const isAdmin = async () => {
      const { data: roleRow } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!roleRow;
    };

    if (action === "list") {
      if (!(await isAdmin())) {
        return new Response(JSON.stringify({ error: "Chỉ admin được xem danh sách" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const status = body?.status as string | undefined;
      let q = admin
        .from("connector_disputes")
        .select("*, connectors(id, newcomer_user_id, connector_user_id, connector_wallet, tx_hash, chain_id, token_symbol, token_amount, status)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, disputes: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "raise") {
      const { connector_id, reason, evidence } = body;
      if (!connector_id || !reason) {
        return new Response(JSON.stringify({ error: "connector_id và reason bắt buộc" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: c } = await supabase
        .from("connectors")
        .select("id, confirmed_at, status")
        .eq("id", connector_id)
        .maybeSingle();
      if (!c) {
        return new Response(JSON.stringify({ error: "Không tìm thấy Connector" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ageDays = c.confirmed_at
        ? (Date.now() - new Date(c.confirmed_at).getTime()) / 86_400_000
        : 0;
      if (ageDays > 7) {
        return new Response(JSON.stringify({ error: "Quá cửa sổ tranh chấp 7 ngày" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: ins, error: insErr } = await supabase
        .from("connector_disputes")
        .insert({
          connector_id,
          raised_by: user.id,
          reason: String(reason).slice(0, 500),
          evidence: evidence ?? {},
        })
        .select()
        .single();
      if (insErr) throw insErr;
      return new Response(JSON.stringify({ ok: true, dispute: ins }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resolve") {
      if (!(await isAdmin())) {
        return new Response(JSON.stringify({ error: "Chỉ admin được resolve" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { dispute_id, status, revoke_reason } = body;
      if (!dispute_id || !["upheld", "rejected"].includes(status)) {
        return new Response(JSON.stringify({ error: "dispute_id và status (upheld|rejected) bắt buộc" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: disp, error: dispErr } = await admin
        .from("connector_disputes")
        .update({ status, resolved_by: user.id, resolved_at: new Date().toISOString() })
        .eq("id", dispute_id)
        .select("*, connectors(*)")
        .single();
      if (dispErr) throw dispErr;

      if (status === "upheld" && disp?.connector_id) {
        const conn = disp.connectors as any;
        const reasonText = String(revoke_reason ?? "dispute_upheld").slice(0, 200);

        await admin
          .from("connectors")
          .update({ status: "revoked", revoke_reason: reasonText })
          .eq("id", disp.connector_id);

        if (conn?.newcomer_user_id) {
          await admin
            .from("profiles")
            .update({ has_connector: false })
            .eq("user_id", conn.newcomer_user_id);
        }
        if (conn?.connector_user_id) {
          const { data: cp } = await admin
            .from("profiles")
            .select("connector_count")
            .eq("user_id", conn.connector_user_id)
            .maybeSingle();
          await admin
            .from("profiles")
            .update({ connector_count: Math.max(0, (cp?.connector_count ?? 1) - 1) })
            .eq("user_id", conn.connector_user_id);
        }

        // Mark reward log reverted
        await admin
          .from("connector_rewards_log")
          .update({
            reverted: true,
            reverted_at: new Date().toISOString(),
            reverted_reason: reasonText,
          })
          .eq("connector_id", disp.connector_id)
          .eq("reverted", false);

        // Revoke pending/active SBT in registry
        const { data: sbtRows } = await admin
          .from("sbt_registry")
          .select("id, status")
          .eq("sbt_type", "light_connector")
          .eq("evidence_hash", conn?.evidence_hash)
          .in("status", ["pending_mint", "active"]);

        for (const s of sbtRows ?? []) {
          await admin
            .from("sbt_registry")
            .update({
              status: "revoked",
              revoked_at: new Date().toISOString(),
              revocation_reason: reasonText,
            })
            .eq("id", s.id);

          // Cancel the on-chain mint queue if not yet processed
          await admin
            .from("sbt_onchain_queue")
            .update({
              status: "cancelled",
              error_message: `connector_dispute_upheld:${reasonText.slice(0, 200)}`,
              processed_at: new Date().toISOString(),
            })
            .eq("sbt_id", s.id)
            .in("status", ["pending", "failed"]);
        }
      }

      return new Response(JSON.stringify({ ok: true, dispute: disp }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action không hợp lệ" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "internal";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
