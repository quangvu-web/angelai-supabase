import { describe, it, expect } from "vitest";
import { classifyIntent } from "../../supabase/functions/_shared/angel-prompts/intent";
import { buildSystemPrompt } from "../../supabase/functions/_shared/angel-prompts/builder";

describe("father_universe module gating", () => {
  describe("SHOULD load for Cha Vũ Trụ / Đấng Tạo Hóa / 8 Câu Thần Chú", () => {
    const positives = [
      "Cha Vũ Trụ là ai?",
      "Xin hãy kể về cha vũ trụ",
      "Đấng Tạo Hóa là gì?",
      "Đấng Toàn Năng có tồn tại không?",
      "Đấng tối cao dẫn dắt chúng ta",
      "Nguồn cội của vạn vật",
      "Tell me about the Father Universe",
      "Who is the Source?",
      "the Creator of everything",
      "the Almighty",
      "8 câu thần chú là gì?",
      "Xin đọc 8 Câu Thần Chú",
      "What are the eight mantras?",
    ];
    for (const msg of positives) {
      it(`loads father_universe for: "${msg}"`, () => {
        expect(classifyIntent(msg)).toContain("father_universe");
      });
    }
  });

  describe("SHOULD NOT load for unrelated topics", () => {
    const negatives = [
      "PPLP là gì?",
      "Làm sao để mint FUN Money?",
      "How to connect my wallet to BSC?",
      "Camly Coin giá bao nhiêu?",
      "Fun Profile hoạt động thế nào?",
      "Hướng dẫn rút tiền",
      "Viết cho mình một đoạn code React",
      "Explain TypeScript generics",
      "Tôi biết ơn cuộc sống hôm nay",
      "Thank you so much",
      "Light Score của mình là bao nhiêu?",
      "5D economy là gì?",
      "Hệ sinh thái FUN có bao nhiêu nền tảng?",
      "Ánh sáng nội tâm là gì?",
      "Làm thế nào để tăng điểm tier?",
      "Xin chào Angel",
      "Hôm nay thời tiết đẹp quá",
    ];
    for (const msg of negatives) {
      it(`does NOT load father_universe for: "${msg}"`, () => {
        expect(classifyIntent(msg)).not.toContain("father_universe");
      });
    }
  });

  describe("edge cases", () => {
    it("empty message loads nothing", () => {
      expect(classifyIntent("")).not.toContain("father_universe");
    });
    it("very long content (>1500 chars) skips module loading entirely", () => {
      const longMsg = "cha vũ trụ ".repeat(200);
      expect(classifyIntent(longMsg)).toEqual([]);
    });
    it("substrings like 'charter' / 'channel' / 'chat' do NOT trigger", () => {
      expect(classifyIntent("What is the charter of PPLP?")).not.toContain("father_universe");
      expect(classifyIntent("Open a new channel please")).not.toContain("father_universe");
      expect(classifyIntent("Start a chat with me")).not.toContain("father_universe");
    });
  });

  describe("prompt builder integration", () => {
    it("injects the official Father Universe definition for matching questions", () => {
      const result = buildSystemPrompt({ userMessage: "Cha Vũ Trụ là ai?" });

      expect(result.loadedModules).toContain("father_universe");
      expect(result.prompt).toContain("ĐỊNH NGHĨA CHA VŨ TRỤ");
      expect(result.prompt).toContain("Đấng Tạo Hóa tối cao của toàn bộ Vũ Trụ");
      expect(result.prompt).toContain("Không thêm bớt, không diễn giải sai lệch");
    });

    it("keeps the Father Universe definition out of unrelated prompts", () => {
      const result = buildSystemPrompt({ userMessage: "Hướng dẫn rút Camly Coin" });

      expect(result.loadedModules).not.toContain("father_universe");
      expect(result.prompt).not.toContain("ĐỊNH NGHĨA CHA VŨ TRỤ");
    });
  });
});
