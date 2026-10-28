import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const body = await req.json();
    const requestUserId = body.user_id;
    const mintDestination: string = body.mint_destination || 'angel_ai'; // 'angel_ai' | 'fun_profile'

    // Verify user matches
    if (requestUserId && requestUserId !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. STRICT DEDUP: Block if ANY active mint request exists for this user
    const { data: existingRequests, error: existingError } = await supabaseAdmin
      .from("pplp_mint_requests")
      .select("id, status, amount, created_at")
      .eq("actor_id", userId)
      .in("status", ["pending_sig", "signing", "signed", "pending"])
      .limit(1);

    if (existingRequests && existingRequests.length > 0) {
      const activeRequest = existingRequests[0];
      console.log(`[pplp-claim-fun] BLOCKED duplicate claim for user ${userId}, existing request: ${activeRequest.id}`);
      return new Response(JSON.stringify({
        status: "already_claimed",
        mint_request_id: activeRequest.id,
        amount: activeRequest.amount,
        message: "Yêu cầu claim đã được tạo trước đó, đang chờ GOV Attesters ký duyệt."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Find eligible allocations - ONLY from pplp_mint_allocations with status='pending'
    const { data: pplpAllocData } = await supabaseAdmin
      .from("pplp_mint_allocations")
      .select("id, fun_allocated, cycle_id, eligible, status")
      .eq("user_id", userId)
      .eq("eligible", true)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const pplpAllocs = pplpAllocData || [];

    if (pplpAllocs.length === 0) {
      // Check if user has minted requests already
      const { count: mintedCount } = await supabaseAdmin
        .from("pplp_mint_requests")
        .select("*", { count: "exact", head: true })
        .eq("actor_id", userId)
        .eq("status", "minted");

      if ((mintedCount || 0) > 0) {
        return new Response(JSON.stringify({
          status: "already_claimed",
          message: "Bạn đã claim và mint FUN thành công rồi. Vui lòng chờ chu kỳ tiếp theo."
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "no_allocation", error: "Không có phân bổ FUN nào đủ điều kiện claim." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get user wallet address (required for angel_ai, optional for fun_profile)
    const { data: walletData } = await supabaseAdmin
      .from("user_wallet_addresses")
      .select("wallet_address")
      .eq("user_id", userId)
      .maybeSingle();

    const walletAddress = walletData?.wallet_address;

    if (mintDestination === 'angel_ai') {
      if (!walletAddress || walletAddress === '0x0000000000000000000000000000000000000000') {
        return new Response(JSON.stringify({ error: "Vui lòng kết nối ví MetaMask trước khi claim FUN." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return new Response(JSON.stringify({ error: "Địa chỉ ví không hợp lệ." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // For fun_profile: check FUN ID link exists
    if (mintDestination === 'fun_profile') {
      const { data: linkData } = await supabaseAdmin
        .from('fun_id_links')
        .select('fun_profile_user_id')
        .eq('angel_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (!linkData?.fun_profile_user_id) {
        return new Response(JSON.stringify({ 
          error: "Bạn chưa liên kết FUN Profile. Vui lòng liên kết FUN ID trước khi chọn mint qua FUN Profile." 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Calculate amount ONLY from pplp_mint_allocations (single source of truth)
    const totalAmount = pplpAllocs.reduce((sum: number, a: any) => sum + (a.fun_allocated || 0), 0);

    if (totalAmount <= 0) {
      return new Response(JSON.stringify({ status: "no_allocation", error: "Số FUN phân bổ = 0." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Mark allocations as claimed FIRST (prevent race condition)
    const pplpAllocIds = pplpAllocs.map((a: any) => a.id);
    if (pplpAllocIds.length > 0) {
      await supabaseAdmin
        .from("pplp_mint_allocations")
        .update({ status: "claimed" })
        .in("id", pplpAllocIds);
    }

    // 5. Create pplp_action record (foreign key requirement)
    const actionId = crypto.randomUUID();
    const actionLabel = `epoch_claim_${userId}_${Date.now()}`;
    const actionHash = await computeHash(actionLabel);
    const evidenceHash = await computeHash(JSON.stringify({ pplpAllocIds, totalAmount, userId }));

    const { error: actionError } = await supabaseAdmin
      .from("pplp_actions")
      .insert({
        id: actionId,
        platform_id: "angel_ai",
        action_type: "epoch_claim",
        action_type_enum: "STAKE_LOCK",
        actor_id: userId,
        metadata: { totalAmount, allocationIds: pplpAllocIds.slice(0, 10), type: "epoch_claim", mint_destination: mintDestination },
        status: "scored",
        evidence_hash: evidenceHash,
      });

    if (actionError) {
      // Rollback allocation status
      if (pplpAllocIds.length > 0) {
        await supabaseAdmin
          .from("pplp_mint_allocations")
          .update({ status: "pending" })
          .in("id", pplpAllocIds);
      }
      console.error("Error creating pplp_action:", actionError);
      return new Response(JSON.stringify({ error: "Không thể tạo action. " + actionError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user nonce
    const { data: nonceData } = await supabaseAdmin
      .from("pplp_mint_requests")
      .select("nonce")
      .eq("actor_id", userId)
      .order("nonce", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNonce = (nonceData?.nonce || 0) + 1;

    const now = new Date();
    const validBefore = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Build destination-specific note
    const destinationNote = mintDestination === 'fun_profile'
      ? `🌐 User chọn mint qua FUN Profile. Điểm sẽ được sync sang FUN Profile và gộp vào epoch tiếp theo. Không mint on-chain trên Angel AI.`
      : `⚡ User chọn mint trực tiếp trên Angel AI. Chờ GOV Attesters ký duyệt 3/3 multisig.`;

    // Determine initial status based on destination
    const initialStatus = mintDestination === 'fun_profile' ? 'pending' : 'pending_sig';

    const { data: mintRequest, error: insertError } = await supabaseAdmin
      .from("pplp_mint_requests")
      .insert({
        action_id: actionId,
        action_hash: actionHash,
        actor_id: userId,
        recipient_address: walletAddress || '0x0000000000000000000000000000000000000000',
        amount: totalAmount,
        amount_wei: BigInt(Math.round(totalAmount * 1e18)).toString(),
        evidence_hash: evidenceHash,
        nonce: nextNonce,
        status: initialStatus,
        policy_version: 1,
        platform_id: "angel_ai",
        valid_after: now.toISOString(),
        valid_before: validBefore.toISOString(),
        multisig_required_groups: mintDestination === 'angel_ai' ? ["will", "wisdom", "love"] : [],
        multisig_completed_groups: [],
        multisig_signatures: {},
        mint_destination: mintDestination,
        destination_note: destinationNote,
        fun_profile_sync_status: mintDestination === 'fun_profile' ? 'pending' : null,
      })
      .select("id, amount, status")
      .single();

    if (insertError) {
      // Rollback allocation status
      if (pplpAllocIds.length > 0) {
        await supabaseAdmin
          .from("pplp_mint_allocations")
          .update({ status: "pending" })
          .in("id", pplpAllocIds);
      }
      console.error("Error creating mint request:", insertError);
      return new Response(JSON.stringify({ error: "Không thể tạo yêu cầu mint. " + insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If fun_profile destination, trigger sync immediately
    if (mintDestination === 'fun_profile') {
      try {
        // Mark actions as ready for sync
        await supabaseAdmin
          .from("pplp_actions")
          .update({ synced_to_fun_rich: false })
          .eq("actor_id", userId)
          .eq("status", "scored")
          .eq("synced_to_fun_rich", false);

        // Call sync function with batch mode + source_request_id for callback tracking
        const syncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/sync-to-fun-rich`;
        const syncRes = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
          body: JSON.stringify({
            source_request_id: mintRequest.id,
            for_mint: true,
          }),
        });
        const syncResult = await syncRes.json();

        // sync-to-fun-rich now handles updating fun_profile_sync_status via source_request_id callback
        console.log(`[pplp-claim-fun] FUN Profile batch sync triggered for user ${userId}: synced=${syncResult?.synced || 0}, duplicates=${syncResult?.duplicates || 0}, failed=${syncResult?.failed || 0}, light_score=${syncResult?.total_light_score || 0}`);
      } catch (syncErr) {
        console.warn(`[pplp-claim-fun] FUN Profile sync failed (non-fatal):`, syncErr);
        await supabaseAdmin
          .from("pplp_mint_requests")
          .update({ fun_profile_sync_status: 'failed' })
          .eq("id", mintRequest.id);
      }
    }

    console.log(`[pplp-claim-fun] Created mint request ${mintRequest.id} for user ${userId}, amount: ${totalAmount} FUN, destination: ${mintDestination}`);

    const message = mintDestination === 'fun_profile'
      ? `✅ Đã gửi ${totalAmount.toLocaleString()} FUN sang FUN Profile. Điểm sẽ được gộp vào epoch tiếp theo để mint on-chain.`
      : `Yêu cầu claim ${totalAmount.toLocaleString()} FUN đã được tạo. Đang chờ GOV Attesters ký duyệt (0/3).`;

    return new Response(JSON.stringify({
      status: mintDestination === 'fun_profile' ? 'synced_to_fun_profile' : 'queued',
      mint_request_id: mintRequest.id,
      amount: totalAmount,
      mint_destination: mintDestination,
      message,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[pplp-claim-fun] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function computeHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
