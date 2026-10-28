// Phase 1+3 — Read & Semantic Search tools for Coordinator Gate.
// Actions: read_file, search_repo, search_symbol, search_route, search_i18n_key.
// Whitelist: only paths inside src/**. Cache TTL 5 min.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const cache = new Map<string, { ts: number; data: any }>();
const TTL_MS = 5 * 60 * 1000;

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > TTL_MS) { cache.delete(key); return null; }
  return hit.data;
}
function cacheSet(key: string, data: any) {
  if (cache.size > 200) cache.clear();
  cache.set(key, { ts: Date.now(), data });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData } = await userClient.auth.getClaims(token);
    if (!claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role").eq("user_id", userId)
      .in("role", ["coordinator", "admin"]);
    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Coordinator access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pat = Deno.env.get("GITHUB_PAT_READ");
    const owner = Deno.env.get("GH_REPO_OWNER");
    const repo = Deno.env.get("GH_REPO_NAME");
    if (!pat || !owner || !repo) {
      return new Response(JSON.stringify({ error: "GitHub PAT/repo not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "read_file") {
      const path = String(body?.path || "");
      if (!path.startsWith("src/") || path.includes("..")) {
        return new Response(JSON.stringify({ error: "Path must be inside src/**" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cacheKey = `read:${path}`;
      const hit = cacheGet(cacheKey);
      if (hit) return new Response(JSON.stringify(hit), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

      // Use contents API to get sha + content
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=main`;
      const ghResp = await fetch(apiUrl, {
        headers: {
          Authorization: `token ${pat}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "angel-coordinator-repo-read",
        },
      });
      if (!ghResp.ok) {
        const txt = await ghResp.text();
        return new Response(JSON.stringify({ error: "GitHub fetch failed", status: ghResp.status, detail: txt.slice(0, 500) }), {
          status: ghResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const meta = await ghResp.json();
      let content = "";
      if (meta?.content && meta?.encoding === "base64") {
        content = atob(meta.content.replace(/\n/g, ""));
      }
      // Cap 2000 lines
      const lines = content.split("\n");
      const truncated = lines.length > 2000;
      if (truncated) content = lines.slice(0, 2000).join("\n");

      const out = { path, content, sha: meta?.sha, truncated, total_lines: lines.length };
      cacheSet(cacheKey, out);
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "search_repo") {
      const query = String(body?.query || "").trim();
      if (!query) {
        return new Response(JSON.stringify({ error: "query required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cacheKey = `search:${query}`;
      const hit = cacheGet(cacheKey);
      if (hit) return new Response(JSON.stringify(hit), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

      const q = `${query}+repo:${owner}/${repo}+path:src`;
      const apiUrl = `https://api.github.com/search/code?q=${encodeURIComponent(q).replace(/%2B/g, "+").replace(/%3A/g, ":")}&per_page=20`;
      const ghResp = await fetch(apiUrl, {
        headers: {
          Authorization: `token ${pat}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "angel-coordinator-repo-read",
        },
      });
      if (!ghResp.ok) {
        const txt = await ghResp.text();
        return new Response(JSON.stringify({ error: "GitHub search failed", status: ghResp.status, detail: txt.slice(0, 500) }), {
          status: ghResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await ghResp.json();
      const items = (data?.items || []).slice(0, 20).map((it: any) => ({
        path: it.path,
        name: it.name,
        score: it.score,
        url: it.html_url,
      }));
      const out = { query, total_count: data?.total_count ?? items.length, items };
      cacheSet(cacheKey, out);
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===================== Phase 3 — Semantic Search =====================

    // Shared GitHub helpers
    const ghHeaders = {
      Authorization: `token ${pat}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "angel-coordinator-repo-read",
    };

    async function ghReadFile(path: string): Promise<string | null> {
      const cKey = `read:${path}`;
      const hit = cacheGet(cKey);
      if (hit?.content !== undefined) return hit.content as string;
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=main`;
      const r = await fetch(url, { headers: ghHeaders });
      if (!r.ok) return null;
      const meta = await r.json();
      if (meta?.content && meta?.encoding === "base64") {
        const content = atob(meta.content.replace(/\n/g, ""));
        cacheSet(cKey, { path, content, sha: meta?.sha, truncated: false, total_lines: content.split("\n").length });
        return content;
      }
      return null;
    }

    async function ghTreeSrc(): Promise<string[]> {
      const cKey = "tree:src";
      const hit = cacheGet(cKey);
      if (hit) return hit as string[];
      const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
      const r = await fetch(url, { headers: ghHeaders });
      if (!r.ok) return [];
      const j = await r.json();
      const paths = (j?.tree || [])
        .filter((n: any) => n.type === "blob" && typeof n.path === "string" && n.path.startsWith("src/"))
        .map((n: any) => n.path as string);
      cacheSet(cKey, paths);
      return paths;
    }

    async function ghCodeSearch(query: string): Promise<{ ok: boolean; status: number; items: any[] }> {
      const q = `${query}+repo:${owner}/${repo}+path:src`;
      const url = `https://api.github.com/search/code?q=${encodeURIComponent(q).replace(/%2B/g, "+").replace(/%3A/g, ":")}&per_page=20`;
      const r = await fetch(url, {
        headers: { ...ghHeaders, Accept: "application/vnd.github.v3.text-match+json" },
      });
      if (!r.ok) return { ok: false, status: r.status, items: [] };
      const j = await r.json();
      return { ok: true, status: 200, items: j?.items || [] };
    }

    function clipSnippet(text: string, maxBytes = 2048, maxLines = 40): string {
      const lines = text.split("\n").slice(0, maxLines);
      let out = lines.join("\n");
      if (out.length > maxBytes) out = out.slice(0, maxBytes) + "\n…(truncated)";
      else if (text.split("\n").length > maxLines) out += "\n…(truncated)";
      return out;
    }

    // ---------- search_symbol (4 strategies) ----------
    if (action === "search_symbol") {
      const symbol = String(body?.symbol || "").trim();
      const kind = String(body?.kind || "").trim(); // optional
      if (!symbol || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(symbol)) {
        return new Response(JSON.stringify({ error: "symbol must be a valid identifier" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cKey = `sym2:${symbol}:${kind}`;
      const hit = cacheGet(cKey);
      if (hit) return new Response(JSON.stringify(hit), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const collected: any[] = [];
      const seen = new Set<string>();
      let rateLimited = false;
      const sourcesUsed: string[] = [];

      function push(item: any) {
        const key = `${item.path}#${item.line ?? 0}`;
        if (seen.has(key)) return;
        seen.add(key);
        collected.push(item);
      }

      // Strategy A — GitHub Code Search (export pattern)
      const patterns = [
        `"export default function ${symbol}"`,
        `"export function ${symbol}"`,
        `"export const ${symbol}"`,
        `"export type ${symbol}"`,
        `"export interface ${symbol}"`,
        `"export class ${symbol}"`,
      ];
      for (const p of patterns) {
        if (collected.length >= 10) break;
        const r = await ghCodeSearch(p);
        if (!r.ok) {
          if (r.status === 403 || r.status === 429) rateLimited = true;
          continue;
        }
        if (!sourcesUsed.includes("export_pattern")) sourcesUsed.push("export_pattern");
        for (const it of r.items) {
          const tm = (it.text_matches || [])[0];
          push({
            path: it.path,
            line: null,
            snippet: tm?.fragment ? clipSnippet(tm.fragment) : "",
            kind: kind || "unknown",
            match_kind: "export_pattern",
          });
          if (collected.length >= 10) break;
        }
      }

      // Strategies B/C/D need the file tree
      let tree: string[] = [];
      try { tree = await ghTreeSrc(); } catch { /* noop */ }
      const codeFiles = tree.filter((p) => /\.(ts|tsx|js|jsx)$/.test(p));
      const lcSymbol = symbol.toLowerCase();

      // Strategy B — filename match (case-insensitive)
      const variants = Array.from(new Set([
        symbol,
        `${symbol}Section`,
        `${symbol}Component`,
        `Home${symbol}`,
        `Landing${symbol}`,
        `Main${symbol}`,
        `${symbol}Block`,
      ]));
      const variantsLc = variants.map((v) => v.toLowerCase());
      for (const path of codeFiles) {
        if (collected.length >= 10) break;
        const base = (path.split("/").pop() || "").replace(/\.(ts|tsx|js|jsx)$/, "");
        const baseLc = base.toLowerCase();
        if (variantsLc.includes(baseLc) || baseLc === lcSymbol) {
          if (!sourcesUsed.includes("filename")) sourcesUsed.push("filename");
          push({
            path,
            line: 1,
            snippet: `// filename match: ${base}`,
            kind: kind || "unknown",
            match_kind: "filename",
          });
        }
      }

      // Strategy C — fallback grep for export of any variant
      if (collected.length < 5) {
        try {
          const reList = variants.map((v) => new RegExp(`export\\s+(?:default\\s+function|function|const|class|type|interface)\\s+${v}\\b`));
          const MAX_FETCH = 60;
          let fetched = 0;
          // Prioritize files whose name contains the symbol substring
          const sorted = [...codeFiles].sort((a, b) => {
            const aHit = (a.split("/").pop() || "").toLowerCase().includes(lcSymbol) ? 0 : 1;
            const bHit = (b.split("/").pop() || "").toLowerCase().includes(lcSymbol) ? 0 : 1;
            return aHit - bHit;
          });
          for (const path of sorted) {
            if (collected.length >= 10 || fetched >= MAX_FETCH) break;
            const baseHit = (path.split("/").pop() || "").toLowerCase().includes(lcSymbol);
            if (!baseHit && fetched > 25) continue;
            fetched++;
            const content = await ghReadFile(path);
            if (!content) continue;
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (reList.some((re) => re.test(lines[i]))) {
                if (!sourcesUsed.includes("grep_export")) sourcesUsed.push("grep_export");
                const snipStart = Math.max(0, i - 1);
                const snipEnd = Math.min(lines.length, i + 8);
                push({
                  path,
                  line: i + 1,
                  snippet: clipSnippet(lines.slice(snipStart, snipEnd).join("\n")),
                  kind: kind || "unknown",
                  match_kind: "grep_export",
                });
                break;
              }
            }
          }
        } catch (e) {
          console.warn("[search_symbol] grep_export error", e);
        }
      }

      // Strategy D — JSX section comments `{/* Symbol */}` or `// Symbol section`
      if (collected.length < 5) {
        try {
          // Focus on pages/sections likely to contain JSX comments
          const focused = codeFiles.filter((p) =>
            p.startsWith("src/pages/") || p.startsWith("src/components/")
          );
          const reJsx = new RegExp(`\\{\\s*/\\*\\s*${symbol}\\b[^*]*\\*/\\s*\\}`, "i");
          const reLine = new RegExp(`//\\s*${symbol}\\b.*(section|block)?`, "i");
          const MAX_FETCH = 40;
          let fetched = 0;
          for (const path of focused) {
            if (collected.length >= 10 || fetched >= MAX_FETCH) break;
            fetched++;
            const content = await ghReadFile(path);
            if (!content) continue;
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (reJsx.test(lines[i]) || reLine.test(lines[i])) {
                if (!sourcesUsed.includes("jsx_comment")) sourcesUsed.push("jsx_comment");
                const snipStart = Math.max(0, i - 1);
                const snipEnd = Math.min(lines.length, i + 10);
                push({
                  path,
                  line: i + 1,
                  snippet: clipSnippet(lines.slice(snipStart, snipEnd).join("\n")),
                  kind: kind || "unknown",
                  match_kind: "jsx_comment",
                });
                break;
              }
            }
          }
        } catch (e) {
          console.warn("[search_symbol] jsx_comment error", e);
        }
      }

      const out = {
        symbol,
        kind: kind || null,
        sources_used: sourcesUsed,
        source: sourcesUsed[0] || "none",
        rate_limited: rateLimited,
        total: collected.length,
        items: collected.slice(0, 10),
      };
      cacheSet(cKey, out);
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- search_route ----------
    if (action === "search_route") {
      const wantPath = String(body?.path || "").trim();
      const wantPage = String(body?.page_name || "").trim();
      const cKey = `route:${wantPath}:${wantPage}`;
      const hit = cacheGet(cKey);
      if (hit) return new Response(JSON.stringify(hit), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const tree = await ghTreeSrc();
      const routerFiles = new Set<string>([
        "src/App.tsx", "src/App.jsx", "src/main.tsx", "src/main.jsx",
      ]);
      for (const p of tree) {
        if (/^src\/(routes|router)\//.test(p) && /\.(ts|tsx|js|jsx)$/.test(p)) routerFiles.add(p);
      }

      const routeRe = /<Route\s+[^>]*?path=["']([^"']+)["'][^>]*?element=\{\s*<\s*([A-Za-z0-9_]+)/g;
      const objRouteRe = /\{\s*path:\s*["']([^"']+)["'][^}]*?(?:element|Component|component):\s*<?\s*([A-Za-z0-9_]+)/g;

      const importMap = new Map<string, string>(); // CompName -> file
      const collected: any[] = [];

      for (const file of routerFiles) {
        const content = await ghReadFile(file);
        if (!content) continue;
        // Collect imports
        const impRe = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+["']([^"']+)["']/g;
        let im: RegExpExecArray | null;
        while ((im = impRe.exec(content)) !== null) {
          const target = im[3];
          // resolve @/ alias and relative-ish to a src/ path candidate
          let resolved: string | null = null;
          if (target.startsWith("@/")) resolved = "src/" + target.slice(2);
          else if (target.startsWith("./") || target.startsWith("../")) {
            const baseDir = file.split("/").slice(0, -1).join("/");
            const parts = (baseDir + "/" + target).split("/");
            const stack: string[] = [];
            for (const seg of parts) {
              if (seg === "" || seg === ".") continue;
              if (seg === "..") stack.pop();
              else stack.push(seg);
            }
            resolved = stack.join("/");
          }
          if (!resolved) continue;
          // Add .tsx/.ts guess
          const candidates = [resolved + ".tsx", resolved + ".ts", resolved + "/index.tsx", resolved + "/index.ts", resolved];
          const found = candidates.find((c) => tree.includes(c));
          const finalPath = found || resolved;
          if (im[2]) importMap.set(im[2], finalPath);
          if (im[1]) {
            for (const n of im[1].split(",")) {
              const name = n.trim().split(/\s+as\s+/)[0].trim();
              if (name) importMap.set(name, finalPath);
            }
          }
        }
        for (const re of [routeRe, objRouteRe]) {
          re.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(content)) !== null) {
            const route_path = m[1];
            const component_name = m[2];
            if (wantPath && route_path !== wantPath) continue;
            if (wantPage && component_name.toLowerCase() !== wantPage.toLowerCase()) continue;
            collected.push({
              route_path,
              component_name,
              component_file: importMap.get(component_name) || null,
              defined_in: file,
            });
            if (collected.length >= 10) break;
          }
          if (collected.length >= 10) break;
        }
        if (collected.length >= 10) break;
      }

      const out = {
        filter: { path: wantPath || null, page_name: wantPage || null },
        scanned_files: Array.from(routerFiles),
        total: collected.length,
        items: collected.slice(0, 10),
      };
      cacheSet(cKey, out);
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------- search_i18n_key ----------
    if (action === "search_i18n_key") {
      const key = String(body?.key || "").trim();
      const onlyLang = String(body?.lang || "").trim().toLowerCase();
      if (!key) {
        return new Response(JSON.stringify({ error: "key required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const cKey = `i18n:${key}:${onlyLang}`;
      const hit = cacheGet(cKey);
      if (hit) return new Response(JSON.stringify(hit), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const tree = await ghTreeSrc();
      const transFiles = tree.filter((p) => /^src\/translations\/[^/]+\.ts$/.test(p));
      const segments = key.split(".");
      const foundIn: any[] = [];
      const missingIn: string[] = [];

      function escRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

      for (const file of transFiles) {
        const lang = (file.match(/\/([^/]+)\.ts$/) || [])[1] || file;
        if (onlyLang && lang !== onlyLang) continue;
        const content = await ghReadFile(file);
        if (!content) { missingIn.push(lang); continue; }

        // Try literal "a.b.c": "value"
        const litRe = new RegExp(`["']${escRe(key)}["']\\s*:\\s*(["'\`])([^\\1]*?)\\1`);
        const litM = content.match(litRe);
        let value: string | null = null;
        if (litM) {
          value = litM[2];
        } else {
          // Walk nested objects: find segment by segment scanning from cursor
          let cursor = 0;
          let ok = true;
          for (let s = 0; s < segments.length; s++) {
            const seg = segments[s];
            const isLast = s === segments.length - 1;
            if (isLast) {
              const re = new RegExp(`(?:["']?)${escRe(seg)}(?:["']?)\\s*:\\s*(["'\`])([\\s\\S]*?)\\1`, "g");
              re.lastIndex = cursor;
              const m = re.exec(content);
              if (!m) { ok = false; break; }
              value = m[2];
            } else {
              const re = new RegExp(`(?:["']?)${escRe(seg)}(?:["']?)\\s*:\\s*\\{`, "g");
              re.lastIndex = cursor;
              const m = re.exec(content);
              if (!m) { ok = false; break; }
              cursor = m.index + m[0].length;
            }
          }
          if (!ok) value = null;
        }

        if (value !== null) {
          foundIn.push({
            lang, file,
            has_value: value.length > 0,
            value_preview: value.length > 120 ? value.slice(0, 120) + "…" : value,
          });
        } else {
          missingIn.push(lang);
        }
      }

      const out = {
        key,
        normalized_path: segments,
        scanned_langs: transFiles.length,
        found_in: foundIn,
        missing_in: missingIn,
        fallback_hint: missingIn.length > 0 ? "Missing langs will render English fallback via LanguageContext." : null,
      };
      cacheSet(cKey, out);
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'read_file' | 'search_repo' | 'search_symbol' | 'search_route' | 'search_i18n_key'." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[coordinator-repo-read] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
