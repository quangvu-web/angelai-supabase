import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("canonical Angel routing", () => {
  it("keeps active Chat, EmbedChat and MCP call sites on angel-chat", () => {
    const files = ["src/pages/Chat.tsx", "src/pages/embed/EmbedChat.tsx", "supabase/functions/mcp/index.ts", "src/lib/mcp/tools/ask-angel.ts"];
    const contents = files.map((f) => readFileSync(resolve(process.cwd(), f), "utf8"));
    const deprecatedRoute = "/functions/v1/angel-" + "router";
    expect(contents.every((c) => !c.includes(deprecatedRoute))).toBe(true);
    expect(contents.filter((c) => c.includes("angel-chat") || c.includes("angelChatUrl")).length).toBe(files.length);
  });

  it("preserves streaming and multi-turn contracts", () => {
    const chat = readFileSync(resolve(process.cwd(), "src/pages/Chat.tsx"), "utf8");
    const embed = readFileSync(resolve(process.cwd(), "src/pages/embed/EmbedChat.tsx"), "utf8");
    expect(chat).toContain("resp.body.getReader()");
    expect(embed).toContain("res.body?.getReader()");
    expect(embed).toContain("messages: next.map");
  });

  it("prepares anonymous denial and authenticated admin upload", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260901090000_urantia_rag_foundation.sql"), "utf8");
    const upload = readFileSync(resolve(process.cwd(), "supabase/functions/knowledge-admin-upload/index.ts"), "utf8");
    expect(migration).toMatch(/REVOKE SELECT ON public\.knowledge_documents,public\.knowledge_chunks FROM PUBLIC,anon,authenticated/);
    expect(migration).toContain("REVOKE EXECUTE ON FUNCTION public.match_knowledge_hybrid");
    expect(migration).toContain("rollback_knowledge_collection");
    expect(upload).toContain("requireAdmin(req)");
  });

  it("blocks external fallback for Urantia intent", () => {
    const server = readFileSync(resolve(process.cwd(), "supabase/functions/angel-chat/index.ts"), "utf8");
    expect(server).toContain("&& !isUrantiaIntent(q)");
    expect(server).toContain('corpus: "urantia"');
  });
});
