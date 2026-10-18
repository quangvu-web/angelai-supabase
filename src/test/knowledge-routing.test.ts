import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalKnowledgeFolder, KNOWLEDGE_FOLDER_ALIASES, KNOWLEDGE_FOLDER_NAMES, knowledgeFolderKey } from "../../supabase/functions/_shared/knowledge-folders";

const migration = readFileSync("drizzle/migrations/0000_auto_route_new_knowledge_documents.sql", "utf8");
const values = [...migration.matchAll(/\('([^']*)', '([^']*)'\)/g)];
const sqlMapping = new Map(values.map(match => [match[1], match[2]]));
const resolveSqlMapping = (name: string) => sqlMapping.get(knowledgeFolderKey(name)) ?? null;

describe("database routing taxonomy parity", () => {
  it("resolves all 20 approved destinations identically to ingestion", () => {
    expect(KNOWLEDGE_FOLDER_NAMES).toHaveLength(20);
    for (const name of KNOWLEDGE_FOLDER_NAMES) {
      expect(resolveSqlMapping(name)).toBe(name);
      expect(resolveSqlMapping(name.toUpperCase().normalize("NFD"))).toBe(name);
    }
  });
  it("routes every approved legacy alias to its exact destination", () => {
    for (const [alias, destination] of Object.entries(KNOWLEDGE_FOLDER_ALIASES)) {
      expect(resolveSqlMapping(alias)).toBe(destination);
      expect(resolveSqlMapping(alias)).toBe(canonicalKnowledgeFolder(alias));
    }
  });
  it("does not infer destinations from document titles or unknown labels", () => {
    expect(resolveSqlMapping("FATHER INSIDE & FATHER PARADISE CÙNG CHUNG MỘT HƯỚNG")).toBeNull();
    expect(resolveSqlMapping("Unknown Telegram source")).toBeNull();
    expect(resolveSqlMapping("New meditation course")).toBeNull();
  });
});
