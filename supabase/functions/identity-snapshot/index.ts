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

    // Generate epoch label: identity_YYYY-Wnn
    const now = new Date();
    const year = now.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((now.getTime() - start.getTime()) / 86400000) + start.getUTCDay() + 1) / 7);
    const epoch = `identity_${year}-W${String(week).padStart(2, '0')}`;

    const { data: dids } = await supabase
      .from('user_dids')
      .select('id')
      .eq('status', 'active')
      .limit(500);

    let success = 0;
    let failed = 0;

    for (const d of dids || []) {
      const { error } = await supabase.rpc('take_identity_snapshot', {
        _did_id: d.id,
        _epoch: epoch,
      });
      if (error) failed++; else success++;
    }

    console.log(`[IdentitySnapshot] ✓ epoch=${epoch} success=${success} failed=${failed}`);
    return new Response(JSON.stringify({ success: true, epoch, snapshotted: success, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[IdentitySnapshot] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
