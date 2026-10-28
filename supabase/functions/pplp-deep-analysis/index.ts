import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Body {
  post_id: string;
  force?: boolean; // ignore cache if true
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // verify user
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { post_id, force = false }: Body = await req.json();
    if (!post_id || typeof post_id !== 'string') {
      return new Response(JSON.stringify({ error: "post_id required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: post, error: postErr } = await admin
      .from("community_posts")
      .select("id, content, metadata")
      .eq("id", post_id)
      .maybeSingle();

    if (postErr || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check cache
    const meta = (post.metadata as Record<string, unknown> | null) || {};
    const cached = meta.deep_analysis as { analyzed_at?: string } | undefined;
    if (!force && cached?.analyzed_at) {
      const age = Date.now() - new Date(cached.analyzed_at).getTime();
      if (age < CACHE_TTL_MS) {
        return new Response(JSON.stringify({ cached: true, analysis: cached }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Call analyzer in deep mode
    const analyzerResp = await fetch(`${SUPABASE_URL}/functions/v1/pplp-ai-pillar-analyzer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: post.content,
        content_type: 'community_post',
        mode: 'deep',
      }),
    });

    if (!analyzerResp.ok) {
      const txt = await analyzerResp.text();
      console.error("Analyzer call failed:", analyzerResp.status, txt);
      return new Response(JSON.stringify({ error: "Analysis failed" }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const analysis = await analyzerResp.json();
    const enriched = { ...analysis, analyzed_at: new Date().toISOString() };

    // Cache into metadata
    const newMeta = { ...meta, deep_analysis: enriched };
    await admin
      .from("community_posts")
      .update({ metadata: newMeta })
      .eq("id", post_id);

    return new Response(JSON.stringify({ cached: false, analysis: enriched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error("pplp-deep-analysis error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
