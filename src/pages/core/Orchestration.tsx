import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Bot, Image as ImageIcon, Pencil, Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Policy = {
  id: string;
  intent: string;
  model: string;
  fallback_model: string | null;
  priority: number;
  description: string | null;
  active: boolean;
};

type LogRow = {
  id: string;
  intent: string;
  model_used: string;
  latency_ms: number | null;
  status: string;
  fallback_triggered: boolean;
  created_at: string;
};

const usageIcons: Record<string, React.ReactNode> = {
  chat: <Bot className="h-4 w-4" />,
  generate_image: <ImageIcon className="h-4 w-4" />,
  edit_image: <Pencil className="h-4 w-4" />,
};

export default function Orchestration() {
  const { t, formatNumber, formatDate } = useLanguage();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Record<string, Partial<Policy>>>({});

  const { data: usage, isLoading: lu } = useQuery({
    queryKey: ["ai-usage-7d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("ai_usage_tracking")
        .select("usage_type, usage_count")
        .gte("usage_date", since);
      if (error) throw error;
      const agg = new Map<string, { count: number; calls: number }>();
      for (const r of data ?? []) {
        const cur = agg.get(r.usage_type) ?? { count: 0, calls: 0 };
        cur.count += r.usage_count; cur.calls += 1;
        agg.set(r.usage_type, cur);
      }
      return Array.from(agg.entries()).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.count - a.count);
    },
    refetchInterval: 60_000,
  });

  const { data: policies } = useQuery({
    queryKey: ["ai-routing-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_routing_policy" as any)
        .select("*")
        .order("priority");
      if (error) throw error;
      return (data || []) as unknown as Policy[];
    },
  });

  const [logs, setLogs] = useState<LogRow[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ai_routing_log" as any)
        .select("id,intent,model_used,latency_ms,status,fallback_triggered,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs((data || []) as unknown as LogRow[]);
    })();
    const ch = supabase
      .channel("ai_routing_log")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_routing_log" }, (p) => {
        setLogs((prev) => [p.new as LogRow, ...prev].slice(0, 50));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function savePolicy(id: string) {
    const patch = edit[id];
    if (!patch) return;
    const { error } = await supabase.from("ai_routing_policy" as any).update(patch).eq("id", id);
    if (error) return toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    toast({ title: t("common.save") });
    setEdit((e) => { const c = { ...e }; delete c[id]; return c; });
    qc.invalidateQueries({ queryKey: ["ai-routing-policy"] });
  }

  return (
    <CorePageShell title={t("core.orchestration.title")} subtitle={t("core.orchestration.subtitle")}>
      <div className="space-y-4">
        {/* Usage */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">{t("core.usage7d")}</div>
          {lu ? <Skeleton className="h-20" /> : (usage?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground">{t("core.noUsage")}</div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-3">
              {usage!.map((u) => (
                <div key={u.type} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {usageIcons[u.type] ?? <Bot className="h-4 w-4" />} {u.type}
                  </div>
                  <div className="text-xl font-semibold mt-1">{formatNumber(u.count)}</div>
                  <div className="text-[10px] text-muted-foreground">{u.calls} user-days</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Routing policy CRUD */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">{t("core.routingPolicy")}</div>
          <div className="space-y-2">
            {policies?.map((p) => {
              const cur = { ...p, ...edit[p.id] };
              const dirty = !!edit[p.id];
              return (
                <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto_auto] gap-2 items-center p-2 border rounded">
                  <Badge variant="outline" className="font-mono justify-self-start">{p.intent}</Badge>
                  <Input
                    value={cur.model}
                    onChange={(e) => setEdit((s) => ({ ...s, [p.id]: { ...s[p.id], model: e.target.value } }))}
                    className="h-8 text-xs font-mono"
                    placeholder="model"
                  />
                  <Input
                    value={cur.fallback_model ?? ""}
                    onChange={(e) => setEdit((s) => ({ ...s, [p.id]: { ...s[p.id], fallback_model: e.target.value || null } }))}
                    className="h-8 text-xs font-mono"
                    placeholder="fallback (optional)"
                  />
                  <Switch
                    checked={cur.active}
                    onCheckedChange={(v) => setEdit((s) => ({ ...s, [p.id]: { ...s[p.id], active: v } }))}
                  />
                  <Button size="sm" disabled={!dirty} onClick={() => savePolicy(p.id)}>{t("common.save")}</Button>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Realtime log */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold">{t("core.realtimeLog")}</div>
          </div>
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("core.noLogs")}</div>
          ) : (
            <div className="divide-y text-xs">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-2 py-1.5 flex-wrap">
                  <span className="text-muted-foreground font-mono w-32 shrink-0">
                    {formatDate(l.created_at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <Badge variant="outline" className="font-mono">{l.intent}</Badge>
                  <code className="font-mono text-[11px] flex-1 truncate">{l.model_used}</code>
                  <span className="text-muted-foreground">{l.latency_ms ?? "—"}ms</span>
                  {l.fallback_triggered && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-[10px]">
                      <AlertTriangle className="h-3 w-3 mr-1" />fallback
                    </Badge>
                  )}
                  {l.status === "ok" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">{l.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </CorePageShell>
  );
}
