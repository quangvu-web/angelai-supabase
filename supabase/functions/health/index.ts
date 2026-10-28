// health — Public health-check (no API key, no auth). Cheap probe for partners.
// Returns quick service status + minimal DB latency check. Not counted in quota.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let dbStatus: "ok" | "degraded" | "down" = "ok";
  let dbLatency: number | null = null;
  try {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const t = Date.now();
    // Cheapest possible read: 1 row from a small public config table.
    const { error } = await admin
      .from("telegram_bot_config")
      .select("id")
      .limit(1);
    dbLatency = Date.now() - t;
    if (error) dbStatus = "degraded";
    else if (dbLatency > 1500) dbStatus = "degraded";
  } catch {
    dbStatus = "down";
  }

  const aiGateway = Deno.env.get("LOVABLE_API_KEY") ? "configured" : "missing";
  const googleAi = Deno.env.get("GOOGLE_AI_API_KEY") ? "configured" : "missing";
  const fal = Deno.env.get("FAL_KEY") ? "configured" : "missing";

  const ok = dbStatus !== "down";
  return new Response(
    JSON.stringify({
      ok,
      service: "angel-ai",
      time: new Date().toISOString(),
      latency_ms: Date.now() - started,
      checks: {
        db: dbStatus,
        db_latency_ms: dbLatency,
        ai_gateway: aiGateway,
        google_ai: googleAi,
        fal: fal,
      },
      endpoints: {
        chat: `${supabaseUrl}/functions/v1/angel-chat`,
        generate_image: `${supabaseUrl}/functions/v1/generate-image`,
        edit_image: `${supabaseUrl}/functions/v1/edit-image`,
        knowledge_search: `${supabaseUrl}/functions/v1/knowledge-search`,
        knowledge_external_ingest: `${supabaseUrl}/functions/v1/knowledge-external-ingest`,
        api_key_status: `${supabaseUrl}/functions/v1/api-key-status`,
      },
      note: "Public health probe. No API key required. Not counted against quota.",
    }),
    {
      status: ok ? 200 : 503,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=10",
      },
    },
  );
});
