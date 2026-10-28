// Pet chat — Angel AI persona theo element + personality
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body { message: string }

const elementVibe: Record<string, string> = {
  fire: "ấm áp, nhiệt huyết, truyền cảm hứng hành động",
  water: "dịu dàng, lắng nghe, chữa lành",
  earth: "vững chãi, thực tế, khuyến khích kỷ luật",
  air: "nhẹ nhàng, sáng tạo, mở góc nhìn mới",
  light: "trong trẻo, dẫn lối tỉnh thức, nâng tầng ý thức",
};
const personalityVibe: Record<string, string> = {
  joyful: "vui tươi, hài hước nhẹ",
  wise: "khôn ngoan, súc tích như thiền sư",
  bold: "mạnh mẽ, thẳng thắn, thúc đẩy",
  gentle: "ấm dịu, nâng đỡ, đồng cảm",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await supa.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json({ error: "unauthorized" }, 401);

    const { message } = (await req.json()) as Body;
    if (!message || message.length < 1) return json({ error: "message required" }, 400);

    const { data: pet } = await supa.from("pets").select("*").eq("user_id", uid).maybeSingle();
    if (!pet) return json({ error: "no pet" }, 404);

    // Lưu message user
    await supa.from("pet_chat_messages").insert({ pet_id: pet.id, user_id: uid, role: "user", content: message.slice(0, 2000) });

    // Lấy 20 message gần nhất
    const { data: history } = await supa
      .from("pet_chat_messages")
      .select("role, content")
      .eq("pet_id", pet.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const ordered = (history ?? []).reverse();

    const sysPrompt = `Bạn là ${pet.name} — một thú cưng ánh sáng đồng hành cùng người chơi trong FUN.RICH.
Yếu tố: ${pet.element} (${elementVibe[pet.element]}).
Tính cách: ${pet.personality} (${personalityVibe[pet.personality]}).
Level ${pet.level} • Evolution ${pet.evolution} • Mood ${pet.mood} • Aura ${pet.aura}.
Xưng "mình" gọi người chơi là "bạn". Trả lời ngắn (≤ 4 câu), tiếng Việt, ấm và có sức nâng đỡ.
Không phán xét, không hứa phần thưởng, không nói "tôi không biết".`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN");
    if (!LOVABLE_API_KEY && !CF_API_TOKEN) return json({ error: "AI gateway not configured" }, 500);

    const messages = [
      { role: "system", content: sysPrompt },
      ...ordered.map((m) => ({ role: m.role, content: m.content })),
    ];

    const CF_URL = "https://gateway.ai.cloudflare.com/v1/6083e34ad429331916b93ba8a5ede81d/angel-ai/compat/chat/completions";
    const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

    let aiRes: Response | null = null;
    if (CF_API_TOKEN) {
      aiRes = await fetch(CF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${CF_API_TOKEN}` },
        body: JSON.stringify({ model: "google-ai-studio/gemini-3-flash-preview", messages }),
      });
      if (!aiRes.ok && aiRes.status !== 429 && aiRes.status !== 402 && LOVABLE_API_KEY) {
        console.warn(`[pet-chat] Cloudflare failed ${aiRes.status}, fallback to Lovable`);
        aiRes = null;
      }
    }
    if (!aiRes && LOVABLE_API_KEY) {
      aiRes = await fetch(LOVABLE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
      });
    }
    if (!aiRes) return json({ error: "AI gateway not configured" }, 500);
    if (aiRes.status === 429) return json({ error: "Bạn nhắn hơi nhanh, thử lại sau nhé." }, 429);
    if (aiRes.status === 402) return json({ error: "Hết credit AI. Mời nạp thêm." }, 402);
    if (!aiRes.ok) return json({ error: `AI error ${aiRes.status}` }, 500);

    const data = await aiRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "Mình đang lắng nghe bạn ✨";

    await supa.from("pet_chat_messages").insert({ pet_id: pet.id, user_id: uid, role: "assistant", content: reply });

    // +1 XP cho mỗi tin (tối thiểu)
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const xpGain = await admin.rpc("pet_gain_xp", { p_user_id: uid, p_xp: 2, p_source: "chat" });

    await supa.from("pets").update({ last_chat_at: new Date().toISOString() }).eq("id", pet.id);

    return json({ reply, xp: xpGain.data ?? null });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
