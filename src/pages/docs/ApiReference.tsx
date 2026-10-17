import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Download, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SPEC_URL = "/openapi/fun-core-v1.json";

type Endpoint = {
  method: string;
  path: string;
  group: string;
  summary: string;
};

const methodColor: Record<string, string> = {
  GET: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  POST: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  PUT: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  PATCH: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function ApiReference() {
  const [spec, setSpec] = useState<any>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch(SPEC_URL)
      .then((r) => r.json())
      .then((d) => {
        setSpec(d);
        const out: Endpoint[] = [];
        Object.entries(d.paths || {}).forEach(([path, methods]: [string, any]) => {
          Object.entries(methods).forEach(([method, op]: [string, any]) => {
            if (!["get", "post", "put", "delete", "patch"].includes(method)) return;
            out.push({
              method: method.toUpperCase(),
              path,
              group: op.tags?.[0] || "Other",
              summary: op.summary || "",
            });
          });
        });
        setEndpoints(out);
      })
      .catch(() => toast({ title: "Không tải được OpenAPI spec", variant: "destructive" }));
  }, []);

  const groups = ["ALL", ...(spec?.tags?.map((t: any) => t.name) || [])];
  const filtered = filter === "ALL" ? endpoints : endpoints.filter((e) => e.group === filter);
  const baseUrl = spec?.servers?.[0]?.url || "https://api.fun.rich/v1";

  useEffect(() => {
    document.title = "FUN Core API Reference — Angel A.I.";
  }, []);

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700]">
            FUN Core API
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {spec ? `${spec.info?.title} v${spec.info?.version} · ${endpoints.length} endpoints · ${baseUrl}` : "Đang tải spec..."}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Camly Vision → Angel A.I. → <strong>FUN Core API</strong> → Ecosystem
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          {groups.map((g) => (
            <Button key={g} size="sm" variant={filter === g ? "default" : "outline"} onClick={() => setFilter(g)}>
              {g}
              {g !== "ALL" && ` (${endpoints.filter((e) => e.group === g).length})`}
            </Button>
          ))}
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" asChild className="gap-1">
              <a href={SPEC_URL} download="fun-core-v1.json"><Download className="h-3 w-3" /> JSON</a>
            </Button>
            <Button size="sm" variant="ghost" asChild className="gap-1">
              <a href="/sdk/fun-core-sdk.js" download><Download className="h-3 w-3" /> SDK</a>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => {
              navigator.clipboard.writeText(filtered.map((e) => `${e.method} ${e.path}`).join("\n"));
              toast({ title: "Đã copy", description: `${filtered.length} endpoints` });
            }} className="gap-1">
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>
        </div>

        <Card className="p-2 mb-4">
          <div className="divide-y">
            {filtered.map((e) => (
              <div key={e.method + e.path} className="flex items-center gap-3 py-2 px-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] font-mono shrink-0 ${methodColor[e.method] ?? ""}`}>
                  {e.method}
                </Badge>
                <code className="font-mono text-xs flex-1 min-w-0 truncate">{e.path}</code>
                <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-md">{e.summary}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 mb-6">
          <h2 className="font-semibold text-sm mb-2">Quickstart</h2>
          <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded overflow-auto"><code>{`// Browser
const res = await fetch("${baseUrl}/identity/me", {
  headers: { Authorization: "Bearer <jwt>" }
});

// Embed Angel A.I.
<script src="https://angel-funrich.lovable.app/embed/angel.js"
        data-client-id="your-client-id"></script>`}</code></pre>
          <div className="mt-3 text-xs">
            <a href="/assistant/embed" className="text-primary inline-flex items-center gap-1 hover:underline">
              Hướng dẫn Embed SDK đầy đủ <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </Card>

        {/* ======= API KEY (cho app bên thứ 3) ======= */}
        <Card className="p-4 mb-6 border-[#daa520]/40">
          <h2 className="font-semibold text-base mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700]">
            🔑 API Key cho app bên thứ 3
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Tạo key tại <a className="text-primary hover:underline" href="/profile#api-keys">Profile → API Keys</a>.
            Gửi qua header <code className="bg-muted px-1 rounded">x-api-key</code>. Một key dùng chung cho chat,
            knowledge, và tạo ảnh. Không expose key ra frontend.
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold mb-1">1. Kiểm tra key & quota</h3>
              <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded overflow-auto"><code>{`curl -X GET https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/api-key-status \\
  -H "x-api-key: <YOUR_KEY>"
# → { ok, key, quota: { chat, image }, endpoints }`}</code></pre>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-1">2. Chat có Knowledge (RAG)</h3>
              <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded overflow-auto"><code>{`curl -X POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/angel-chat \\
  -H "x-api-key: <YOUR_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role":"user","content":"Cha Vũ Trụ là ai?"}],
    "useKnowledge": true,
    "stream": true
  }'`}</code></pre>
              <p className="text-[11px] text-muted-foreground mt-1">
                <code>useKnowledge</code> mặc định <code>true</code>. Đặt <code>false</code> nếu chỉ cần chat thuần task, không cần tra kho.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-1">3. Tra cứu Knowledge trực tiếp</h3>
              <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded overflow-auto"><code>{`curl -X POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/knowledge-search \\
  -H "x-api-key: <YOUR_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"PureLove Protocol", "top_k": 5}'`}</code></pre>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-1">4. Tạo ảnh</h3>
              <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded overflow-auto"><code>{`# Request
curl -X POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/generate-image \\
  -H "x-api-key: <YOUR_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"golden lotus at sunrise","mode":"fast"}'

# Response 200 (JSON thuần, KHÔNG phải SSE)
{
  "imageUrl": "https://ssjoetiitctqzapymtzl.supabase.co/storage/v1/object/public/ai-images/<uid>/<ts>-<id>-fast.jpeg",
  "description": "Ảnh đã được tạo bằng chế độ Siêu tốc ⚡",
  "prompt": "<enhanced prompt>",
  "mode": "fast"
}

# Response 429 khi hết quota
{ "error": "Đã đạt giới hạn ...", "current_usage": 500, "daily_limit": 500 }`}</code></pre>
              <p className="text-[11px] text-muted-foreground mt-1">
                <code>mode</code>: <code>"fast"</code> (Fal Flux-1 schnell, mặc định) hoặc <code>"spiritual"</code> (Gemini 2.0 Flash image).
                {" "}<code>imageUrl</code> là public URL đã upload lên Storage. Không có field <code>image_base64</code> / <code>mime</code> / <code>quota</code>.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold mb-1">5. Sửa ảnh</h3>
              <pre className="text-[11px] font-mono bg-muted/40 p-3 rounded overflow-auto"><code>{`# Request
curl -X POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/edit-image \\
  -H "x-api-key: <YOUR_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{"imageUrl":"https://...","instruction":"add divine light","style":"spiritual"}'

# Response 200
{
  "imageUrl": "https://.../ai-images/<uid>/<ts>-edit.png",
  "description": "<text mô tả từ model>",
  "instruction": "<enhanced instruction>"
}`}</code></pre>
              <p className="text-[11px] text-muted-foreground mt-1">
                <code>style</code>: <code>"spiritual"</code> (mặc định) / <code>"realistic"</code> / <code>"artistic"</code>.
                {" "}<code>imageUrl</code> chấp nhận http(s) URL hoặc data URL <code>data:image/...;base64,...</code>.
              </p>
            </div>

            <div className="text-[11px] text-muted-foreground border-t pt-3 space-y-1">
              <p><strong>Base URL:</strong> luôn là <code>https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/</code>. KHÔNG gọi qua <code>angel.fun.rich</code> (đó là frontend SPA, không proxy edge function).</p>
              <p><strong>Headers:</strong> chỉ cần <code>x-api-key</code> + <code>Content-Type: application/json</code>. Không cần <code>Authorization: Bearer</code>.</p>
              <p><strong>Quota:</strong> chat = <code>daily_limit</code> của key; ảnh = <code>image_daily_limit</code> riêng (mặc định 20/ngày, tăng theo yêu cầu). Kiểm tra qua <code>/api-key-status</code>.</p>
              <p><strong>Lỗi chuẩn:</strong> 401 <code>API_KEY_NOT_FOUND</code> / <code>API_KEY_INACTIVE</code> · 403 <code>API_KEY_EXPIRED</code> · 429 rate limit (kèm <code>current_usage</code> + <code>daily_limit</code>) · 500 khi upstream (Fal/Gemini) lỗi.</p>
              <p><strong>Chia sẻ key:</strong> quota được cộng dồn cho mọi caller dùng chung key. Tạo key riêng cho từng đối tác để tách log & giới hạn.</p>
            </div>
          </div>
        </Card>

      </main>
      <Footer />
    </>
  );
}
