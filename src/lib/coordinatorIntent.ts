/**
 * Phase 3.5 — Intent Firewall
 *
 * Phân loại latest user message thành READ_ONLY hoặc MODIFY.
 * KHÔNG nhìn lịch sử chat và KHÔNG nhìn Mode (Product Spec, Smart Contract…).
 *
 * Rule:
 *  - MODIFY keyword → modify (ưu tiên cao nhất).
 *  - Không có MODIFY nhưng có READ keyword → read_only.
 *  - Không match gì → read_only (fail-safe).
 */

export type CoordinatorIntent = "read_only" | "modify";

/** Lowercase + bỏ dấu tiếng Việt để match keyword ổn định. */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

// Dùng normalized form (không dấu).
const MODIFY_KEYWORDS: string[] = [
  // Tiếng Việt (không dấu)
  "sua",
  "doi ",
  "thay",
  "cap nhat",
  "xoa",
  "them ",
  "tao file",
  "tao prd",
  "tao pr",
  "mo pr",
  "trien khai",
  "viet lai",
  "viet them",
  // English
  "update",
  "fix",
  "refactor",
  "implement",
  "rewrite",
  "apply",
  "patch",
  "delete",
  "remove",
  "create file",
  "edit ",
  "modify",
  "change",
  "add ",
];

const READ_KEYWORDS: string[] = [
  // Tiếng Việt (không dấu)
  "tim ",
  "tim component",
  "tim hook",
  "tim file",
  "tim route",
  "tim key",
  "o dau",
  "file nao",
  "route nao",
  "component nao",
  "key nao",
  "da dich chua",
  "doc ",
  "xem ",
  "kiem tra",
  "phan tich",
  "giai thich",
  "liet ke",
  // English
  "search",
  "locate",
  "list ",
  "show ",
  "where ",
  "which file",
  "explain",
  "analyze",
  "read ",
  "find ",
  "lookup",
];

function containsAny(haystack: string, needles: string[]): boolean {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
}

export function classifyCoordinatorIntent(userMessage: string): CoordinatorIntent {
  const n = " " + normalize(userMessage || "") + " ";
  if (containsAny(n, MODIFY_KEYWORDS)) return "modify";
  if (containsAny(n, READ_KEYWORDS)) return "read_only";
  return "read_only"; // fail-safe
}

/** Server-side tool stripping helper — danh sách tool bị cấm khi read_only. */
export const FORBIDDEN_TOOLS_WHEN_READ_ONLY = ["propose_edit", "evolve_workspace"] as const;
