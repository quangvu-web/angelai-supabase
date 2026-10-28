import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LEVEL_MAP = [
  { min: 0, max: 20, name: 'Light Seed' },
  { min: 21, max: 40, name: 'Light Sprout' },
  { min: 41, max: 60, name: 'Light Builder' },
  { min: 61, max: 80, name: 'Light Guardian' },
  { min: 81, max: 999, name: 'Light Architect' },
];

function getLevel(score: number): string {
  for (const l of LEVEL_MAP) {
    if (score >= l.min && score <= l.max) return l.name;
  }
  return 'Light Seed';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');
    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parallel queries for performance
    const [ledgerResult, loginResult, sequenceResult, mintResult, recentActionsResult, scoresResult, trustResult] = await Promise.all([
      supabase
        .from('light_score_ledger')
        .select('level, trend, final_light_score, period')
        .eq('user_id', userId)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('daily_login_tracking')
        .select('streak_count')
        .eq('user_id', userId)
        .order('login_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('pplp_behavior_sequences')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active'),
      supabase
        .from('fun_distribution_logs')
        .select('user_amount')
        .eq('actor_id', userId),
      supabase
        .from('pplp_actions')
        .select('*', { count: 'exact', head: true })
        .eq('actor_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('pplp_scores')
        .select('pillar_s, pillar_t, pillar_h, pillar_c, pillar_u')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      // NEW: read from trust_profile (Identity+Trust Layer v1)
      supabase
        .from('trust_profile')
        .select('tc, trust_tier, sybil_risk, vs, bs, ss, os, hs')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const ledger = ledgerResult.data;
    const loginData = loginResult.data;
    const activeSequences = sequenceResult.count;
    const mintData = mintResult.data;
    const recentActions = recentActionsResult.count;
    const scores = scoresResult.data;
    const trust = trustResult.data;

    const level = ledger?.level
      ? ledger.level.charAt(0).toUpperCase() + ledger.level.slice(1)
      : getLevel(0);

    let pillarSummary = null;
    if (scores && scores.length > 0) {
      const count = scores.length;
      pillarSummary = {
        serving_life_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_s || 0), 0) / count / 10) * 100) / 100,
        transparent_truth_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_t || 0), 0) / count / 10) * 100) / 100,
        healing_love_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_h || 0), 0) / count / 10) * 100) / 100,
        long_term_value_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_c || 0), 0) / count / 10) * 100) / 100,
        unity_over_separation_avg: Math.round((scores.reduce((s, r) => s + (r.pillar_u || 0), 0) / count / 10) * 100) / 100,
      };
    }

    const totalFunMinted = (mintData || []).reduce((sum, r) => sum + (r.user_amount || 0), 0);

    // Trust level: prefer trust_profile.tc, fallback to legacy heuristic
    const trustLevel = trust?.tc
      ? Number(trust.tc)
      : Math.min(10, (loginData?.streak_count || 0) * 0.1 + (recentActions || 0) * 0.05 + (scores?.length || 0) * 0.02);

    return new Response(JSON.stringify({
      level: ledger?.level ? `Light ${level}` : 'Light Seed',
      trend: ledger?.trend || 'stable',
      consistency_streak: loginData?.streak_count || 0,
      sequence_active: activeSequences || 0,
      user_id: userId,
      trust_level: Math.round(trustLevel * 100) / 100,
      total_light_score: ledger?.final_light_score || 0,
      total_fun_minted: Math.round(totalFunMinted * 100) / 100,
      streak_days: loginData?.streak_count || 0,
      recent_actions: recentActions || 0,
      pillar_summary: pillarSummary,
      trust_profile: trust ? {
        tc: Number(trust.tc),
        tier: trust.trust_tier,
        sybil_risk: trust.sybil_risk,
        breakdown: { vs: trust.vs, bs: trust.bs, ss: trust.ss, os: trust.os, hs: trust.hs },
      } : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[LightProfile] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
