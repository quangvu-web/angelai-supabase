// Shared helper: compute SHA-256 content hash + check duplicate knowledge_documents.
// Used by knowledge-ingest-url, knowledge-save-chat, telegram-webhook /learn.

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input.trim().normalize("NFC"));
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface DuplicateResult {
  duplicate: boolean;
  existing_id?: string;
  existing_title?: string;
  content_hash: string;
}

/**
 * Check if a knowledge_documents row with the same content_hash already exists (not deleted).
 * Returns the hash so callers can persist it on insert.
 */
export async function checkDuplicate(
  supabase: any,
  content: string,
): Promise<DuplicateResult> {
  const hash = await sha256Hex(content);
  const { data } = await supabase
    .from("knowledge_documents")
    .select("id, title")
    .eq("content_hash", hash)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (data?.id) {
    return {
      duplicate: true,
      existing_id: data.id,
      existing_title: data.title,
      content_hash: hash,
    };
  }
  return { duplicate: false, content_hash: hash };
}
