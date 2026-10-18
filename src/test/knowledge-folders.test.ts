import { describe, expect, it } from "vitest";
import { canonicalKnowledgeFolder, KNOWLEDGE_FOLDER_NAMES } from "../../supabase/functions/_shared/knowledge-folders";

describe("approved knowledge taxonomy", () => {
  it("has exactly the 20 canonical export destinations", () => {
    expect(KNOWLEDGE_FOLDER_NAMES).toEqual([
      "Hồ sơ dự án", "Vương Quốc FUN", "Camly Coin", "FUN Money", "FUN Wallet",
      "Angel AI", "FUN Profile", "FUN Academy", "Green Earth", "FUN Cosmos",
      "FUN Charity", "FUN Play", "FUN Farm", "LoveHUB", "Các bài viết của Father",
      "Các bài viết của Founder Camly Duong", "Các bài dẫn thiền", "PLP", "Sách Urantia", "Các tài liệu khác",
    ]);
    for (const name of KNOWLEDGE_FOLDER_NAMES) expect(canonicalKnowledgeFolder(name)).toBe(name);
  });
  it("routes all nine approved meditation groups into one destination", () => {
    for (const name of ["Du hành vũ trụ", "Linh hồn có sứ mệnh", "Love House Hoi An", "Luat hap dan", "Ms Camly Duong dan thien", "Nang cao", "Rat de", "Bai le", "Cha qua Be Ly dan thien"])
      expect(canonicalKnowledgeFolder(name)).toBe("Các bài dẫn thiền");
  });
  it("routes the approved Telegram groups to miscellaneous, not guessed platforms", () => {
    for (const name of ["Telegram / CAMLY COIN CHANNEL", "Telegram / angelKNOWLEDGE", "Telegram / angelknownledge", "Telegram / KNOWLEDGE ANGEL AI", "Telegram / Channel -1003710799723", "Telegram / ✨Camly Coin - EXCHANGE 🍀 💰", "Tài liệu chung"])
      expect(canonicalKnowledgeFolder(name)).toBe("Các tài liệu khác");
  });
  it("normalizes casing without guessing unknown folder destinations", () => {
    expect(canonicalKnowledgeFolder("SÁCH URANTIA")).toBe("Sách Urantia");
    expect(canonicalKnowledgeFolder("LOVEHUB")).toBe("LoveHUB");
    expect(canonicalKnowledgeFolder("FUNCOSMOS")).toBe("FUN Cosmos");
    expect(canonicalKnowledgeFolder("Unknown Telegram source")).toBeNull();
  });
});
