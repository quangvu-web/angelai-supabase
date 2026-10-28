import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const VALID_EVENT_TYPES = [
  'POST_CREATED', 'POST_LIKED', 'COMMENT_CREATED', 'QUESTION_ASKED',
  'JOURNAL_WRITTEN', 'HELP_GIVEN', 'SHARE_CONTENT', 'DONATION_MADE',
  'MENTOR_HELP', 'PROFILE_COMPLETE', 'LEARN_EARN_COMPLETE',
  'CONFLICT_RESOLVE', 'GRATITUDE_PUBLIC', 'DONATE_SUPPORT',
  'LOGIN', 'VISION_BOARD_CREATED', 'ANALYSIS_POST',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
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
    const { event_type, target_id, context_id, payload } = body;

    if (!event_type || !VALID_EVENT_TYPES.includes(event_type)) {
      return new Response(JSON.stringify({ error: 'Invalid event_type', valid_types: VALID_EVENT_TYPES }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabase
      .from('pplp_events')
      .insert({
        actor_user_id: user.id,
        event_type,
        target_id: target_id || null,
        context_id: context_id || null,
        payload: payload || {},
      })
      .select('id')
      .single();

    if (error) {
      console.error('[EventIngest] Insert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to ingest event' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: 'accepted', event_id: data.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[EventIngest] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
