import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/cost-guards.ts";
import { sha256Hex } from "../_shared/knowledge-dedup.ts";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED: Record<string, string[]> = {
  ".txt": ["text/plain"], ".md": ["text/markdown", "text/plain"],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function safeName(value: string): string | null {
  const base = value.normalize("NFC").replace(/[\\/\0\r\n]/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 180);
  return base && !base.startsWith(".") ? base : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error_code: "METHOD_NOT_ALLOWED" }, 405);
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  let body: { file_name?: string; mime_type?: string; file_base64?: string; title?: string; description?: string; folder_id?: string | null };
  try { body = await req.json(); } catch { return json({ error_code: "INVALID_JSON" }, 400); }
  const fileName = safeName(body.file_name ?? "");
  const ext = fileName ? `.${fileName.split(".").pop()?.toLowerCase()}` : "";
  const mime = (body.mime_type ?? "").toLowerCase();
  if (!fileName || !ALLOWED[ext]?.includes(mime)) return json({ error_code: "UNSUPPORTED_FILE_TYPE" }, 400);
  let bytes: Uint8Array;
  try {
    const binary = atob(body.file_base64 ?? "");
    if (!binary.length || binary.length > MAX_BYTES) return json({ error_code: "FILE_SIZE_INVALID" }, 400);
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch { return json({ error_code: "INVALID_FILE_ENCODING" }, 400); }

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const storagePath = `${auth.adminUserId}/${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await admin.storage.from("knowledge-documents").upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (uploadError) return json({ error_code: "STORAGE_UPLOAD_FAILED" }, 500);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).normalize("NFC"); }
  catch {
    await admin.storage.from("knowledge-documents").remove([storagePath]);
    return json({ error_code: "INVALID_UTF8" }, 400);
  }
  const contentHash = await sha256Hex(text);
  {
    const { data: duplicate } = await admin.from("knowledge_documents").select("id").eq("content_hash", contentHash).is("deleted_at", null).maybeSingle();
    if (duplicate) {
      await admin.storage.from("knowledge-documents").remove([storagePath]);
      return json({ error_code: "DUPLICATE_CONTENT", existing_document_id: duplicate.id }, 409);
    }
  }
  const { data, error } = await admin.from("knowledge_documents").insert({
    title: String(body.title || fileName.replace(/\.[^.]+$/, "")).slice(0, 250), description: body.description?.slice(0, 1000) || null,
    file_name: fileName, file_url: storagePath, file_type: mime, file_size: bytes.length,
    extracted_content: text, content_hash: contentHash, is_processed: false, ingest_status: "pending",
    created_by: auth.adminUserId, folder_id: body.folder_id || null, metadata: { origin: "knowledge-admin-upload" },
  }).select("id").single();
  if (error) {
    await admin.storage.from("knowledge-documents").remove([storagePath]);
    return json({ error_code: "DOCUMENT_CREATE_FAILED" }, 500);
  }
  return json({ document_id: data.id, status: "pending" }, 201);
});
