import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { languages } from "@/contexts/LanguageContext";
import viTranslations from "@/translations/vi";
import enTranslations from "@/translations/en";
import zhTranslations from "@/translations/zh";
import esTranslations from "@/translations/es";
import arTranslations from "@/translations/ar";
import hiTranslations from "@/translations/hi";
import ptTranslations from "@/translations/pt";
import ruTranslations from "@/translations/ru";
import jaTranslations from "@/translations/ja";
import deTranslations from "@/translations/de";
import frTranslations from "@/translations/fr";
import koTranslations from "@/translations/ko";

/**
 * i18n Naming Sync Test
 * Bảo đảm tên chính thức "PureLove Protocol (PLP)" và "Light Score"
 * được đồng bộ trên toàn bộ bản dịch và source UI, không còn nhãn cũ.
 *
 * Nội bộ (tên bảng DB, hook `usePPLPScore`, biến `PPLP_*`, `poplScore` key)
 * KHÔNG bị chặn — theo Naming Standard chỉ đổi user-facing labels.
 */

const allTranslations: Record<string, Record<string, string>> = {
  vi: viTranslations,
  en: enTranslations,
  zh: zhTranslations,
  es: esTranslations,
  ar: arTranslations,
  hi: hiTranslations,
  pt: ptTranslations,
  ru: ruTranslations,
  ja: jaTranslations,
  de: deTranslations,
  fr: frTranslations,
  ko: koTranslations,
};

// Nhãn cũ bị cấm trong VALUE của bản dịch (không phải key)
const FORBIDDEN_TRANSLATION_VALUES: RegExp[] = [
  /Proof of Pure Love/i,
  /\bPPLP\b/,
  /\bPoPL\b/,
  /Pure Love Score/i,
  /Điểm PoPL/i,
  /Điểm PureLove/i,
];

// Key i18n bắt buộc phải tồn tại trên MỌI ngôn ngữ
const REQUIRED_KEYS = ["profile.poplScore", "profile.poplScoreDesc"];

describe("i18n: PureLove Protocol (PLP) + Light Score sync", () => {
  it("mọi ngôn ngữ đều có các key bắt buộc", () => {
    const missing: string[] = [];
    for (const lang of languages) {
      const dict = allTranslations[lang.code];
      for (const key of REQUIRED_KEYS) {
        if (!dict[key] || dict[key].trim() === "") {
          missing.push(`${lang.code}:${key}`);
        }
      }
    }
    expect(missing, `Thiếu key: ${missing.join(", ")}`).toEqual([]);
  });

  it("không có bản dịch nào còn nhãn cũ (Proof of Pure Love / PPLP / PoPL / Pure Love Score)", () => {
    const violations: string[] = [];
    for (const lang of languages) {
      const dict = allTranslations[lang.code];
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value !== "string") continue;
        for (const re of FORBIDDEN_TRANSLATION_VALUES) {
          if (re.test(value)) {
            violations.push(`[${lang.code}] ${key} = "${value}"`);
            break;
          }
        }
      }
    }
    expect(violations, `Nhãn cũ còn sót:\n${violations.join("\n")}`).toEqual([]);
  });

  it("nhãn Light Score xuất hiện trong profile.poplScore cho mọi ngôn ngữ (không còn 'Pure Love Score' cũ)", () => {
    const bad: string[] = [];
    for (const lang of languages) {
      const v = allTranslations[lang.code]["profile.poplScore"] || "";
      if (/Pure Love Score/i.test(v) || /\bPoPL\b/.test(v)) {
        bad.push(`${lang.code}: "${v}"`);
      }
    }
    expect(bad, `Chưa đổi sang Light Score:\n${bad.join("\n")}`).toEqual([]);
  });
});

/* -------- Quét source UI để chặn hồi quy nhãn cũ -------- */

const UI_SCAN_ROOTS = ["src/pages", "src/components"];
// Cho phép identifier code (biến / import / hook / prop / css class / tên file / comment PoPL trong console.warn).
// Chỉ chặn chuỗi JSX text và string literal hiển thị.
const FORBIDDEN_UI_LITERALS: { pattern: RegExp; label: string }[] = [
  { pattern: /"Proof of Pure Love"/g, label: '"Proof of Pure Love"' },
  { pattern: />\s*Proof of Pure Love[^<]*</gi, label: "JSX text 'Proof of Pure Love'" },
  { pattern: />\s*PROOF OF PURE LOVE PROTOCOL\s*</g, label: "JSX text 'PROOF OF PURE LOVE PROTOCOL'" },
  { pattern: /"Pure Love Score"/g, label: '"Pure Love Score"' },
  { pattern: />\s*Pure Love Score\s*</g, label: "JSX text 'Pure Love Score'" },
  { pattern: /"PoPL Score"/g, label: '"PoPL Score"' },
  { pattern: />\s*PoPL Score\s*</g, label: "JSX text 'PoPL Score'" },
  { pattern: /"PoPL Verified/g, label: '"PoPL Verified"' },
];

// Danh sách file được miễn (chứa doctrine / tên gốc lịch sử / dữ liệu docs)
const EXEMPT_FILES = new Set<string>([
  // Các trang docs whitepaper chứa nội dung lịch sử vẫn nhắc "Proof of Pure Love" trong prose
  "src/pages/docs/poplDataEN.ts",
  "src/pages/docs/funMoney5DData.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  let entries: import("fs").Dirent[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(full);
  }
  return out;
}

describe("UI source scan: no legacy PLP labels", () => {
  it("không có JSX/string literal user-facing chứa nhãn cũ", () => {
    const root = path.resolve(__dirname, "../..");
    const files: string[] = [];
    for (const r of UI_SCAN_ROOTS) walk(path.join(root, r), files);

    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(root, file).split(path.sep).join("/");
      if (EXEMPT_FILES.has(rel)) continue;
      const src = readFileSync(file, "utf8");
      for (const { pattern, label } of FORBIDDEN_UI_LITERALS) {
        pattern.lastIndex = 0;
        if (pattern.test(src)) {
          violations.push(`${rel}: ${label}`);
        }
      }
    }
    expect(
      violations,
      `Còn nhãn cũ trong UI (đổi sang "PureLove Protocol (PLP)" / "Light Score"):\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
