import { useState, useEffect } from "react";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Play, ExternalLink, Code2, Package, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const SDK_URL = "https://angel-funrich.lovable.app/sdk/fun-core-sdk.js";
const SPEC_URL = "https://angel-funrich.lovable.app/openapi/fun-core-v1.json";

const iframeSnippet = `<!-- Embed Angel Assistant -->
<iframe
  src="https://angel-funrich.lovable.app/chat?embed=1"
  width="380" height="560"
  style="border:0;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.12)"
  allow="clipboard-write"
></iframe>`;

const sdkScript = `<!-- 1. Load FUN Core SDK -->
<script src="${SDK_URL}"></script>

<!-- 2. Init + call API -->
<script>
  (async () => {
    const fun = await FunCore.init({
      // token: '<supabase user JWT>',     // bearerAuth
      // apiKey: '<ANGEL_AI_INGEST_KEY>',  // service-to-service
    });

    // Public endpoints — no auth required
    const profile = await fun.profile.get('camly');
    const light   = await fun.pplp.light(profile.id);

    console.log('FUN ID:', profile.fun_id, '| Light:', light);
  })();
</script>`;

const esmScript = `import FunCore from '${SDK_URL}';

const fun = await FunCore.init({ token: session.access_token });
const balance = await fun.wallet.balance(userId);
const quests  = await fun.game.questToday();`;

const lowLevelSnippet = `// For endpoints not yet wrapped: use .request()
await fun.request('POST', '/pplp/score', {
  body: { user_id, action: 'daily_quest', score: 4.2 },
});`;

function CodeBlock({ code }: { code: string }) {
  const copy = () => {
    navigator.clipboard.writeText(code);
    toast({ title: "Đã sao chép" });
  };
  return (
    <div className="relative">
      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre">{code}</pre>
      <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-7 w-7 p-0" onClick={copy}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function EmbedSDK() {
  const [funId, setFunId] = useState("camly");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [endpointCount, setEndpointCount] = useState<number | null>(null);

  // Auto-load spec count once on mount so the hero badge always matches reality
  useEffect(() => {
    fetch("/openapi/fun-core-v1.json")
      .then((r) => r.json())
      .then((spec: any) => {
        const n = Object.values(spec.paths || {}).reduce(
          (acc: number, methods: any) =>
            acc +
            Object.keys(methods).filter((k) =>
              ["get", "post", "put", "patch", "delete"].includes(k)
            ).length,
          0
        );
        setEndpointCount(Number(n));
      })
      .catch(() => {});
  }, []);

  const runDemo = async () => {
    setLoading(true);
    setResult("");
    try {
      // Inject SDK script tag once
      if (!(window as any).FunCore) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "/sdk/fun-core-sdk.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load SDK"));
          document.head.appendChild(s);
        });
      }
      const FunCore = (window as any).FunCore;
      if (!FunCore) throw new Error("SDK not loaded");
      const fun = await FunCore.init({ specUrl: "/openapi/fun-core-v1.json" });
      const eps = fun.listEndpoints();
      setResult(
        `✓ SDK v${FunCore.version} loaded\n` +
        `✓ Spec: ${fun.info().title} v${fun.info().version}\n` +
        `✓ ${eps.length} endpoints discovered\n\n` +
        `Sample namespaces:\n` +
        `  fun.profile.get('${funId}')\n` +
        `  fun.pplp.light(userId)\n` +
        `  fun.wallet.balance(userId)\n` +
        `  fun.game.questToday()`
      );
    } catch (e: any) {
      setResult("✗ " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CorePageShell
      title="FUN Core Embed SDK"
      subtitle="Một SDK · Một spec · Cả hệ sinh thái FUN"
      requireRole={false}
    >
      <div className="space-y-4">
        {/* Hero */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary"><Package className="h-3 w-3 mr-1" /> v1.0.0</Badge>
            <Badge variant="outline"><Globe className="h-3 w-3 mr-1" /> Vanilla JS · ESM · Browser</Badge>
            <Badge variant="outline">
              {endpointCount !== null ? `${endpointCount} endpoints` : "Loading…"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            SDK đọc thẳng OpenAPI spec <code className="text-xs">/openapi/fun-core-v1.json</code> để các trang trong FUN Ecosystem
            (Fun.Rich, LoveHUB, Academy, Farm, Charity) cùng nói một ngôn ngữ với Angel A.I. Core.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button asChild size="sm" variant="outline">
              <a href={SDK_URL} target="_blank" rel="noreferrer"><Code2 className="h-3.5 w-3.5 mr-1.5" />fun-core-sdk.js</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={SPEC_URL} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />OpenAPI spec</a>
            </Button>
          </div>
        </Card>

        <Tabs defaultValue="sdk" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="sdk">JS SDK</TabsTrigger>
            <TabsTrigger value="iframe">Iframe</TabsTrigger>
            <TabsTrigger value="demo">Live Demo</TabsTrigger>
          </TabsList>

          <TabsContent value="sdk" className="space-y-4 mt-4">
            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">1. Script tag (CDN)</div>
              <CodeBlock code={sdkScript} />
            </Card>

            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">2. ES module import</div>
              <CodeBlock code={esmScript} />
            </Card>

            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">3. Low-level escape hatch</div>
              <CodeBlock code={lowLevelSnippet} />
              <p className="text-xs text-muted-foreground">
                Mỗi endpoint trong OpenAPI đều gọi được qua <code>fun.request(method, path, opts)</code>.
              </p>
            </Card>

            <Card className="p-4 space-y-2">
              <div className="text-sm font-semibold">Namespaces có sẵn</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  ["auth", "login · oauth"],
                  ["profile", "get"],
                  ["identity", "trust"],
                  ["pplp", "score · preview · light · claim"],
                  ["wallet", "balance · withdraw · gift"],
                  ["game", "questToday · claimQuest · lantern"],
                  ["ai", "chat · embed"],
                  ["admin", "runMintCycle · resolveFraud"],
                ].map(([ns, fns]) => (
                  <div key={ns} className="border rounded p-2">
                    <div className="font-mono font-semibold text-primary">fun.{ns}</div>
                    <div className="text-muted-foreground">{fns}</div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="iframe" className="space-y-4 mt-4">
            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">Nhúng Angel Chat làm widget</div>
              <CodeBlock code={iframeSnippet} />
              <p className="text-xs text-muted-foreground">
                Cách nhanh nhất — không cần SDK. Phù hợp cho landing page, blog, hoặc app chưa tích hợp sâu.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="demo" className="space-y-4 mt-4">
            <Card className="p-4 space-y-3">
              <div className="text-sm font-semibold">Thử SDK ngay trong trình duyệt</div>
              <div className="flex gap-2 items-center">
                <Input
                  value={funId}
                  onChange={(e) => setFunId(e.target.value)}
                  placeholder="FUN ID (vd: camly)"
                  className="max-w-xs"
                />
                <Button size="sm" onClick={runDemo} disabled={loading}>
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {loading ? "Đang chạy..." : "Run"}
                </Button>
              </div>
              {result && (
                <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">{result}</pre>
              )}
              <p className="text-xs text-muted-foreground">
                Demo nạp SDK từ chính domain này, đọc spec, liệt kê toàn bộ endpoint mà không gọi API thật (an toàn cho mọi visitor).
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CorePageShell>
  );
}
