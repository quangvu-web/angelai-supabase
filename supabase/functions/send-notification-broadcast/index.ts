import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BroadcastBody {
  template_id: string;
  cycle_id?: string | null;
  cycle_label?: string | null;
  audience_override?: string | null;
  dry_run?: boolean;
}

function fmtFun(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as BroadcastBody;
    if (!body.template_id) {
      return new Response(JSON.stringify({ error: "template_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tpl, error: tplErr } = await admin
      .from("notification_templates").select("*").eq("id", body.template_id).maybeSingle();
    if (tplErr || !tpl) {
      return new Response(JSON.stringify({ error: "template not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audience = body.audience_override || tpl.audience;
    const cycleLabel = body.cycle_label || "kỳ này";

    // Build recipient list with per-user vars
    type Recipient = { user_id: string; vars: Record<string, string> };
    const recipients: Recipient[] = [];

    if (audience === "cycle_eligible" || audience === "cycle_unclaimed") {
      if (!body.cycle_id) {
        return new Response(JSON.stringify({ error: "cycle_id required for this audience" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: allocs } = await admin
        .from("pplp_mint_allocations")
        .select("user_id, fun_allocated, status")
        .eq("cycle_id", body.cycle_id)
        .eq("eligible", true)
        .gt("fun_allocated", 0);
      const filtered = (allocs || []).filter((a: any) =>
        audience === "cycle_eligible" ? true : a.status !== "minted"
      );
      for (const a of filtered) {
        recipients.push({
          user_id: a.user_id,
          vars: { fun_amount: fmtFun(Number(a.fun_allocated)), cycle_label: cycleLabel },
        });
      }
    } else if (audience === "all_users") {
      // page through profiles
      let from = 0; const PAGE = 1000;
      while (true) {
        const { data: page } = await admin
          .from("profiles").select("user_id").range(from, from + PAGE - 1);
        if (!page || page.length === 0) break;
        for (const p of page) recipients.push({ user_id: p.user_id, vars: { cycle_label: cycleLabel } });
        if (page.length < PAGE) break;
        from += PAGE;
      }
    }

    if (body.dry_run) {
      return new Response(JSON.stringify({
        dry_run: true,
        template: tpl.name,
        audience,
        recipients_count: recipients.length,
        sample_title: tpl.title,
        sample_content: recipients[0]
          ? renderTemplate(tpl.content_template, recipients[0].vars)
          : tpl.content_template,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert notifications, dedupe by reference_id+type per user
    let sent = 0; let skipped = 0;
    const refId = body.cycle_id || tpl.id;
    const CHUNK = 500;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const slice = recipients.slice(i, i + CHUNK);
      // Find already-sent
      const userIds = slice.map(r => r.user_id);
      const { data: existing } = await admin
        .from("notifications").select("user_id")
        .eq("type", tpl.notification_type)
        .eq("reference_id", refId)
        .in("user_id", userIds);
      const existSet = new Set((existing || []).map((e: any) => e.user_id));
      const toInsert = slice.filter(r => !existSet.has(r.user_id)).map(r => ({
        user_id: r.user_id,
        type: tpl.notification_type,
        title: tpl.title,
        content: renderTemplate(tpl.content_template, r.vars),
        reference_id: refId,
        reference_type: body.cycle_id ? "mint_cycle" : "template",
        metadata: {
          ...(tpl.metadata || {}),
          template_id: tpl.id,
          cycle_label: cycleLabel,
          fun_amount: r.vars.fun_amount,
          action_url: tpl.cta_url,
          cta_label: tpl.cta_label,
        },
      }));
      skipped += slice.length - toInsert.length;
      if (toInsert.length > 0) {
        const { error } = await admin.from("notifications").insert(toInsert);
        if (error) {
          console.error("[broadcast] insert error", error);
        } else {
          sent += toInsert.length;
        }
      }
    }

    await admin.from("notification_broadcasts").insert({
      template_id: tpl.id,
      cycle_id: body.cycle_id || null,
      cycle_label: cycleLabel,
      audience,
      recipients_count: recipients.length,
      sent_count: sent,
      skipped_count: skipped,
      status: "completed",
      sent_by: user.id,
    });

    return new Response(JSON.stringify({
      success: true, template: tpl.name, audience,
      recipients_count: recipients.length, sent, skipped,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[broadcast] error", err);
    return new Response(JSON.stringify({ error: err.message || "internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
