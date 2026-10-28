import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Recipient {
  user_id: string;
  fun_amount: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Không có quyền truy cập" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client cho xác thực
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Client service role cho thao tác database
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !userData.user) {
      console.error("Lỗi xác thực:", authError);
      return new Response(
        JSON.stringify({ error: "Không có quyền truy cập" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminId = userData.user.id;

    // Kiểm tra quyền admin
    const { data: roleData, error: roleError } = await supabaseAuth
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Không phải admin:", adminId);
      return new Response(
        JSON.stringify({ error: "Chỉ dành cho quản trị viên" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recipients } = await req.json() as { recipients: Recipient[] };

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Danh sách người nhận không hợp lệ" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Lì xì] Admin ${adminId} bắt đầu chuyển thưởng cho ${recipients.length} người dùng`);

    const batchDate = new Date().toISOString().slice(0, 10);
    const MULTIPLIER = 1000;

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let totalCamlyDistributed = 0;
    const results: Array<{
      user_id: string;
      status: "success" | "skipped" | "failed";
      camly_amount?: number;
      reason?: string;
    }> = [];

    for (const recipient of recipients) {
      const { user_id, fun_amount } = recipient;

      if (!user_id || !fun_amount || fun_amount <= 0) {
        results.push({ user_id, status: "failed", reason: "Dữ liệu không hợp lệ" });
        failedCount++;
        continue;
      }

      try {
        // Kiểm tra đã thưởng trước đó chưa (dùng source_ref unique index)
        const sourceRef = `fun_to_camly_reward_${user_id}_${batchDate}`;
        const { data: existingTx, error: checkError } = await supabaseAdmin
          .from("camly_coin_transactions")
          .select("id")
          .eq("source_ref", sourceRef)
          .maybeSingle();

        if (checkError) {
          console.error(`[Lì xì] Lỗi kiểm tra trùng lặp cho ${user_id}:`, checkError);
          results.push({ user_id, status: "failed", reason: "Lỗi kiểm tra trùng lặp" });
          failedCount++;
          continue;
        }

        if (existingTx) {
          console.log(`[Lì xì] Bỏ qua ${user_id} - đã được thưởng trước đó`);
          results.push({ user_id, status: "skipped", reason: "Đã được thưởng trước đó" });
          skippedCount++;
          continue;
        }

        const camlyAmount = fun_amount * MULTIPLIER;

        // Cập nhật số dư Camly Coin (upsert)
        const { data: balanceData } = await supabaseAdmin
          .from("camly_coin_balances")
          .select("balance, lifetime_earned")
          .eq("user_id", user_id)
          .maybeSingle();

        if (balanceData) {
          const { error: updateError } = await supabaseAdmin
            .from("camly_coin_balances")
            .update({
              balance: balanceData.balance + camlyAmount,
              lifetime_earned: balanceData.lifetime_earned + camlyAmount,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user_id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabaseAdmin
            .from("camly_coin_balances")
            .insert({
              user_id,
              balance: camlyAmount,
              lifetime_earned: camlyAmount,
            });

          if (insertError) throw insertError;
        }

        // Ghi giao dịch with source_ref for duplicate prevention
        const { data: txData, error: txError } = await supabaseAdmin
          .from("camly_coin_transactions")
          .insert({
            user_id,
            amount: camlyAmount,
            transaction_type: "admin_adjustment",
            description: `Lì xì Tết: ${fun_amount.toLocaleString("vi-VN")} FUN × 1.000 = ${camlyAmount.toLocaleString("vi-VN")} Camly Coin`,
            source_ref: sourceRef,
            metadata: {
              source: "fun_to_camly_reward",
              fun_amount,
              multiplier: MULTIPLIER,
              batch_date: batchDate,
              distributed_by: adminId,
            },
          })
          .select("id")
          .single();

        if (txError) throw txError;

        const txId = txData?.id || null;

        // Lấy tên người dùng để gửi thông báo
        const { data: profileData } = await supabaseAdmin
          .from("profiles")
          .select("display_name")
          .eq("user_id", user_id)
          .maybeSingle();

        const displayName = profileData?.display_name || "bạn";

        // Gửi thông báo healing_messages
        await supabaseAdmin.from("healing_messages").insert({
          user_id,
          title: "🧧 Chúc mừng! Bạn được Lì xì Camly Coin!",
          content: `Chúc mừng ${displayName}! 🎉\n\nBạn vừa nhận được Lì xì:\n\n💰 ${camlyAmount.toLocaleString("vi-VN")} Camly Coin\n📊 Dựa trên ${fun_amount.toLocaleString("vi-VN")} FUN Money đã tích lũy\n\n🧧 Chương trình Lì xì Tết 26.000.000.000 VND bằng Fun Money và Camly Coin\n⏰ Áp dụng đến ngày 08/02/2026\n\nCảm ơn bạn đã đồng hành cùng Angel AI! 💛`,
          message_type: "reward",
          triggered_by: "fun_to_camly_reward",
        });

        // Gửi notification cho popup chúc mừng Lì xì
        const TREASURY_USER_ID = "9aa48f46-a2f6-45e8-889d-83e2d3cbe3ad";
        const { data: notifData, error: notifError } = await supabaseAdmin.from("notifications").insert({
          user_id,
          type: "tet_lixi_reward",
          title: "Chúc mừng bạn đã nhận được Lì xì!",
          content: `Bạn nhận được ${camlyAmount.toLocaleString("vi-VN")} Camly Coin, được quy đổi dựa trên ${fun_amount.toLocaleString("vi-VN")} FUN Money.`,
          actor_id: TREASURY_USER_ID,
          metadata: {
            camly_amount: camlyAmount,
            fun_amount: fun_amount,
            source: "fun_to_camly_reward",
            batch_date: batchDate,
          },
        }).select("id").single();

        // Gửi DM tự động từ ANGEL AI TREASURY
        const notifId = notifData?.id || null;

        await supabaseAdmin.from("direct_messages").insert({
          sender_id: TREASURY_USER_ID,
          receiver_id: user_id,
          content: `🧧 Angel AI Treasury đã gửi đến bạn thông báo về Lì Xì Tết!\n\n💰 ${camlyAmount.toLocaleString("vi-VN")} Camly Coin\n📊 Dựa trên ${fun_amount.toLocaleString("vi-VN")} FUN Money\n\n⏰ Áp dụng đến 08/02/2026`,
          message_type: "tet_lixi",
          metadata: {
            notification_id: notifId,
            camly_amount: camlyAmount,
            fun_amount: fun_amount,
            source: "tet_lixi_reward",
          },
        });

        successCount++;
        totalCamlyDistributed += camlyAmount;
        results.push({ user_id, status: "success", camly_amount: camlyAmount });

        console.log(`[Lì xì] ✅ ${displayName} (${user_id}): ${fun_amount} FUN → ${camlyAmount.toLocaleString()} Camly`);
      } catch (err) {
        console.error(`[Lì xì] ❌ Lỗi xử lý ${user_id}:`, err);
        results.push({ user_id, status: "failed", reason: String(err) });
        failedCount++;
      }
    }

    console.log(`[Lì xì] Hoàn tất: ${successCount} thành công, ${skippedCount} bỏ qua, ${failedCount} thất bại, tổng ${totalCamlyDistributed.toLocaleString()} Camly`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_recipients: recipients.length,
          success_count: successCount,
          skipped_count: skippedCount,
          failed_count: failedCount,
          total_camly_distributed: totalCamlyDistributed,
          batch_date: batchDate,
        },
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Lì xì] Lỗi xử lý:", error);
    return new Response(
      JSON.stringify({ error: "Lỗi xử lý chuyển thưởng Lì xì" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
