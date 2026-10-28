import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("LIBRARY_EXPORT_KEY");
  if (!expected) return json({ error: "Export key not configured" }, 500);

  const provided = req.headers.get("x-export-key") ?? "";
  if (provided.length !== expected.length || provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "500", 10) || 500, 1), 1000);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error, count } = await supabase
    .from("knowledge_documents")
    .select(
      "id, title, source, file_url, file_type, file_size, created_at, knowledge_folders(name)",
      { count: "exact" },
    )
    .eq("knowledge_status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("library-export query error:", error);
    return json({ error: "Query failed" }, 500);
  }

  const documents = (data ?? []).map((d: any) => ({
    id: d.id,
    title: d.title,
    folder_name: d.knowledge_folders?.name ?? null,
    source: d.source,
    file_url: d.file_url,
    mime_type: d.file_type,
    file_size: d.file_size,
    created_at: d.created_at,
  }));

  return json({ total: count ?? documents.length, limit, offset, documents });
});
