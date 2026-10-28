import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-client-timezone",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all users active in last 180 days
    const { data: activeUsers, error: usersError } = await supabase
      .from("features_user_day")
      .select("user_id")
      .gte("date", new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10));

    if (usersError) throw usersError;

    const uniqueUserIds = [...new Set((activeUsers || []).map((r: any) => r.user_id))];
    
    let computed = 0;
    let errors = 0;

    for (const userId of uniqueUserIds) {
      const { error } = await supabase.rpc("compute_user_dimensions", {
        _user_id: userId,
      });
      if (error) {
        console.error(`Error computing dimensions for ${userId}:`, error.message);
        errors++;
      } else {
        computed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_users: uniqueUserIds.length,
        computed,
        errors,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("pplp-compute-dimensions error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
