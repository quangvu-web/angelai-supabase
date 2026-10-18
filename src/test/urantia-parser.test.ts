import { describe, expect, it } from "vitest";
import { parseUrantiaJson, parseUrantiaText } from "@/lib/urantia/parser";

const fixture = `# LỜI NÓI ĐẦU — Fixture tự tạo
## MỤC 0 — Giới thiệu
0:0.1 Ánh sáng và lòng chân thật được giữ nguyên tiếng Việt.
# PHẦN I
# BÀI 1 — Tài liệu kiểm thử giả lập
## MỤC 0 — Mở đầu
1:0.1 Đây là nội dung giả lập thứ nhất.
1:0.2 Đây là nội dung giả lập thứ hai.
## MỤC 1 — Tiếp theo
1:1.1 Đây là đoạn giả lập độc lập.`;

describe("Urantia parser", () => {
  it("preserves Foreword/Paper/Section/paragraph IDs and Vietnamese Unicode", async () => {
    const result = await parseUrantiaText(fixture, { maxChunkChars: 90 });
    expect(result.documents.map((d) => d.paperNumber)).toEqual([0, 1]);
    expect(result.documents[1].sections[1].paragraphs[0].id).toBe("1:1.1");
    expect(result.documents[0].sections[0].paragraphs[0].text).toContain("tiếng Việt");
    expect(result.chunks.every((c) => c.paragraphIds.length > 0)).toBe(true);
    expect(result.chunks.flatMap((c) => c.paragraphIds)).toContain("1:0.2");
  });

  it("detects duplicate papers and paragraph IDs", async () => {
    const result = await parseUrantiaText(`${fixture}\n# BÀI 1 — Trùng\n## MỤC 0\n1:0.1 Trùng ID`);
    expect(result.duplicatePapers).toEqual([1]);
    expect(result.errors.some((e) => e.code === "DUPLICATE_PAPER")).toBe(true);
  });

  it("detects invalid paragraph ownership and missing papers", async () => {
    const result = await parseUrantiaText("# PAPER 2 — Fake\n## SECTION 1\n3:1.1 Wrong", { requireComplete: true });
    expect(result.errors.map((e) => e.code)).toContain("PARAGRAPH_PAPER_MISMATCH");
    expect(result.errors.map((e) => e.code)).toContain("INVALID_PARAGRAPH_ID");
    expect(result.missingPapers).toContain(196);
  });

  it("accepts structured JSON without rewriting content", async () => {
    const json = JSON.stringify({ documents: [{ heading: "PAPER 2 — Fake", sections: [{ heading: "SECTION 1 — S", paragraphs: [{ id: "2:1.1", text: "Nguyên văn giả lập." }] }] }] });
    const result = await parseUrantiaJson(json);
    expect(result.documents[0].sections[0].paragraphs[0].text).toBe("Nguyên văn giả lập.");
  });
});
