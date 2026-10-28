// knowledge-title — sinh tiêu đề tài liệu từ tên file / URL (bản dùng cho edge functions)
const NOISE_SUFFIX = /\b(final|copy|ban sao|bansao|draft|v\d+|version\s*\d+)\b/gi;

export function titleFromFileName(fileName: string): string {
  if (!fileName) return "";
  let t = fileName.trim();
  t = t.split(/[\\/]/).pop() || t;
  t = t.replace(/\.[A-Za-z0-9]{1,6}$/, "");
  t = t.replace(/\b\d{10,}\b/g, " ");
  t = t.replace(/[([]\s*\d{1,3}\s*[)\]]/g, " ");
  t = t.replace(/[._\-]+/g, " ");
  t = t.replace(NOISE_SUFFIX, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (!t) return fileName.slice(0, 300);
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 300);
}

export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (last && last.length > 2) {
      const t = titleFromFileName(decodeURIComponent(last));
      if (t) return t;
    }
    return u.hostname.replace(/^www\./, "");
  } catch {
    return titleFromFileName(url);
  }
}
