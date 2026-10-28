// knowledge-extract-pdf — Trích văn bản đầy đủ từ PDF vào knowledge_documents.extracted_content
// để RAG ingest có thể embed. Dùng Gemini multimodal qua Lovable AI Gateway.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  logAiProviderUsage,
  requireAdminOrServiceRole,
  withCloudUsage,
} from "../_shared/cost-guards.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BYTES = 30 * 1024 * 1024; // 30MB — PDF lớn Gemini vẫn xử được

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function fetchPdfAsBase64(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error(`file too large: ${buf.byteLength}`);
  // base64 encode
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    s += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(s);
}

async function extractFullText(
  fileName: string,
  pdfB64: string,
  auth: { adminUserId: string | null; isServiceRole: boolean },
): Promise<string> {
  const dataUrl = `data:application/pdf;base64,${pdfB64}`;
  const resp = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You extract the FULL raw text from a PDF verbatim in reading order. Return only the raw text, no commentary, no markdown fences, no summary. Preserve paragraphs." },
        { role: "user", content: [
          { type: "text", text: `Extract the full text of "${fileName}". Return the entire document text.` },
          { type: "file", file: { filename: fileName, file_data: dataUrl } },
        ]},
      ],
      max_tokens: 32000,
    }),
  });
  if (!resp.ok) throw new Error(`upstream ${resp.status}: ${(await resp.text()).slice(0,200)}`);
  await logAiProviderUsage({
    functionName: "knowledge-extract-pdf",
    provider: "lovable",
    model: "google/gemini-2.5-flash",
    status: resp.status,
    userId: auth.adminUserId,
    estimatedInputTokens: Math.ceil(pdfB64.length / 4),
    metadata: { fileName, service_role: auth.isServiceRole },
  });
  const j = await resp.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

Deno.serve(withCloudUsage("knowledge-extract-pdf", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const auth = await requireAdminOrServiceRole(req);
  if (auth instanceof Response) return auth;
  const limit = Math.min(body.limit ?? 5, 15);
  const documentId: string | undefined = body.document_id;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let q = supabase.from("knowledge_documents")
    .select("id, title, file_url, file_name")
    .eq("ingest_status", "pending")
    .or("extracted_content.is.null,extracted_content.eq.")
    .not("file_url", "is", null)
    .limit(limit);
  if (documentId) q = supabase.from("knowledge_documents").select("id,title,file_url,file_name").eq("id", documentId).limit(1);

  const { data: docs, error } = await q;
  if (error) return json({ error: error.message }, 500);
  if (!docs?.length) return json({ processed: 0, message: "no pending docs" });

  const results: any[] = [];
  for (const doc of docs) {
    try {
      if (!doc.file_url) throw new Error("no file_url");
      const b64 = await fetchPdfAsBase64(doc.file_url);
      const text = await extractFullText(doc.file_name || doc.title, b64, auth);
      if (!text || text.length < 50) throw new Error(`extracted empty (${text.length})`);
      await supabase.from("knowledge_documents").update({
        extracted_content: text,
        ingest_status: "pending",
        ingest_error: null,
      }).eq("id", doc.id);
      results.push({ id: doc.id, title: doc.title, len: text.length, ok: true });
    } catch (e) {
      const msg = String(e).slice(0, 300);
      await supabase.from("knowledge_documents").update({
        ingest_status: "failed",
        ingest_error: `extract-pdf: ${msg}`,
      }).eq("id", doc.id);
      results.push({ id: doc.id, title: doc.title, ok: false, error: msg });
    }
  }

  return json({ processed: results.length, results });
}));
