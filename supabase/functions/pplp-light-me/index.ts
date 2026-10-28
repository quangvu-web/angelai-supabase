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

    // Get latest ledger entry with new fields
    const { data: ledger } = await supabase
      .from('light_score_ledger')
      .select('*')
      .eq('user_id', user.id)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ledger) {
      return new Response(JSON.stringify({
        period: null,
        final_light_score: 0,
        reputation_weight: 1.0,
        consistency_multiplier: 1.0,
        sequence_multiplier: 1.0,
        integrity_penalty: 0,
        reason_codes: [],
        trend: 'stable',
        rule_version: 'V1.0',
        level: 'seed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      period: ledger.period,
      final_light_score: Number(ledger.final_light_score),
      reputation_weight: Number(ledger.reputation_weight),
      consistency_multiplier: Number(ledger.consistency_multiplier),
      sequence_multiplier: Number(ledger.sequence_multiplier),
      integrity_penalty: Number(ledger.integrity_penalty),
      reason_codes: ledger.reason_codes || [],
      trend: ledger.trend || 'stable',
      rule_version: ledger.rule_version || 'V1.0',
      level: ledger.level || 'seed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[LightMe] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
