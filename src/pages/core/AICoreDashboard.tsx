import { useEffect, useState } from "react";
import { CorePageShell, KpiCard } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";

type Kpi = {
  generated_at: string;
  totals: {
    calls_today: number;
    calls_7d: number;
    calls_30d: number;
    active_users_7d: number;
    active_users_30d: number;
  };
  by_type: { type: string; total: number }[];
  daily: { day: string; chat: number; image_gen: number; image_edit: number }[];
  top_users: { user_id: string; display_name: string; total: number }[];
};

export default function AICoreDashboard() {
  const { t, formatNumber, formatDate } = useLanguage();
  const [data, setData] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    const { data: res, error } = await supabase.rpc("get_ai_core_kpi" as any);
    if (error) setErr(error.message);
    else setData(res as unknown as Kpi);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <CorePageShell title={t("core.dashboard.title")} subtitle={t("core.dashboard.subtitle")} showPhase2={false}>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
          {t("core.refresh")}
        </Button>
      </div>

      {err && (
        <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive">
          {t("common.error")}: {err}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard label={t("core.callsToday")} value={data ? formatNumber(data.totals.calls_today) : "—"} hint="ai_usage_tracking" />
        <KpiCard label={t("core.calls7d")} value={data ? formatNumber(data.totals.calls_7d) : "—"} />
        <KpiCard label={t("core.calls30d")} value={data ? formatNumber(data.totals.calls_30d) : "—"} />
        <KpiCard label={t("core.activeUsers7d")} value={data ? formatNumber(data.totals.active_users_7d) : "—"} />
        <KpiCard label={t("core.activeUsers30d")} value={data ? formatNumber(data.totals.active_users_30d) : "—"} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-semibold">{t("core.traffic14d")}</div>
            <div className="text-xs text-muted-foreground">{t("core.usageByType")}</div>
          </div>
        </div>
        <div className="h-64 w-full">
          {loading ? (
            <div className="h-full grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={data?.daily ?? []}>
                <defs>
                  <linearGradient id="g-chat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#daa520" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#daa520" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-img" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-edit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d) => String(d).slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="chat" stroke="#daa520" fill="url(#g-chat)" name="Chat" />
                <Area type="monotone" dataKey="image_gen" stroke="#10b981" fill="url(#g-img)" name="Sinh ảnh" />
                <Area type="monotone" dataKey="image_edit" stroke="#6366f1" fill="url(#g-edit)" name="Sửa ảnh" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="font-semibold mb-3">{t("core.usageByType")}</div>
          {(data?.by_type ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("common.noData")}</div>
          ) : (
            <div className="space-y-2">
              {data!.by_type.map((r) => {
                const max = Math.max(...data!.by_type.map((x) => x.total), 1);
                return (
                  <div key={r.type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{r.type}</span>
                      <span className="font-mono">{formatNumber(r.total)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#b8860b] to-[#ffd700]"
                        style={{ width: `${(r.total / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-3">{t("core.activeUsers7d")}</div>
          {(data?.top_users ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("core.noActivity")}</div>
          ) : (
            <div className="space-y-1.5 text-sm">
              {data!.top_users.map((u, i) => (
                <div key={u.user_id} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                    <span className="truncate max-w-[200px]">{u.display_name}</span>
                  </span>
                  <span className="font-mono">{formatNumber(u.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {data?.generated_at && (
        <div className="text-xs text-muted-foreground text-right">
          {t("core.updatedAt", { date: formatDate(data.generated_at) })}
        </div>
      )}
    </CorePageShell>
  );
}

