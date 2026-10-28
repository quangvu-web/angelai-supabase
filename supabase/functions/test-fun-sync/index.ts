import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get('FUN_PROFILE_INGEST_URL');
    const key = Deno.env.get('FUN_PROFILE_INGEST_KEY');

    if (!url || !key) {
      return new Response(JSON.stringify({ 
        error: 'Missing config',
        has_url: !!url,
        has_key: !!key 
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test with real data
    const testPayload = {
      fun_profile_id: 'c5d16130-ed12-4874-9651-7377031a273e',
      action_type: 'QUESTION_ASK',
      light_score: 62.25,
      evidence_hash: '45b7a27c-79ed-4f57-82bc-10dc8de67127',
      metadata: {
        content_preview: 'Test sync from Angel AI',
        source: 'angel_ai',
        original_action_id: '45b7a27c-79ed-4f57-82bc-10dc8de67127',
        created_at: new Date().toISOString(),
      },
    };

    console.log('[TestSync] Sending to:', url);
    console.log('[TestSync] Payload:', JSON.stringify(testPayload));

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
      },
      body: JSON.stringify(testPayload),
    });

    const responseText = await res.text();
    console.log('[TestSync] Response status:', res.status);
    console.log('[TestSync] Response body:', responseText);

    let result;
    try { result = JSON.parse(responseText); } catch { result = { raw: responseText }; }

    return new Response(JSON.stringify({
      test: 'sync_to_fun_profile',
      request_url: url,
      response_status: res.status,
      response_ok: res.ok,
      result,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TestSync] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
