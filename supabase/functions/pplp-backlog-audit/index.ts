// pplp-backlog-audit — Admin only
// Phân loại 82 user có pending allocations thành 3 nhóm:
//   Aa: chưa claim (không có pplp_mint_requests nào active/historical cho user)
//   Ab: đã claim nhưng lỗi (có pplp_mint_requests nhưng status rejected/expired/cancelled)
//   Ac: bị loại trừ (có fraud_alert severity high/critical)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Admin check
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) return json({ error: "Admin role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run !== false; // default true

    // 1. Get all users with pending allocations
    const { data: pendingUsers, error: e1 } = await supabaseAdmin
      .from("pplp_mint_allocations")
      .select("user_id, fun_allocated, created_at")
      .eq("status", "pending")
      .gt("fun_allocated", 0);

    if (e1) throw e1;

    // Aggregate per user
    const perUser = new Map<string, { total: number; count: number; oldest: string }>();
    for (const row of pendingUsers || []) {
      const key = row.user_id;
      const cur = perUser.get(key) || { total: 0, count: 0, oldest: row.created_at };
      cur.total += Number(row.fun_allocated || 0);
      cur.count += 1;
      if (row.created_at < cur.oldest) cur.oldest = row.created_at;
      perUser.set(key, cur);
    }

    const userIds = Array.from(perUser.keys());

    // 2. For each user, check classification signals (batch)
    // 2a. Has any past mint requests?
    const { data: mintReqs } = await supabaseAdmin
      .from("pplp_mint_requests")
      .select("actor_id, status")
      .in("actor_id", userIds);

    const userMintMap = new Map<string, string[]>();
    (mintReqs || []).forEach((r) => {
      const arr = userMintMap.get(r.actor_id) || [];
      arr.push(r.status);
      userMintMap.set(r.actor_id, arr);
    });

    // 2b. High-severity fraud alerts (active = not yet whitelisted)
    const { data: fraudAlerts } = await supabaseAdmin
      .from("fraud_alerts")
      .select("user_id, severity, action_taken")
      .in("user_id", userIds)
      .in("severity", ["high", "critical"]);

    const fraudUserSet = new Set<string>();
    (fraudAlerts || []).forEach((f) => {
      // Treat as excluded only if no admin action cleared them
      if (!f.action_taken || f.action_taken === "ban" || f.action_taken === "suspend") {
        fraudUserSet.add(f.user_id);
      }
    });

    // 2c. Whitelist override
    const { data: whitelisted } = await supabaseAdmin
      .from("fraud_whitelist")
      .select("user_id")
      .in("user_id", userIds);
    const whitelistSet = new Set<string>((whitelisted || []).map((w) => w.user_id));

    // 3. Classify
    const results: Array<{
      user_id: string;
      audit_group: "Aa" | "Ab" | "Ac";
      pending_fun: number;
      allocation_count: number;
      notes: string;
      metadata: any;
    }> = [];

    for (const [uid, info] of perUser.entries()) {
      const statuses = userMintMap.get(uid) || [];
      const isFraud = fraudUserSet.has(uid) && !whitelistSet.has(uid);

      let group: "Aa" | "Ab" | "Ac";
      let notes = "";

      if (isFraud) {
        group = "Ac";
        notes = "Bị loại trừ do fraud alert severity high/critical";
      } else if (statuses.length === 0) {
        group = "Aa";
        notes = "User chưa từng bấm Claim — hiển thị banner";
      } else {
        const failedOnly = statuses.every((s) =>
          ["rejected", "expired", "cancelled"].includes(s)
        );
        if (failedOnly) {
          group = "Ab";
          notes = `Đã claim ${statuses.length} lần nhưng đều thất bại (${statuses.join(",")})`;
        } else {
          // Has minted/pending — đã hoặc đang xử lý, không cần audit
          // Vẫn còn pending allocation = có thể là epoch mới
          group = "Aa";
          notes = `Có ${statuses.length} mint requests trước đó, vẫn còn allocation pending mới`;
        }
      }

      results.push({
        user_id: uid,
        audit_group: group,
        pending_fun: Math.round(info.total),
        allocation_count: info.count,
        notes,
        metadata: {
          oldest_allocation: info.oldest,
          historical_mint_statuses: statuses,
        },
      });
    }

    // 4. Persist (unless dry-run)
    let inserted = 0;
    if (!dryRun && results.length > 0) {
      // Upsert by user_id
      const { error: upsertErr } = await supabaseAdmin
        .from("pplp_backlog_audit")
        .upsert(
          results.map((r) => ({
            user_id: r.user_id,
            audit_group: r.audit_group,
            pending_fun: r.pending_fun,
            allocation_count: r.allocation_count,
            notes: r.notes,
            metadata: r.metadata,
            audited_at: new Date().toISOString(),
          })),
          { onConflict: "user_id" }
        );
      if (upsertErr) throw upsertErr;
      inserted = results.length;
    }

    // 5. Summary
    const summary = {
      Aa: { count: 0, total_fun: 0 },
      Ab: { count: 0, total_fun: 0 },
      Ac: { count: 0, total_fun: 0 },
    };
    for (const r of results) {
      summary[r.audit_group].count += 1;
      summary[r.audit_group].total_fun += r.pending_fun;
    }

    return json({
      success: true,
      dry_run: dryRun,
      total_users: results.length,
      inserted,
      summary,
      sample: results.slice(0, 5),
    });
  } catch (err: any) {
    console.error("backlog-audit error:", err);
    return json({ error: err.message || String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
