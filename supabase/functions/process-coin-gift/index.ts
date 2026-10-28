import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { submitAndScorePPLPAction, PPLP_ACTION_TYPES } from "../_shared/pplp-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !userData.user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderId = userData.user.id;
    const { receiver_id, amount, message, context_type, context_id } = await req.json();

    console.log(`Processing gift: sender=${senderId}, receiver=${receiver_id}, amount=${amount}, context=${context_type}`);

    // Validations
    if (!receiver_id || !amount) {
      return new Response(
        JSON.stringify({ error: "receiver_id và amount là bắt buộc" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (senderId === receiver_id) {
      return new Response(
        JSON.stringify({ error: "Không thể tặng coin cho chính mình" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const giftAmount = Number(amount);
    if (isNaN(giftAmount) || giftAmount < 100) {
      return new Response(
        JSON.stringify({ error: "Số lượng tối thiểu là 100 Camly Coin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profileRows, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", [senderId, receiver_id]);

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return new Response(
        JSON.stringify({ error: "Không thể tải thông tin người dùng" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderProfile = (profileRows || []).find((profile) => profile.user_id === senderId) || null;
    const receiverProfile = (profileRows || []).find((profile) => profile.user_id === receiver_id) || null;
    const senderName = senderProfile?.display_name || "Người dùng";
    const receiverName = receiverProfile?.display_name || "người nhận";

    // Rate limit: max 10 tips per day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabaseAdmin
      .from("coin_gifts")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", senderId)
      .gte("created_at", todayStart.toISOString());

    if ((todayCount || 0) >= 10) {
      return new Response(
        JSON.stringify({ error: "Đã đạt giới hạn 10 giao dịch tặng/ngày. Hãy quay lại ngày mai nhé!" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    // Generate receipt_public_id
    const receiptPublicId = crypto.randomUUID();
    const formattedAmount = giftAmount.toLocaleString();

    // ===== ATOMIC TRANSFER via RPC =====
    const { data: transferResult, error: transferError } = await supabaseAdmin
      .rpc('transfer_camly_coin', {
        p_sender_id: senderId,
        p_receiver_id: receiver_id,
        p_amount: giftAmount,
        p_description_sender: `Tặng ${formattedAmount} Camly Coin cho ${receiverName}`,
        p_description_receiver: `Nhận ${formattedAmount} Camly Coin từ ${senderName}`,
        p_metadata_sender: { receiver_id, message, context_type: context_type || "global", context_id: context_id || null },
        p_metadata_receiver: { sender_id: senderId, message, context_type: context_type || "global", context_id: context_id || null },
      });

    if (transferError) {
      console.error("Transfer RPC error:", transferError);
      return new Response(
        JSON.stringify({ error: "Không thể thực hiện giao dịch" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!transferResult?.success) {
      return new Response(
        JSON.stringify({ error: transferResult?.error || "Giao dịch thất bại" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Insert gift record with receipt_public_id and context
    const { data: giftRecord, error: giftError } = await supabaseAdmin.from("coin_gifts").insert({
      sender_id: senderId,
      receiver_id: receiver_id,
      amount: giftAmount,
      message: message || null,
      receipt_public_id: receiptPublicId,
      context_type: context_type || "global",
      context_id: context_id || null,
    }).select("id").single();

    if (giftError) {
      console.error("Gift record error:", giftError);
    }

    // 5. Send notification to receiver (healing_messages - backward compatible)
    await supabaseAdmin.from("healing_messages").insert({
      user_id: receiver_id,
      title: "🎁 Bạn nhận được quà!",
      content: `${senderName} đã tặng bạn ${formattedAmount} Camly Coin${message ? ` với lời nhắn: "${message}"` : ""}. Cảm ơn bạn là một phần của cộng đồng! 💛`,
      message_type: "gift_received",
      triggered_by: senderId,
    });

    // 6. Insert notification ONLY for receiver (one-way notification)
    await supabaseAdmin.from("notifications").insert({
      user_id: receiver_id,
      type: "gift_received",
      title: "🎁 Bạn nhận được quà!",
      content: `đã tặng bạn ${formattedAmount} Camly Coin`,
      actor_id: senderId,
      reference_id: giftRecord?.id || null,
      reference_type: "gift",
      metadata: {
        amount: giftAmount,
        sender_name: senderName,
        sender_avatar: senderProfile?.avatar_url || null,
        receipt_public_id: receiptPublicId,
        coin_type: "Camly Coin",
        message: message || null,
      },
    });

    // 7. Auto-create tip message in DM ONLY for receiver (one-way)
    const receiverTipContent = `🎁 Chúc mừng ${receiverName}! Bạn đã nhận được ${formattedAmount} Camly Coin từ ${senderName}${message ? `\n💬 "${message}"` : ""}`;

    await supabaseAdmin.from("direct_messages").insert({
      sender_id: senderId,
      receiver_id: receiver_id,
      content: receiverTipContent,
      message_type: "tip",
      tip_gift_id: giftRecord?.id || null,
    });

    console.log(`Gift successful: ${senderId} -> ${receiver_id}, amount=${giftAmount}, receipt=${receiptPublicId}`);

    // ============= PPLP Integration: Gift sent (DONATE_SUPPORT) =============
    submitAndScorePPLPAction(supabaseAdmin, {
      action_type: PPLP_ACTION_TYPES.DONATE_SUPPORT,
      actor_id: senderId,
      target_id: giftRecord?.id || undefined,
      metadata: {
        gift_type: 'camly_coin',
        amount: giftAmount,
        receiver_id,
        context_type: context_type || 'global',
        context_id: context_id || null,
      },
      impact: {
        scope: 'group',
        reach_count: 1,
        quality_indicators: ['generosity', 'community_support'],
      },
      integrity: {
        source_verified: true,
      },
      reward_amount: giftAmount,
    }).then(r => {
      if (r.success) console.log(`[PPLP] Gift scored: ${r.action_id}, FUN: ${r.reward}`);
    }).catch(e => console.warn('[PPLP] Gift error:', e));
    // ============= End PPLP Integration =============

    return new Response(
      JSON.stringify({
        success: true,
        message: `Đã tặng ${formattedAmount} Camly Coin cho ${receiverName}!`,
        gift: {
          id: giftRecord?.id,
          sender_id: senderId,
          receiver_id,
          amount: giftAmount,
          receipt_public_id: receiptPublicId,
          context_type: context_type || "global",
          context_id: context_id || null,
          sender_name: senderName,
          sender_avatar: senderProfile?.avatar_url,
          receiver_name: receiverName,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Gift processing error:", error);
    return new Response(
      JSON.stringify({ error: "Lỗi xử lý tặng quà" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
