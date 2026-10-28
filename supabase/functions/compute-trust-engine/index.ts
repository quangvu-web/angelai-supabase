import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const singleDidId = url.searchParams.get('did_id');

    // Single DID mode (manual recompute from admin)
    if (singleDidId) {
      const { error } = await supabase.rpc('compute_trust_confidence', { _did_id: singleDidId });
      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ success: true, did_id: singleDidId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Batch mode (cron daily) — applies decay + writes trust_history snapshot
    const { data, error } = await supabase.rpc('apply_trust_decay_batch');
    if (error) throw error;

    console.log('[TrustEngine] Batch decay result:', data);
    return new Response(JSON.stringify({ success: true, ...(data as object) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[TrustEngine] Error:', err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'unknown',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
