// Angel AI — Knowledge Export API (READ-ONLY, server-to-server)
//
// Routes (base: /functions/v1/knowledge-export):
//   GET  /items                      list knowledge items (keyset pagination)
//   GET  /items/:external_id         one item by stable document id
//   GET  /collections                folder inventory
//
// Auth: Authorization: Bearer <ANGEL_AI_EXPORT_TOKEN>
// No write operations exist in this function.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXPORT_TOKEN = Deno.env.get("ANGEL_AI_EXPORT_TOKEN") ?? "";
// Optional secondary token to allow zero-downtime rotation.
const EXPORT_TOKEN_NEXT = Deno.env.get("ANGEL_AI_EXPORT_TOKEN_NEXT") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const fail = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status);

// ── constant-time compare ────────────────────────────────────────────
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── simple in-memory rate limit (per instance): 120 req / 60s ────────
const RATE_MAX = 120;
const RATE_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  b.count++;
  return b.count > RATE_MAX;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input.trim().normalize("NFC"));
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(updatedAt: string, id: string): string {
  return btoa(`${updatedAt}|${id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeCursor(cursor: string): { updated_at: string; id: string } | null {
  try {
    const pad = cursor.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
    const [updated_at, id] = raw.split("|");
    if (!updated_at || !UUID_RE.test(id ?? "")) return null;
    if (Number.isNaN(Date.parse(updated_at))) return null;
    return { updated_at, id };
  } catch {
    return null;
  }
}

const SELECT_COLS = `
  id, title, extracted_content, file_name, file_url, file_type, file_size,
  source, source_ref, source_url, content_hash, metadata, language,
  knowledge_status, version, version_group_id, supersedes_document_id,
  deprecated_at, deleted_at, created_at, updated_at, folder_id,
  knowledge_folders ( id, name, slug, platform_key, parent_id )
`;

async function shapeItem(row: any) {
  const content: string = row.extracted_content ?? "";
  const folder = row.knowledge_folders ?? null;
  const hash = row.content_hash ?? (content ? await sha256Hex(content) : null);
  return {
    external_id: row.id,
    title: row.title ?? null,
    content, // plain data string — never rendered/executed here
    content_type: content ? "text/plain" : null,
    collection: {
      folder_id: row.folder_id ?? null,
      folder_name: folder?.name ?? null,
      folder_slug: folder?.slug ?? null,
      category: folder?.platform_key ?? null,
      parent_folder_id: folder?.parent_id ?? null,
    },
    language: row.language ?? null,
    source: row.source ?? null,
    source_ref: row.source_ref ?? null,
    source_url: row.source_url ?? null,
    original_file_url: row.file_url ?? null,
    file_url: row.file_url ?? null,
    file_name: row.file_name ?? null,
    mime_type: row.file_type ?? null,
    file_size: row.file_size ?? null,
    metadata: row.metadata ?? null,
    content_hash: hash,
    content_hash_source: row.content_hash ? "stored" : content ? "computed" : "none",
    created_at: row.created_at,
    updated_at: row.updated_at,
    knowledge_status: row.knowledge_status ?? null,
    version: row.version ?? null,
    version_group_id: row.version_group_id ?? null,
    supersedes_document_id: row.supersedes_document_id ?? null,
    deprecated_at: row.deprecated_at ?? null,
    deleted_at: row.deleted_at ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return fail(405, "method_not_allowed", "This export API is read-only; use GET.");

  if (!EXPORT_TOKEN && !EXPORT_TOKEN_NEXT) return fail(500, "not_configured", "Export token is not configured.");

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const authorized =
    !!token &&
    ((!!EXPORT_TOKEN && safeEqual(token, EXPORT_TOKEN)) ||
      (!!EXPORT_TOKEN_NEXT && safeEqual(token, EXPORT_TOKEN_NEXT)));
  if (!authorized) {
    return fail(401, "unauthorized", "Missing or invalid bearer token.");
  }


  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return fail(429, "rate_limited", "Too many requests. Limit 120/minute.");

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("knowledge-export");
  const seg = idx >= 0 ? parts.slice(idx + 1) : parts;
  const route = seg[0] ?? "";

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── /collections ───────────────────────────────────────────────────
  if (route === "collections") {
    const { data: folders, error: fErr } = await supabase
      .from("knowledge_folders")
      .select("id, name, slug, platform_key, parent_id, updated_at")
      .order("name", { ascending: true });
    if (fErr) {
      console.error("collections folders error:", fErr);
      return fail(500, "query_failed", "Could not load collections.");
    }

    const { data: counts, error: cErr } = await supabase.rpc("knowledge_export_collection_counts");
    if (cErr) {
      console.error("collections counts error:", cErr);
      return fail(500, "query_failed", "Could not load collection counts.");
    }
    const byId = new Map<string, any>();
    for (const c of (counts ?? []) as any[]) byId.set(c.folder_id ?? "null", c);

    const collections = (folders ?? []).map((f: any) => {
      const c = byId.get(f.id) ?? {};
      return {
        folder_id: f.id,
        folder_name: f.name,
        folder_slug: f.slug ?? null,
        category: f.platform_key ?? null,
        parent_folder_id: f.parent_id ?? null,
        item_count: Number(c.item_count ?? 0),
        active_count: Number(c.active_count ?? 0),
        updated_at: c.last_updated_at ?? f.updated_at ?? null,
      };
    });
    const un = byId.get("null");
    if (un) {
      collections.push({
        folder_id: null,
        folder_name: "(uncategorized)",
        folder_slug: null,
        category: null,
        parent_folder_id: null,
        item_count: Number(un.item_count ?? 0),
        active_count: Number(un.active_count ?? 0),
        updated_at: un.last_updated_at ?? null,
      });
    }
    return json({ total: collections.length, collections });
  }

  // ── /items and /items/:external_id ─────────────────────────────────
  if (route === "items") {
    const externalId = seg[1];

    if (externalId) {
      if (!UUID_RE.test(externalId)) return fail(400, "invalid_external_id", "external_id must be a UUID.");
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select(SELECT_COLS)
        .eq("id", externalId)
        .maybeSingle();
      if (error) {
        console.error("item query error:", error);
        return fail(500, "query_failed", "Could not load item.");
      }
      if (!data) return fail(404, "not_found", "Knowledge item not found.");
      return json({ item: await shapeItem(data) });
    }

    // query params
    const q = url.searchParams;
    const limitRaw = parseInt(q.get("limit") ?? "", 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT, 1), MAX_LIMIT);

    const collection = (q.get("collection") ?? q.get("folder_id") ?? "").trim();
    if (collection && !UUID_RE.test(collection)) {
      return fail(400, "invalid_collection", "collection/folder_id must be a UUID.");
    }
    const language = (q.get("language") ?? "").trim().slice(0, 16);
    if (language && !/^[a-zA-Z-]{2,16}$/.test(language)) {
      return fail(400, "invalid_language", "language must be a short language code.");
    }
    const updatedAfter = (q.get("updated_after") ?? "").trim();
    if (updatedAfter && Number.isNaN(Date.parse(updatedAfter))) {
      return fail(400, "invalid_updated_after", "updated_after must be an ISO-8601 timestamp.");
    }
    const includeDeleted = q.get("include_deleted") === "true";
    const includeDeprecated = q.get("include_deprecated") === "true";
    const cursorRaw = q.get("cursor");
    const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
    if (cursorRaw && !cursor) return fail(400, "invalid_cursor", "cursor is malformed.");

    let query = supabase
      .from("knowledge_documents")
      .select(SELECT_COLS)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit + 1);

    if (!includeDeleted) query = query.is("deleted_at", null);
    if (!includeDeprecated) query = query.neq("knowledge_status", "deprecated");
    if (collection) query = query.eq("folder_id", collection);
    if (language) query = query.eq("language", language);
    if (updatedAfter) query = query.gt("updated_at", new Date(updatedAfter).toISOString());
    if (cursor) {
      // keyset: (updated_at, id) strictly greater than cursor — deterministic, no gaps/dupes
      query = query.or(
        `updated_at.gt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},id.gt.${cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error("items query error:", error);
      return fail(500, "query_failed", "Could not load items.");
    }

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items = await Promise.all(page.map(shapeItem));
    const last = page[page.length - 1] as any | undefined;

    return json({
      items,
      count: items.length,
      limit,
      has_more: hasMore,
      next_cursor: hasMore && last ? encodeCursor(last.updated_at, last.id) : null,
      filters: {
        collection: collection || null,
        language: language || null,
        updated_after: updatedAfter || null,
        include_deleted: includeDeleted,
        include_deprecated: includeDeprecated,
      },
    });
  }

  return fail(404, "unknown_route", "Use /items, /items/:external_id or /collections.");
});
