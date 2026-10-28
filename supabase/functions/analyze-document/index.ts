// analyze-document — Angel đọc & tóm tắt nội dung file tài liệu
// Hỗ trợ: PDF (qua Gemini multimodal), text/markdown/csv/json/code, docx/xlsx (text đã extract từ client)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const CF_API_TOKEN = Deno.env.get("CF_API_TOKEN");
const CF_GATEWAY_URL = "https://gateway.ai.cloudflare.com/v1/6083e34ad429331916b93ba8a5ede81d/angel-ai/compat/chat/completions";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_TEXT_CHARS = 25_000; // ↓ tăng tốc: cắt sớm hơn để model trả lời nhanh

interface Body {
  fileBase64?: string;
  mimeType: string;
  fileName: string;
  textContent?: string; // nếu client đã extract sẵn (docx/xlsx/pptx)
  question?: string;
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TEXT_LIKE = /^(text\/|application\/(json|xml|x-yaml|x-toml|javascript|typescript|x-sh))/i;

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const { fileBase64, mimeType, fileName, textContent, question } = body;
  if (!mimeType || !fileName) return json({ error: "mimeType & fileName required" }, 400);

  const prompt =
    question?.trim() ||
    `Hãy đọc tài liệu "${fileName}" và tóm tắt ngắn gọn (≤ 250 từ): chủ đề chính, các điểm quan trọng, kết luận. Trả lời tiếng Việt.`;

  // Build user content
  let userContent: unknown;

  if (textContent && textContent.trim()) {
    const truncated = textContent.length > MAX_TEXT_CHARS
      ? textContent.slice(0, MAX_TEXT_CHARS) + "\n…[đã cắt bớt]"
      : textContent;
    userContent = `${prompt}\n\n=== NỘI DUNG FILE "${fileName}" (${mimeType}) ===\n${truncated}`;
  } else if (fileBase64) {
    const bytes = base64ToBytes(fileBase64);
    if (bytes.byteLength > MAX_BYTES) return json({ error: "file_too_large", maxBytes: MAX_BYTES }, 400);

    if (TEXT_LIKE.test(mimeType)) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) + "\n…[đã cắt bớt]" : text;
      userContent = `${prompt}\n\n=== NỘI DUNG FILE "${fileName}" (${mimeType}) ===\n${truncated}`;
    } else if (mimeType === "application/pdf") {
      // Gemini hỗ trợ PDF qua image_url data URL (OpenRouter multimodal)
      const dataUrl = `data:application/pdf;base64,${fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64}`;
      userContent = [
        { type: "text", text: prompt },
        { type: "file", file: { filename: fileName, file_data: dataUrl } },
      ];
    } else {
      return json({
        error: "unsupported_mime",
        message: `Định dạng ${mimeType} chưa hỗ trợ phía server. Trình duyệt nên extract sang text rồi gửi qua trường textContent.`,
      }, 415);
    }
  } else {
    return json({ error: "fileBase64 or textContent required" }, 400);
  }

  const useCf = !!CF_API_TOKEN;
  const url = useCf ? CF_GATEWAY_URL : LOVABLE_GATEWAY_URL;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers["Authorization"] = `Bearer ${useCf ? CF_API_TOKEN : LOVABLE_API_KEY}`;
  // ↓ Dùng flash-lite cho tốc độ (nhanh hơn ~2-3× cho text tóm tắt)
  const model = useCf ? "google-ai-studio/gemini-2.5-flash-lite" : "google/gemini-2.5-flash-lite";

  try {
    let resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Angel A.I. đọc tài liệu giúp đội Camly. Trả lời ngắn gọn, tiếng Việt, bám sát nội dung file, không bịa.",
          },
          { role: "user", content: userContent },
        ],
        max_tokens: 700,
      }),
    });

    if (!resp.ok && useCf && LOVABLE_API_KEY) {
      // fallback Lovable Gateway
      resp = await fetch(LOVABLE_GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: "Angel A.I. đọc tài liệu giúp đội Camly. Trả lời ngắn gọn, tiếng Việt.",
            },
            { role: "user", content: userContent },
          ],
          max_tokens: 700,
        }),
      });
    }

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[analyze-document] upstream", resp.status, errText.slice(0, 300));
      return json({ error: "upstream_error", status: resp.status }, 502);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    return json({ content, model });
  } catch (e) {
    console.error("[analyze-document] exception", e);
    return json({ error: "exception", detail: String(e) }, 500);
  }
});
