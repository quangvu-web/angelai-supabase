import { useEffect, useState } from "react";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, ExternalLink, Code2, Layers, FileJson } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ECOSYSTEM_PLATFORMS } from "@/lib/ecosystemUrls";

const SPEC_URL = "/openapi/fun-core-v1.json";

type Endpoint = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  group: string;
  summary: string;
  auth: "public" | "user" | "admin" | "api-key";
};

const methodColor: Record<Endpoint["method"], string> = {
  GET: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
  POST: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  PATCH: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  DELETE: "bg-destructive/15 text-destructive border-destructive/30",
};

const authColor: Record<Endpoint["auth"], string> = {
  public: "text-emerald-600",
  user: "text-sky-600",
  "api-key": "text-violet-600",
  admin: "text-destructive",
};

function detectAuth(op: any): Endpoint["auth"] {
  const sec = op.security?.[0];
  if (!sec) return "public";
  if (sec.apiKeyAuth) return "api-key";
  if (sec.bearerAuth) {
    return op.tags?.[0] === "Admin" ? "admin" : "user";
  }
  return "public";
}

export default function FunCoreApi() {
  const [spec, setSpec] = useState<any>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [filter, setFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(SPEC_URL)
      .then((r) => r.json())
      .then((data) => {
        setSpec(data);
        const out: Endpoint[] = [];
        Object.entries(data.paths || {}).forEach(([path, methods]: [string, any]) => {
          Object.entries(methods).forEach(([method, op]: [string, any]) => {
            if (!["get", "post", "put", "delete", "patch"].includes(method)) return;
            out.push({
              method: method.toUpperCase() as Endpoint["method"],
              path,
              group: op.tags?.[0] || "Other",
              summary: op.summary || "",
              auth: detectAuth(op),
            });
          });
        });
        setEndpoints(out);
      })
      .catch(() => toast({ title: "Không tải được OpenAPI spec", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const groups = ["ALL", ...(spec?.tags?.map((t: any) => t.name) || [])];
  const filtered = filter === "ALL" ? endpoints : endpoints.filter((e) => e.group === filter);

  const copyAll = () => {
    navigator.clipboard.writeText(filtered.map((e) => `${e.method} ${e.path}`).join("\n"));
    toast({ title: "Đã copy", description: `${filtered.length} endpoints` });
  };

  const downloadSpec = () => {
    const a = document.createElement("a");
    a.href = SPEC_URL;
    a.download = "fun-core-v1.json";
    a.click();
  };

  const totalEndpoints = endpoints.length;
  const baseUrl = spec?.servers?.[0]?.url || "https://api.fun.rich/v1";

  return (
    <CorePageShell
      title="FUN Core API"
      subtitle={loading ? "Đang tải spec..." : `${spec?.info?.title} v${spec?.info?.version} · ${totalEndpoints} endpoints · ${baseUrl}`}
      showPhase2={false}
    >
      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-grid">
          <TabsTrigger value="endpoints" className="gap-1">
            <Code2 className="h-3.5 w-3.5" /> Endpoints
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-1">
            <Layers className="h-3.5 w-3.5" /> Service Catalog
          </TabsTrigger>
          <TabsTrigger value="spec" className="gap-1">
            <FileJson className="h-3.5 w-3.5" /> OpenAPI Spec
          </TabsTrigger>
        </TabsList>

        {/* TAB: Endpoints */}
        <TabsContent value="endpoints" className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {groups.map((g) => (
              <Button
                key={g}
                size="sm"
                variant={filter === g ? "default" : "outline"}
                onClick={() => setFilter(g)}
              >
                {g}
                {g !== "ALL" && ` (${endpoints.filter((e) => e.group === g).length})`}
              </Button>
            ))}
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={copyAll} className="gap-1">
                <Copy className="h-3 w-3" /> Copy
              </Button>
              <Button size="sm" variant="ghost" onClick={downloadSpec} className="gap-1">
                <Download className="h-3 w-3" /> JSON
              </Button>
            </div>
          </div>

          <Card className="p-2">
            <div className="divide-y">
              {filtered.map((e) => (
                <div
                  key={e.method + e.path}
                  className="flex items-center gap-3 py-2 px-2 flex-wrap"
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono shrink-0 ${methodColor[e.method]}`}
                  >
                    {e.method}
                  </Badge>
                  <code className="font-mono text-xs flex-1 min-w-0 truncate">{e.path}</code>
                  <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-md">
                    {e.summary}
                  </span>
                  <span className={`text-[10px] font-mono shrink-0 ${authColor[e.auth]}`}>
                    {e.auth}
                  </span>
                </div>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Không có endpoint nào trong nhóm này.
                </div>
              )}
            </div>
          </Card>

          <Card className="p-3 text-[11px] text-muted-foreground space-y-1">
            <p>
              <span className="font-mono text-emerald-600">public</span> = không cần auth ·{" "}
              <span className="font-mono text-sky-600">user</span> = JWT bearer ·{" "}
              <span className="font-mono text-violet-600">api-key</span> = service ingest key ·{" "}
              <span className="font-mono text-destructive">admin</span> = coordinator+
            </p>
            <p>
              Base URL: <code className="text-foreground">{baseUrl}</code>
            </p>
          </Card>
        </TabsContent>

        {/* TAB: Service Catalog */}
        <TabsContent value="catalog" className="space-y-3">
          <Card className="p-3 text-xs text-muted-foreground">
            Mọi platform trong FUN Ecosystem đều consume cùng FUN Core API. Angel A.I. là intelligence
            layer dùng chung — identity, wallet, AI, scoring.
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ECOSYSTEM_PLATFORMS.map((p) => (
              <Card key={p.key} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm">{p.name}</h3>
                    <Badge
                      variant="outline"
                      className={
                        p.status === "live"
                          ? "border-emerald-500/40 text-emerald-700 text-[10px]"
                          : "border-amber-500/40 text-amber-700 text-[10px]"
                      }
                    >
                      {p.status === "live" ? "● LIVE" : "○ Coming"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{p.desc}</p>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    {p.url} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB: OpenAPI Spec */}
        <TabsContent value="spec" className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" asChild className="gap-1">
              <a href={SPEC_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" /> Mở raw JSON
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={downloadSpec} className="gap-1">
              <Download className="h-3 w-3" /> Download
            </Button>
            <Button
              size="sm"
              variant="outline"
              asChild
              className="gap-1"
            >
              <a
                href={`https://petstore.swagger.io/?url=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.origin + SPEC_URL : SPEC_URL
                )}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" /> Mở trên Swagger UI
              </a>
            </Button>
          </div>
          <Card className="p-3">
            <pre className="text-[10px] font-mono overflow-auto max-h-[60vh] leading-relaxed">
              {spec ? JSON.stringify(spec, null, 2) : "Đang tải..."}
            </pre>
          </Card>
        </TabsContent>
      </Tabs>
    </CorePageShell>
  );
}
