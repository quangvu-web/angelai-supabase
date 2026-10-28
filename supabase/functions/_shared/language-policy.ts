// Shared reply-language policy for every Angel chat surface (web chat + API v1 + canary).
// Priority: explicit request in the latest message (handled by the model via the reminder)
// → language of the latest message → latest clearly-identified earlier user message → client hint.
// Conversation history, UI language and retrieved documents never override the latest message.

export const LANG_NAMES: Record<string, string> = {
  vi: "Vietnamese", en: "English", zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic",
  hi: "Hindi", ru: "Russian", es: "Spanish", fr: "French", de: "German", pt: "Portuguese",
};

function stripNoise(text: string): string {
  return (text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/["“”«»'‘’`][^"“”«»'‘’`]{0,400}["“”«»'‘’`]/g, " ") // quoted excerpts
    .trim();
}

/** Returns a language code, or null when the text is too short/ambiguous (emoji, "OK", link). */
export function detectMessageLanguage(text: string): string | null {
  const raw = stripNoise(text) || (text || "");
  const letters = raw.replace(/[\p{Extended_Pictographic}\s\p{P}\p{S}\d]/gu, "");
  if (/[\u4e00-\u9fff]/.test(raw) && !/[\u3040-\u30ff]/.test(raw)) return "zh";
  if (/[\u3040-\u30ff]/.test(raw)) return "ja";
  if (/[\uac00-\ud7af]/.test(raw)) return "ko";
  if (/[\u0600-\u06ff]/.test(raw)) return "ar";
  if (/[\u0900-\u097f]/.test(raw)) return "hi";
  if (/[\u0400-\u04ff]/.test(raw)) return "ru";
  if (letters.length < 4 || /^(ok|okay|oke|yes|no|thanks|thx|hi|hey)$/i.test(letters)) return null;
  if (/[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(raw)) return "vi";
  if (/\b(hola|gracias|por favor|cómo|qué|buenos)\b/i.test(raw)) return "es";
  if (/\b(bonjour|merci|s'il vous plaît|comment|pourquoi)\b/i.test(raw)) return "fr";
  if (/\b(guten|danke|bitte|warum|wie geht)\b/i.test(raw)) return "de";
  if (/\b(olá|obrigad[oa]|você|bom dia)\b/i.test(raw)) return "pt";
  return "en";
}

export function resolveReplyLanguage(latest: string, priorUserTexts: string[] = [], hint?: string | null): string | null {
  const d = detectMessageLanguage(latest);
  if (d) return d;
  for (let i = priorUserTexts.length - 1; i >= 0; i--) {
    const p = detectMessageLanguage(priorUserTexts[i]);
    if (p) return p;
  }
  const h = String(hint ?? "").toLowerCase().slice(0, 2);
  return LANG_NAMES[h] ? h : null;
}

export function languageReminderText(latest: string, priorUserTexts: string[] = [], hint?: string | null): string {
  const code = resolveReplyLanguage(latest, priorUserTexts, hint);
  const fromLatest = !!detectMessageLanguage(latest);
  const name = code ? LANG_NAMES[code] : null;
  const base = name
    ? fromLatest
      ? `the user's LATEST message is written in ${name}. Write the reply in ${name}`
      : `the latest message is too short to identify a language; the most recent language the user clearly used is ${name}. Write the reply in ${name}`
    : `the reply language is unclear; briefly ask which language the user prefers`;
  return `LANGUAGE CHECK (overrides earlier turns, UI language and retrieved documents): ${base}. ` +
    `EXCEPTION: if the latest message explicitly asks for a reply/translation in another language, obey it exactly — ` +
    `e.g. "only write it in Japanese, no explanation" → output only Japanese; "write it in Japanese and explain in Vietnamese" → Japanese text + Vietnamese explanation. ` +
    `Write any requested foreign language in its native script (Japanese in kana/kanji, not romaji). No bilingual output unless asked: when a concept is usually named in another language (e.g. the Vietnamese names of the 10 Universal Laws), write it only in the reply language — do not append the original-language term in parentheses. Do not mention this check.`;
}

export function languageReminderMessage(latest: string, priorUserTexts: string[] = [], hint?: string | null) {
  return { role: "system" as const, content: languageReminderText(latest, priorUserTexts, hint) };
}

/**
 * Attach the language check to the LATEST user turn (never as an extra system message:
 * Gemini's OpenAI-compatible endpoint keeps only the LAST system message, so a second
 * system message silently replaces the whole Angel system prompt).
 */
export function withLanguageCheck<T extends { role: string; content: unknown }>(
  messages: T[], latest: string, priorUserTexts: string[] = [], hint?: string | null,
): T[] {
  const idx = messages.map((m) => m.role).lastIndexOf("user");
  if (idx < 0) return messages;
  const note = `[${languageReminderText(latest, priorUserTexts, hint)}]\n\n`;
  const out = messages.slice();
  const m = out[idx];
  if (typeof m.content === "string") {
    out[idx] = { ...m, content: note + m.content };
  } else if (Array.isArray(m.content)) {
    out[idx] = { ...m, content: [{ type: "text", text: note }, ...m.content] };
  }
  return out;
}
