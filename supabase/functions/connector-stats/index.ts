// connector-stats: trả về thông tin Connector của user hiện tại + connectees
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

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. My profile + window status
    const { data: profile } = await supabase
      .from("profiles")
      .select("connector_count, has_connector, connector_window_expires_at, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    // 2. My connector (someone who connected ME)
    const { data: myConnector } = await supabase
      .from("connectors")
      .select("*")
      .eq("newcomer_user_id", user.id)
      .maybeSingle();

    let connectorProfile = null;
    if (myConnector?.connector_user_id) {
      const { data: cp } = await supabase
        .from("profiles")
        .select("user_id, display_name, handle, avatar_url")
        .eq("user_id", myConnector.connector_user_id)
        .maybeSingle();
      connectorProfile = cp;
    }

    // 3. People I connected (newcomers I gave to)
    const { data: connectees } = await supabase
      .from("connectors")
      .select("id, newcomer_user_id, tx_hash, token_symbol, token_amount, confirmed_at, status")
      .eq("connector_user_id", user.id)
      .order("confirmed_at", { ascending: false })
      .limit(50);

    let connecteeProfiles: any[] = [];
    if (connectees && connectees.length > 0) {
      const ids = connectees.map((c: any) => c.newcomer_user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, handle, avatar_url")
        .in("user_id", ids);
      connecteeProfiles = profs ?? [];
    }

    return new Response(
      JSON.stringify({
        profile,
        my_connector: myConnector,
        my_connector_profile: connectorProfile,
        connectees,
        connectee_profiles: connecteeProfiles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "internal";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
