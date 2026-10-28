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

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const userId = url.searchParams.get("user_id");

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing action parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client for local DB operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // FUN Profile API base URL
    const FUN_PROFILE_API = Deno.env.get("FUN_PROFILE_API_URL") || "https://fun.rich";
    const FUN_PROFILE_API_KEY = Deno.env.get("FUN_PROFILE_API_KEY") || "";

    switch (action) {
      case "light-score": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Missing user_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get local Light Score from Angel AI
        const { data: localLS } = await supabase
          .from("light_score_ledger")
          .select("final_light_score, computed_at")
          .eq("user_id", userId)
          .order("computed_at", { ascending: false })
          .limit(1);

        // Get linked FUN Profile ID
        const { data: link } = await supabase
          .from("fun_id_links")
          .select("fun_profile_user_id")
          .eq("angel_user_id", userId)
          .eq("status", "active")
          .maybeSingle();

        let funProfileLS = 0;
        if (link?.fun_profile_user_id && FUN_PROFILE_API_KEY) {
          try {
            const res = await fetch(
              `${FUN_PROFILE_API}/api/v1/light/profile/${link.fun_profile_user_id}`,
              { headers: { Authorization: `Bearer ${FUN_PROFILE_API_KEY}` } }
            );
            if (res.ok) {
              const data = await res.json();
              funProfileLS = data.light_score || 0;
            }
          } catch (e) {
            console.error("Failed to fetch FUN Profile LS:", e);
          }
        }

        const angelLS = (localLS?.[0] as any)?.final_light_score ?? 0;

        return new Response(
          JSON.stringify({
            angel_ai: { light_score: angelLS },
            fun_profile: { light_score: funProfileLS },
            combined: { light_score: angelLS + funProfileLS },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "dashboard-stats": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Missing user_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const [lsRes, postsRes, chatsRes] = await Promise.all([
          supabase.from("light_score_ledger").select("final_light_score").eq("user_id", userId).order("computed_at", { ascending: false }).limit(1),
          supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
          supabase.from("chat_history").select("id", { count: "exact", head: true }).eq("user_id", userId),
        ]);

        return new Response(
          JSON.stringify({
            angel_ai: {
              light_score: (lsRes.data?.[0] as any)?.final_light_score ?? 0,
              posts_count: postsRes.count ?? 0,
              chats_count: chatsRes.count ?? 0,
            },
            fun_profile: {
              status: "bridge_pending",
              light_score: 0,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "activity-history": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "Missing user_id" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: history } = await supabase
          .from("features_user_day")
          .select("*")
          .eq("user_id", userId)
          .order("date", { ascending: false })
          .limit(30);

        return new Response(
          JSON.stringify({
            angel_ai: history || [],
            fun_profile: [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Bridge error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
