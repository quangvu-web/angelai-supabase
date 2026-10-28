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
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const REJECT_REASON = "Vi phạm hệ thống Angel AI về tính minh bạch trong hoạt động ánh sáng";

    // 1. Get all pending mint requests
    const { data: pendingRequests, error: fetchErr } = await adminClient
      .from('pplp_mint_requests')
      .select('id, actor_id, amount')
      .eq('status', 'pending');

    if (fetchErr) throw fetchErr;
    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        rejected_count: 0,
        flagged_count: 0,
        rejected_users: [],
        flagged_users: [],
        message: 'Không có yêu cầu pending nào',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const actorIds = [...new Set(pendingRequests.map(r => r.actor_id))];

    // 2. Get banned users (active suspensions)
    const { data: suspensions } = await adminClient
      .from('user_suspensions')
      .select('user_id')
      .in('user_id', actorIds)
      .is('lifted_at', null);

    const bannedUserIds = new Set((suspensions || []).map(s => s.user_id));

    // 3. Get suspicious users (unresolved fraud signals severity >= 3)
    const { data: fraudSignals } = await adminClient
      .from('pplp_fraud_signals')
      .select('actor_id, severity')
      .in('actor_id', actorIds)
      .eq('is_resolved', false)
      .gte('severity', 3);

    const suspiciousUserIds = new Set(
      (fraudSignals || [])
        .map(f => f.actor_id)
        .filter(id => !bannedUserIds.has(id)) // exclude already banned
    );

    // 4. Reject all pending requests from banned users
    const bannedRequestIds = pendingRequests
      .filter(r => bannedUserIds.has(r.actor_id))
      .map(r => r.id);

    let rejectedCount = 0;
    if (bannedRequestIds.length > 0) {
      // Batch update in chunks of 200
      for (let i = 0; i < bannedRequestIds.length; i += 200) {
        const chunk = bannedRequestIds.slice(i, i + 200);
        const { error: rejectErr } = await adminClient
          .from('pplp_mint_requests')
          .update({
            status: 'rejected',
            updated_at: new Date().toISOString(),
          })
          .in('id', chunk);

        if (!rejectErr) rejectedCount += chunk.length;
        else console.error('Reject batch error:', rejectErr);
      }
    }

    // 5. Flag suspicious users' requests (keep pending but record in fraud_alerts)
    const suspiciousRequestIds = pendingRequests
      .filter(r => suspiciousUserIds.has(r.actor_id))
      .map(r => r.id);

    let flaggedCount = 0;
    if (suspiciousRequestIds.length > 0) {
      // Insert fraud alerts for admin review
      const alerts = [...suspiciousUserIds].map(userId => ({
        user_id: userId,
        alert_type: 'mint_fraud_flag',
        severity: 'high',
        details: {
          reason: 'Yêu cầu mint từ tài khoản có tín hiệu gian lận chưa xử lý (severity >= 3)',
          pending_request_ids: pendingRequests.filter(r => r.actor_id === userId).map(r => r.id),
          flagged_by: 'cleanup-banned-mint-requests',
          flagged_at: new Date().toISOString(),
        },
      }));

      await adminClient.from('fraud_alerts').insert(alerts);
      flaggedCount = suspiciousRequestIds.length;
    }

    const rejectedUsers = [...bannedUserIds];
    const flaggedUsers = [...suspiciousUserIds];

    console.log(`[Cleanup Mint] Rejected: ${rejectedCount} requests from ${rejectedUsers.length} banned users. Flagged: ${flaggedCount} requests from ${flaggedUsers.length} suspicious users.`);

    return new Response(JSON.stringify({
      success: true,
      rejected_count: rejectedCount,
      flagged_count: flaggedCount,
      rejected_users: rejectedUsers,
      flagged_users: flaggedUsers,
      reject_reason: REJECT_REASON,
      message: `Đã từ chối ${rejectedCount} yêu cầu từ ${rejectedUsers.length} tài khoản bị ban. Gắn cờ ${flaggedCount} yêu cầu từ ${flaggedUsers.length} tài khoản nghi gian lận.`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
