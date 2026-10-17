import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "ask_angel",
  title: "Ask Angel AI",
  description:
    "Ask Angel AI — the spiritual assistant of FUN Kingdom — a question. Returns Angel's reply grounded in the FUN Kingdom knowledge base (Cha Vũ Trụ doctrine, PLP protocol, Light economy, etc.).",
  inputSchema: {
    message: z.string().min(1).describe("The question or message to send to Angel AI."),
    language: z
      .enum(["vi", "en"])
      .optional()
      .describe("Preferred reply language. Defaults to Vietnamese ('vi')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ message, language }) => {
    const url = `${process.env.SUPABASE_URL}/functions/v1/angel-chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY}`,
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
