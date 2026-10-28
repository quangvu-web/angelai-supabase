import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SBT_CATALOG: Record<string, { type: string; subtype: string; weight: number; check: (ctx: any) => boolean }> = {
  verified_human: {
    type: 'identity', subtype: 'verified_human', weight: 0.05,
    check: (c) => c.email_verified === true,
  },
  consistency_90d: {
    type: 'milestone', subtype: 'consistency_90d', weight: 0.02,
    check: (c) => (c.streak_count || 0) >= 90,
  },
  consistency_30d: {
    type: 'milestone', subtype: 'consistency_30d', weight: 0.02,
    check: (c) => (c.streak_count || 0) >= 30,
  },
  clean_history: {
    type: 'trust', subtype: 'clean_history', weight: 0.08,
    check: (c) => (c.account_age_days || 0) >= 30 && (c.fraud_signals || 0) === 0,
  },
  active_contributor: {
    type: 'contribution', subtype: 'active_contributor', weight: 0.05,
    check: (c) => (c.action_count_30d || 0) >= 50,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const targetDidId = body.did_id;
    const manualType = body.sbt_type;
    const manualSubtype = body.sbt_subtype;

    // Manual issuance mode (from admin)
    if (targetDidId && manualType && manualSubtype) {
      const { data, error } = await supabase.rpc('issue_sbt', {
        _did_id: targetDidId,
        _sbt_type: manualType,
        _sbt_subtype: manualSubtype,
        _issuer: body.issuer || 'admin',
        _evidence_hash: body.evidence_hash || null,
        _trust_weight: body.trust_weight || 0.05,
        _metadata: body.metadata || {},
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, sbt_id: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auto-scan mode
    const dids = targetDidId
      ? (await supabase.from('user_dids').select('id, user_id, verification_state').eq('id', targetDidId)).data
      : (await supabase.from('user_dids').select('id, user_id, verification_state').eq('status','active').limit(200)).data;

    let issued = 0;
    for (const did of dids || []) {
      // Build context
      const { data: streak } = await supabase
        .from('daily_login_tracking')
        .select('streak_count')
        .eq('user_id', did.user_id)
        .order('login_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const since30d = new Date(Date.now() - 30 * 86400000).toISOString();
      const { count: actionCount } = await supabase
        .from('pplp_actions')
        .select('*', { count: 'exact', head: true })
        .eq('actor_id', did.user_id)
        .gte('created_at', since30d);

      const { count: fraudCount } = await supabase
        .from('fraud_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', did.user_id)
        .in('severity', ['high', 'critical']);

      const { data: existing } = await supabase
        .from('sbt_registry')
        .select('sbt_subtype')
        .eq('did_id', did.id)
        .eq('status', 'active');

      const ownedSubtypes = new Set((existing || []).map((s: any) => s.sbt_subtype));

      const ctx = {
        email_verified: did.verification_state?.email_verified,
        streak_count: streak?.streak_count || 0,
        action_count_30d: actionCount || 0,
        fraud_signals: fraudCount || 0,
        account_age_days: 30, // simplified
      };

      for (const [key, def] of Object.entries(SBT_CATALOG)) {
        if (ownedSubtypes.has(def.subtype)) continue;
        if (def.check(ctx)) {
          const { error } = await supabase.rpc('issue_sbt', {
            _did_id: did.id,
            _sbt_type: def.type,
            _sbt_subtype: def.subtype,
            _issuer: 'system_auto',
            _trust_weight: def.weight,
            _metadata: { auto_issued: true, key },
          });
          if (!error) issued++;
        }
      }
    }

    console.log(`[IssueSBT] ✓ ${issued} SBTs auto-issued for ${(dids||[]).length} DIDs`);
    return new Response(JSON.stringify({ success: true, issued, scanned: (dids||[]).length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[IssueSBT] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
