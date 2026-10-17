import { stripMarkdown } from "@/lib/stripMarkdown";

export interface ClipboardMessageLike {
  role?: string;
  content?: string | null;
  imageUrl?: string | null;
}

/** True for inline/encoded sources (base64 data URLs, blob:) that must never reach the clipboard. */
export function isInlineImageSrc(src?: string | null): boolean {
  if (!src) return true;
  const s = src.trim();
  return s.startsWith("data:") || s.startsWith("blob:") || !/^https?:\/\//i.test(s);
}

function htmlToPlainText(input: string): string {
  if (!/<[a-z][\s\S]*>/i.test(input)) return input;
  const el = document.createElement("div");
  el.innerHTML = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n");
  return el.textContent || "";
}

/**
 * Single source of truth for "Sao chép": always returns clean plain text
 * of what the user sees. Never objects, JSON, base64 or HTML.
 */
export function getPlainTextForClipboard(
  message: ClipboardMessageLike,
  options: { signature?: string } = {},
): string {
  const raw = typeof message?.content === "string" ? message.content : "";
  const text = stripMarkdown(htmlToPlainText(raw))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const parts: string[] = [];
  if (text) parts.push(text);

  // Only shareable https links — never base64/blob payloads.
  if (message.imageUrl && !isInlineImageSrc(message.imageUrl)) {
    parts.push(`🖼️ ${message.imageUrl}`);
  }
  if (message.role === "assistant" && options.signature) {
    parts.push(options.signature);
  }

  return parts.join("\n\n").trim();
}
