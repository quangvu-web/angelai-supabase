import { useEffect, useState } from "react";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { ECOSYSTEM_PLATFORMS } from "@/lib/ecosystemUrls";
import { supabase } from "@/integrations/supabase/client";

type Health = { ok: boolean; status: number; latencyMs: number; error?: string };

export default function PlatformConnections() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, Health>>({});
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const runPing = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("platforms-health", {
        body: { targets: ECOSYSTEM_PLATFORMS.map((p) => ({ key: p.key, url: p.url })) },
      });
      if (error) throw error;
      const map: Record<string, Health> = {};
      for (const r of data?.results ?? []) map[r.key] = r;
      setResults(map);
      setCheckedAt(data?.checkedAt ?? new Date().toISOString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runPing();
  }, []);

  return (
    <CorePageShell title="Platform Connections" subtitle="Health-check 5 nền tảng FUN ecosystem">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">
          {checkedAt ? `Lần check: ${new Date(checkedAt).toLocaleString("vi-VN")}` : "Chưa check"}
        </div>
        <Button size="sm" variant="outline" onClick={runPing} disabled={loading}>
          {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Ping lại
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {ECOSYSTEM_PLATFORMS.map((p) => {
          const h = results[p.key];
          const pinging = loading && !h;
          return (
            <Card key={p.key} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{p.name}</div>
                {pinging ? (
                  <Badge className="bg-muted text-muted-foreground">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> ping
                  </Badge>
                ) : h?.ok ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> {h.status} · {h.latencyMs}ms
                  </Badge>
                ) : h ? (
                  <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30">
                    <XCircle className="w-3 h-3 mr-1" /> {h.status || "down"}
                  </Badge>
                ) : (
                  <Badge
                    className={
                      p.status === "live"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    }
                  >
                    {p.status === "live" ? "Live" : "Coming"}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{p.desc}</div>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
              >
                {p.url} <ExternalLink className="w-3 h-3" />
              </a>
              {h?.error && <div className="text-[10px] text-red-500 truncate">{h.error}</div>}
            </Card>
          );
        })}
      </div>
    </CorePageShell>
  );
}
