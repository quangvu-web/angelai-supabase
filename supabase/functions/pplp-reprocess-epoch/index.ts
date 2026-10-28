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

    // Verify admin caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse cycle_id from body
    let cycleId: string | null = null;
    try {
      const body = await req.json();
      cycleId = body.cycle_id || null;
    } catch { /* no body */ }

    // Find the cycle to reprocess
    let cycle: Record<string, unknown> | null = null;
    if (cycleId) {
      const { data } = await supabase
        .from('pplp_mint_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();
      cycle = data;
    } else {
      // Find latest distributed or open cycle
      const { data } = await supabase
        .from('pplp_mint_cycles')
        .select('*')
        .in('status', ['distributed', 'open'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      cycle = data;
    }

    if (!cycle) {
      return new Response(JSON.stringify({ error: 'No cycle found to reprocess' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cId = cycle.id as string;
    console.log(`[ReprocessEpoch] Reprocessing cycle ${cId} (#${cycle.cycle_number})`);

    // STEP 1: Delete all existing allocations for this cycle
    const { count: deletedAllocations } = await supabase
      .from('pplp_mint_allocations')
      .delete({ count: 'exact' })
      .eq('cycle_id', cId);

    console.log(`[ReprocessEpoch] Deleted ${deletedAllocations || 0} old allocations`);

    // STEP 2: Delete all existing epoch mint requests for this cycle
    // Since action_id is now a deterministic UUID, we need to find them via actor_id
    // from the allocations we just deleted, or regenerate the UUIDs
    // Simpler approach: delete mint requests where actor_id is in the allocation list
    // and the request was created during this cycle period
    const { data: cycleAllocUsers } = await supabase
      .from('pplp_mint_allocations')
      .select('user_id')
      .eq('cycle_id', cId);

    // Since we already deleted allocations above, we need another approach
    // Delete pending epoch mint requests created around the cycle period
    const { count: deletedMintRequests } = await supabase
      .from('pplp_mint_requests')
      .delete({ count: 'exact' })
      .eq('status', 'pending')
      .gte('created_at', cycle.start_date as string)
      .lte('created_at', cycle.end_date as string);

    console.log(`[ReprocessEpoch] Deleted ${deletedMintRequests || 0} old mint requests`);

    // STEP 3: Delete old transparency snapshot
    const epochStart = (cycle.start_date as string).split('T')[0];
    const period = epochStart.substring(0, 7);
    await supabase
      .from('transparency_snapshots')
      .delete()
      .eq('epoch_id', `Epoch-${period}`);

    // STEP 4: Reset cycle status to 'open'
    await supabase
      .from('pplp_mint_cycles')
      .update({
        status: 'open',
        updated_at: new Date().toISOString(),
      })
      .eq('id', cId);

    console.log(`[ReprocessEpoch] Cycle reset to 'open'. Now calling epoch-allocate...`);

    // STEP 5: Call pplp-epoch-allocate with the fixed logic
    const allocateResponse = await fetch(
      `${supabaseUrl}/functions/v1/pplp-epoch-allocate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
        },
        body: JSON.stringify({ cycle_id: cId }),
      }
    );

    const allocateResult = await allocateResponse.json();

    if (!allocateResponse.ok) {
      console.error('[ReprocessEpoch] Epoch allocate failed:', allocateResult);
      return new Response(JSON.stringify({
        error: 'Epoch allocation failed',
        details: allocateResult,
        cleanup: {
          deleted_allocations: deletedAllocations || 0,
          deleted_mint_requests: deletedMintRequests || 0,
        },
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[ReprocessEpoch] Done! ${allocateResult.eligible_users || 0} users allocated, ${allocateResult.mint_requests_created || 0} mint requests`);

    return new Response(JSON.stringify({
      success: true,
      reprocess_summary: {
        cycle_id: cId,
        cycle_number: cycle.cycle_number,
        period,
        deleted_allocations: deletedAllocations || 0,
        deleted_mint_requests: deletedMintRequests || 0,
      },
      allocation_result: allocateResult,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[ReprocessEpoch] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
