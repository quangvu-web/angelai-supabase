// knowledge-query-rewrite — Sinh 2-3 query variants + extract intent/date/entity
// Input: { question: string }
// Output: { variants: string[], date_iso?: string, entities: string[], intent: "find_link"|"find_content"|"summarize"|"other" }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { aiChat } from "../_shared/ai-gateway.ts";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { question?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const question = (body.question || "").toString().trim();
  if (question.length < 4) return json({ variants: [question], entities: [], intent: "other" });

  const sys = `Bạn là bộ tối ưu truy vấn cho hệ thống tìm kiếm tài liệu bài dẫn thiền của Camly Duong.
Hãy phân tích câu hỏi user và trả về JSON THUẦN (không markdown) với schema:
{
  "variants": [chuỗi], // 2-3 truy vấn viết lại tiếng Việt, đa dạng: 1 giữ nguyên tên bài, 1 không dấu, 1 dạng ngắn gọn keywords
  "date_iso": "YYYY-MM-DD" | null, // nếu câu hỏi nhắc ngày, chuẩn hoá ISO
  "entities": [chuỗi], // tên riêng: tên bài thiền, tên các Ngài, tên thần chú
  "intent": "find_link" | "find_content" | "summarize" | "other"
}
Ví dụ: "tìm bài dẫn thiền Đắm chìm trong ánh sáng và tình yêu thương của Cha Vũ Trụ 04Mar2024" →
{"variants":["Đắm chìm trong ánh sáng và tình yêu thương của Cha Vũ Trụ 04/03/2024","Dam chim trong anh sang tinh yeu thuong Cha Vu Tru","dẫn thiền Cha Vũ Trụ ánh sáng tình yêu"],"date_iso":"2024-03-04","entities":["Cha Vũ Trụ","Đắm chìm trong ánh sáng"],"intent":"find_link"}`;

  try {
    const result = await aiChat({
      messages: [
        { role: "system", content: sys },
        { role: "user", content: question },
      ],
      cfModel: "google-ai-studio/gemini-2.5-flash-lite",
      lovableModel: "google/gemini-2.5-flash-lite",
      maxTokens: 400,
    });
    if (!result.ok) {
      console.warn("[query-rewrite] gateway err", result.status, result.message);
      return json({ variants: [question], entities: [], intent: "other" });
    }
    const cleaned = result.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
    try {
      const parsed = JSON.parse(cleaned);
      return json({
        variants: Array.isArray(parsed.variants) && parsed.variants.length ? parsed.variants.slice(0, 4) : [question],
        date_iso: parsed.date_iso || null,
        entities: Array.isArray(parsed.entities) ? parsed.entities.slice(0, 6) : [],
        intent: parsed.intent || "other",
      });
    } catch {
      return json({ variants: [question], entities: [], intent: "other" });
    }

  } catch (e) {
    console.warn("[query-rewrite] exception", e);
    return json({ variants: [question], entities: [], intent: "other" });
  }
});
