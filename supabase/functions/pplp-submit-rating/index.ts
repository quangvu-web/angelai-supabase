import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { content_id, pillar_truth, pillar_sustain, pillar_heal_love, pillar_life_service, pillar_unity_source, comment } = body;

    if (!content_id) {
      return new Response(JSON.stringify({ error: 'content_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate pillar scores (0-2)
    const pillars = [pillar_truth, pillar_sustain, pillar_heal_love, pillar_life_service, pillar_unity_source];
    for (const p of pillars) {
      if (typeof p !== 'number' || p < 0 || p > 2) {
        return new Response(JSON.stringify({ error: 'Pillar scores must be 0-2' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check rater reputation for weight
    let weightApplied = 1.0;
    try {
      const { data: repData } = await supabase.rpc('calculate_reputation_weight', { _user_id: user.id });
      if (repData) weightApplied = Math.max(0.5, Math.min(1.5, Number(repData)));
    } catch (_) { /* default weight 1.0 */ }

    // Prevent self-rating: find content owner
    const { data: action } = await supabase
      .from('pplp_actions')
      .select('actor_id')
      .eq('id', content_id)
      .maybeSingle();

    if (action && action.actor_id === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot rate own content' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('pplp_ratings')
      .insert({
        rater_user_id: user.id,
        content_id,
        pillar_truth: pillar_truth || 0,
        pillar_sustain: pillar_sustain || 0,
        pillar_heal_love: pillar_heal_love || 0,
        pillar_life_service: pillar_life_service || 0,
        pillar_unity_source: pillar_unity_source || 0,
        comment: comment || null,
        weight_applied: weightApplied,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return new Response(JSON.stringify({ error: 'Already rated this content' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('[SubmitRating] Error:', error);
      return new Response(JSON.stringify({ error: 'Failed to submit rating' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'accepted', rating_id: data.id, weight_applied: weightApplied }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SubmitRating] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
