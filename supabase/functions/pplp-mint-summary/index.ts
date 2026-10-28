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

    // Get current open cycle
    const { data: cycle } = await supabase
      .from('pplp_mint_cycles')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get active scoring rule
    const { data: rule } = await supabase
      .from('scoring_rules')
      .select('rule_version, name')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    // Get latest transparency snapshot
    const { data: snapshot } = await supabase
      .from('transparency_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return new Response(JSON.stringify({
      epoch_id: cycle ? `Cycle-${cycle.cycle_number}` : null,
      cycle_number: cycle?.cycle_number || null,
      start_date: cycle?.start_date || null,
      end_date: cycle?.end_date || null,
      mint_pool: cycle?.total_mint_pool || 0,
      total_light: cycle?.total_light_contribution || 0,
      max_share_per_user: cycle?.max_share_per_user || 0.03,
      rule_version: rule?.rule_version || 'V1.0',
      rule_name: rule?.name || 'PPLP Light Score V1',
      status: cycle?.status || 'no_cycle',
      latest_snapshot: snapshot ? {
        total_light_system: snapshot.total_light_system,
        total_fun_minted: snapshot.total_fun_minted,
        allocation_by_level: snapshot.allocation_by_level,
        mentor_chains_completed: snapshot.mentor_chains_completed,
        value_loops_completed: snapshot.value_loops_completed,
        active_users: snapshot.active_users,
      } : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[MintSummary] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
