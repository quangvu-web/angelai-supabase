/**
 * Multi-image upload helper for Angel AI chat.
 * Handles client-side compression + retry on transient failure.
 */
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";

export const MAX_CHAT_IMAGES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB per image
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50MB total

export interface ChatImage {
  id: string;
  previewUrl: string; // local blob/data URL for instant preview
  url?: string;       // public URL after upload
  status: "uploading" | "ready" | "error";
  error?: string;
  fileName?: string;
}

export function makeImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a single image with light compression + 1 retry.
 * Returns public URL on success.
 */
export async function uploadChatImage(
  file: File,
  userId: string | undefined,
  maxAttempts = 2,
): Promise<string> {
  if (!userId) {
    throw new Error("auth_required_for_chat_attachment");
  }

  // Client-side pre-processing — resize/re-encode when helpful
  let toUpload = file;
  try {
    toUpload = await compressImage(file, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 0.82,
      format: "webp",
    });
  } catch {
    // compression is best-effort; fall back to original
    toUpload = file;
  }

  const ext = toUpload.name.split(".").pop()?.toLowerCase() || "webp";
  const uid = userId;

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const fileName = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${attempt}.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, toUpload, { contentType: toUpload.type || undefined });

      if (uploadError) {
        lastErr = uploadError;
        // brief backoff before retry
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }

      const { data } = supabase.storage.from("chat-attachments").getPublicUrl(fileName);
      if (!data?.publicUrl) throw new Error("no_public_url");
      return data.publicUrl;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("upload_failed");
}
