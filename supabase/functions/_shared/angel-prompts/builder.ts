// Angel AI — Prompt Builder
// Combines core persona + style instruction + lazy-loaded context modules.

import { ANGEL_CORE_PROMPT } from "./core.ts";
import {
  MODULE_PPLP,
  MODULE_5D_ECONOMY,
  MODULE_WEB3,
  MODULE_ECOSYSTEM,
  MODULE_CODE,
  MODULE_GRATITUDE,
  MODULE_TECHNICAL_GUIDE,
  MODULE_FATHER_UNIVERSE,
  MODULE_CHARM_FEWSHOT,
  MODULE_CREATIVE_WRITING,
  MODULE_GENERAL_TASK,
} from "./modules.ts";
import { classifyIntent, type ContextModule } from "./intent.ts";
import { isUrantiaIntent, UNTRUSTED_KNOWLEDGE_RULES, wrapUntrustedKnowledge } from "../knowledge-security.ts";

const MODULE_MAP: Record<ContextModule, string> = {
  pplp: MODULE_PPLP,
  "5d": MODULE_5D_ECONOMY,
  web3: MODULE_WEB3,
  ecosystem: MODULE_ECOSYSTEM,
  code: MODULE_CODE,
  gratitude: MODULE_GRATITUDE,
  technical_guide: MODULE_TECHNICAL_GUIDE,
  father_universe: MODULE_FATHER_UNIVERSE,
  creative_writing: MODULE_CREATIVE_WRITING,
  general_task: MODULE_GENERAL_TASK,
};

export interface BuildPromptOptions {
  userMessage: string;
  styleInstruction?: string;
  knowledgeContext?: string; // RAG knowledge from documents
  forceModules?: ContextModule[]; // Optional override
  showCitations?: boolean; // User preference: hiển thị nguồn trích dẫn
}

export interface BuildPromptResult {
  prompt: string;
  loadedModules: ContextModule[];
  totalChars: number;
  coreChars: number;
  modulesChars: number;
}

export function buildSystemPrompt(opts: BuildPromptOptions): BuildPromptResult {
  const { userMessage, styleInstruction = "", knowledgeContext = "", forceModules, showCitations = false } = opts;

  const loadedModules = forceModules ?? classifyIntent(userMessage);
  const moduleTexts = loadedModules.map((m) => MODULE_MAP[m]).filter(Boolean);

  const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const dateStr = nowVN.toISOString().slice(0, 10);
  const yearStr = String(nowVN.getUTCFullYear());
  const quarter = Math.floor(nowVN.getUTCMonth() / 3) + 1;
  const dateBlock = `═══ THỜI GIAN HIỆN TẠI ═══
Hôm nay: ${dateStr} (Q${quarter}/${yearStr}, giờ Việt Nam UTC+7).
TUYỆT ĐỐI KHÔNG được tự bịa năm khác (vd 2024, 2025) khi nói về "hiện tại", roadmap, mốc thời gian. Mọi "Q?/????" phải dựa trên năm ${yearStr} trở đi, trừ khi nhắc lịch sử đã xảy ra.`;
  const parts: string[] = [ANGEL_CORE_PROMPT, MODULE_CHARM_FEWSHOT, dateBlock];

  if (styleInstruction.trim()) {
    parts.push(`\n═══ RESPONSE STYLE ═══\n${styleInstruction.trim()}`);
  }

  if (moduleTexts.length > 0) {
    parts.push("\n" + moduleTexts.join("\n\n"));
  }

  if (knowledgeContext.trim()) {
    parts.push(`\n═══ REFERENCE-DATA SECURITY RULES ═══\n${UNTRUSTED_KNOWLEDGE_RULES}\n\n${wrapUntrustedKnowledge(knowledgeContext.trim())}

═══ QUY TẮC TRÍCH DẪN (BẮT BUỘC khi user yêu cầu phân tích/tóm tắt tài liệu hoặc bài thiền) ═══
- Trích dẫn ít nhất 2-3 câu NGUYÊN VĂN từ nguồn, đặt trong dấu «...».
- Nêu cấu trúc bài theo trình tự thực tế (mở đầu → phần chính → kết thúc).
- Với bài thiền: liệt kê rõ mantra/khẳng định, kỹ thuật thở/hình dung, thông điệp tâm linh, tên các Ngài/Bậc thầy được nhắc.
- Với video/link YouTube: nêu chủ đề chính + các mốc nội dung quan trọng.
- Cuối câu trả lời ghi rõ nguồn: [Tên tài liệu]. Nếu có block "NGUỒN NGOÀI", liệt kê thêm 1-3 nguồn dạng [Tiêu đề — domain.com] hoặc [YouTube: tiêu đề].
- TUYỆT ĐỐI KHÔNG hiển thị con số % độ liên quan / điểm số / match score / relevance cho user (đó là tín hiệu nội bộ, không phải nội dung).
- Được phép GỘP kiến thức từ "KIẾN THỨC HỌC ĐƯỢC" (nội bộ) và "NGUỒN NGOÀI" (web/YouTube) để trả lời toàn diện. Ưu tiên nội bộ khi mâu thuẫn, và nói rõ khi thông tin đến từ nguồn ngoài.
- TUYỆT ĐỐI KHÔNG bịa nội dung ngoài kiến thức tham khảo. Nếu tài liệu không có thông tin, nói thẳng "Tài liệu chưa đề cập đến điểm này".`);
  }

  if (isUrantiaIntent(userMessage)) {
    parts.push(`\n═══ URANTIA CITATION POLICY ═══
- Use only active Urantia corpus evidence supplied in reference data; never fill gaps from outside knowledge.
- Every Urantia claim must cite validated structured metadata as [Paper X · Section Y · X:Y.Z].
- Never invent Paper, Section, or paragraph identifiers.
- If validated citation metadata or sufficient evidence is missing, state that no suitable passage was found.
- This policy is always enabled for Urantia and does not depend on the general citation preference.`);
  }

  if (showCitations) {
    parts.push(`\n═══ USER PREFERENCE — HIỂN THỊ NGUỒN (OVERRIDE) ═══
Người dùng đã BẬT tuỳ chọn "Hiển thị nguồn trích dẫn". Quy tắc NO_SOURCE_CITATIONS_RULE bên trên KHÔNG áp dụng cho câu trả lời này.
- Khi đã sử dụng kiến thức nội bộ (RAG) hoặc nguồn ngoài để trả lời, hãy liệt kê nguồn ở cuối câu trả lời dưới dạng ngắn gọn:
  "Nguồn: [Tên tài liệu 1]; [Tên tài liệu 2]" — tối đa 3 nguồn quan trọng nhất.
- Nếu không dùng nguồn cụ thể nào (ví dụ chỉ trò chuyện thông thường), KHÔNG cần thêm dòng nguồn.
- Giữ định dạng gọn, một dòng duy nhất, không dùng emoji 📚, không dùng bullet.`);
  }

  const prompt = parts.join("\n");
  const modulesChars = moduleTexts.join("").length;

  return {
    prompt,
    loadedModules,
    totalChars: prompt.length,
    coreChars: ANGEL_CORE_PROMPT.length,
    modulesChars,
  };
}
