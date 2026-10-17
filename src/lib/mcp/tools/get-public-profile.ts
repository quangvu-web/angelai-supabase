import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "get_public_profile",
  title: "Get public FUN profile",
  description:
    "Look up a FUN Kingdom member's public profile by handle (e.g. 'camly'). Returns display name, bio, and public Light metrics only. No private data.",
  inputSchema: {
    handle: z.string().min(1).describe("The member's public handle, without the '@'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ handle }) => {
    const clean = handle.trim().replace(/^@/, "").toLowerCase();
    const { data, error } = await sb()
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
