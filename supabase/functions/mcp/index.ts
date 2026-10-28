// Auto-generated from MCP source, kept deploy-safe for Supabase Edge.
// supabase function: mcp
import { defineMcp, defineTool } from "npm:@lovable.dev/mcp-js@0.20.0";
import { createSupabaseHandler } from "npm:@lovable.dev/mcp-js@0.20.0/stacks/supabase";
import { createClient } from "npm:@supabase/supabase-js@^2.90.1";
import { z } from "npm:zod@^3.25.76";

const serverToken = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;

const askAngel = defineTool({
  name: "ask_angel",
  title: "Ask Angel AI",
  description:
    "Ask Angel AI, the spiritual assistant of FUN Kingdom, a question. Returns Angel's reply grounded in the FUN Kingdom knowledge base.",
  inputSchema: {
    message: z.string().min(1).describe("The question or message to send to Angel AI."),
    language: z.enum(["vi", "en"]).optional().describe("Preferred reply language. Defaults to Vietnamese."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ message, language }) => {
    const url = `${process.env.SUPABASE_URL}/functions/v1/angel-chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverToken()}`,
      },
      body: JSON.stringify({ message, context: "mcp_external", language: language ?? "vi" }),
    });
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `angel-chat error ${res.status}: ${await res.text()}` }],
        isError: true,
      };
    }
    const data = await res.json().catch(() => ({}));
    const reply = data?.reply ?? data?.response ?? data?.content ?? JSON.stringify(data);
    return { content: [{ type: "text", text: String(reply) }] };
  },
});

const searchKnowledge = defineTool({
  name: "search_knowledge",
  title: "Search FUN Kingdom knowledge",
  description:
    "Semantic search over Angel AI's public knowledge base. Returns the most relevant chunks with similarity scores.",
  inputSchema: {
    query: z.string().min(1).describe("Natural-language search query."),
    limit: z.number().int().min(1).max(10).optional().describe("Max chunks to return. Default 5."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const url = `${process.env.SUPABASE_URL}/functions/v1/knowledge-search`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverToken()}`,
      },
      body: JSON.stringify({ query, top_k: limit ?? 5 }),
    });
    if (!res.ok) {
      return {
        content: [{ type: "text", text: `knowledge-search error ${res.status}: ${await res.text()}` }],
        isError: true,
      };
    }
    const data = await res.json().catch(() => ({}));
    const results = Array.isArray(data?.chunks)
      ? data.chunks
      : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];
    if (results.length === 0) {
      return { content: [{ type: "text", text: "No matching knowledge found." }] };
    }
    const text = results
      .map((r: { doc_title?: string; title?: string; chunk_text?: string; content?: string; similarity?: number }, i: number) =>
        `#${i + 1} [${(r.similarity ?? 0).toFixed(3)}] ${r.doc_title ?? r.title ?? ""}\n${r.chunk_text ?? r.content ?? ""}`
      )
      .join("\n\n---\n\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: { results },
    };
  },
});

const getPublicProfile = defineTool({
  name: "get_public_profile",
  title: "Get public FUN profile",
  description: "Look up a FUN Kingdom member's public profile by handle.",
  inputSchema: {
    handle: z.string().min(1).describe("The member's public handle, without the @."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ handle }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const clean = handle.trim().replace(/^@/, "").toLowerCase();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, bio, avatar_url, active_title, ascension_tier")
      .eq("handle", clean)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: `lookup error: ${error.message}` }], isError: true };
    }
    if (!data) {
      return { content: [{ type: "text", text: `No public profile found for @${clean}.` }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});

const mcp = defineMcp({
  name: "angel-fun-kingdom-mcp",
  title: "Angel AI FUN Kingdom",
  version: "0.1.0",
  instructions:
    "Tools for Angel AI. Use ask_angel for grounded conversational answers, search_knowledge for raw semantic search, and get_public_profile to look up a member by handle.",
  tools: [askAngel, searchKnowledge, getPublicProfile],
});

Deno.serve(createSupabaseHandler(mcp, { functionName: "mcp" }));
