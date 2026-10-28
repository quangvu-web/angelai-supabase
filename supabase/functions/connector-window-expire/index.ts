// Connector Window Expire — log a 'window_expired' event for users whose 48h
// Connector window passed without a successful claim. Runs hourly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Find users whose window expired in the last 24h, no connector, and no
    // window_expired event yet.
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: users } = await supabase
      .from("profiles")
      .select("user_id, connector_window_expires_at")
      .eq("has_connector", false)
      .lte("connector_window_expires_at", now)
      .gte("connector_window_expires_at", since)
      .limit(500);

    let logged = 0;
    for (const u of users ?? []) {
      // Skip if already logged
      const { data: existing } = await supabase
        .from("connector_events")
        .select("id")
        .eq("newcomer_user_id", u.user_id)
        .eq("reason", "window_expired")
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      const { error } = await supabase.from("connector_events").insert({
        newcomer_user_id: u.user_id,
        reason: "window_expired",
        payload: { expired_at: u.connector_window_expires_at },
      });
      if (!error) logged++;
    }

    return new Response(JSON.stringify({ ok: true, scanned: users?.length ?? 0, logged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("window-expire error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
