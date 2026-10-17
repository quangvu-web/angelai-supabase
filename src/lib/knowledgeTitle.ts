/**
 * Sinh tiêu đề tài liệu từ tên file tải lên.
 * Bỏ đuôi mở rộng, làm sạch dấu gạch/timestamp/hậu tố kỹ thuật.
 */
const NOISE_SUFFIX = /\b(final|copy|ban sao|bansao|draft|v\d+|version\s*\d+)\b/gi;

export function titleFromFileName(fileName: string): string {
  if (!fileName) return "";
  let t = fileName.trim();

  // Bỏ đường dẫn nếu có
  t = t.split(/[\\/]/).pop() || t;

  // Bỏ đuôi mở rộng
  t = t.replace(/\.[A-Za-z0-9]{1,6}$/, "");

  // Bỏ dãy timestamp dài (>= 10 chữ số) và tiền tố dạng 1712345678_
  t = t.replace(/\b\d{10,}\b/g, " ");

  // Bỏ hậu tố dạng (1), (2), [1]
  t = t.replace(/[([]\s*\d{1,3}\s*[)\]]/g, " ");

  // Gạch dưới / gạch ngang / chấm → khoảng trắng
  t = t.replace(/[._\-]+/g, " ");

  // Bỏ các từ khoá kỹ thuật thường gặp
  t = t.replace(NOISE_SUFFIX, " ");

  // Gộp khoảng trắng
  t = t.replace(/\s+/g, " ").trim();

  if (!t) return fileName.slice(0, 300);

  // Viết hoa chữ cái đầu (giữ nguyên nếu đã viết hoa)
  t = t.charAt(0).toUpperCase() + t.slice(1);

  return t.slice(0, 300);
}

/** Suy tiêu đề từ URL khi không có tên file rõ ràng. */
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
