import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "search_knowledge",
  title: "Search FUN Kingdom knowledge",
  description:
    "Semantic search over Angel AI's public knowledge base (Cha Vũ Trụ doctrine, PLP protocol, Light economy, mini games, docs). Returns the most relevant chunks with similarity scores.",
  inputSchema: {
    query: z.string().min(1).describe("Natural-language search query (Vietnamese or English)."),
    limit: z.number().int().min(1).max(10).optional().describe("Max chunks to return. Default 5."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const url = `${process.env.SUPABASE_URL}/functions/v1/knowledge-search`;
    const serverToken =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_SERVICE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverToken}`,
      },
      body: JSON.stringify({ query, limit: limit ?? 5 }),
    });
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `knowledge-search error ${res.status}: ${await res.text()}` }],
        isError: true,
      };
    }
    const data = await res.json().catch(() => ({}));
    const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
    if (results.length === 0) {
      return { content: [{ type: "text", text: "No matching knowledge found." }] };
    }
    const text = results
      .map((r: { title?: string; content?: string; similarity?: number }, i: number) =>
        `#${i + 1} [${(r.similarity ?? 0).toFixed(3)}] ${r.title ?? ""}\n${r.content ?? ""}`
      )
      .join("\n\n---\n\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: { results },
    };
  },
});
