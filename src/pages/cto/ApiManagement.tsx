import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Key, Activity, Users, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ApiManagement() {
  const { t, formatNumber, formatDate } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["api-management-overview"],
    queryFn: async () => {
      const [keysRes, usageRes] = await Promise.all([
        supabase
          .from("user_api_keys")
          .select("id, user_id, name, key_prefix, is_active, daily_limit, total_requests, last_used_at, created_at")
          .order("total_requests", { ascending: false })
          .limit(50),
        supabase
          .from("api_key_usage")
          .select("api_key_id, usage_date, request_count, tokens_used")
          .gte("usage_date", new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)),
      ]);
      if (keysRes.error) throw keysRes.error;
      if (usageRes.error) throw usageRes.error;

      const keys = keysRes.data ?? [];
      const usage = usageRes.data ?? [];
      const usageByKey = new Map<string, number>();
      let totalReq7d = 0;
      let totalTokens7d = 0;
      for (const u of usage) {
        usageByKey.set(u.api_key_id, (usageByKey.get(u.api_key_id) ?? 0) + u.request_count);
        totalReq7d += u.request_count;
        totalTokens7d += Number(u.tokens_used ?? 0);
      }
      return {
        keys: keys.map((k) => ({ ...k, usage7d: usageByKey.get(k.id) ?? 0 })),
        activeKeys: keys.filter((k) => k.is_active).length,
        totalKeys: keys.length,
        uniqueUsers: new Set(keys.map((k) => k.user_id)).size,
        totalReq7d,
        totalTokens7d,
      };
    },
    refetchInterval: 60_000,
  });

  return (
    <CorePageShell title={t("cto.api.title")} subtitle={t("cto.api.subtitle")}>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data ? (
        <Card className="p-6 text-sm text-muted-foreground">{t("cto.noData")}</Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<Key className="h-4 w-4" />} label={t("cto.activeKeys")} value={`${data.activeKeys}/${data.totalKeys}`} />
            <Stat icon={<Users className="h-4 w-4" />} label={t("cto.owners")} value={formatNumber(data.uniqueUsers)} />
            <Stat icon={<Activity className="h-4 w-4" />} label={t("cto.requests7d")} value={formatNumber(data.totalReq7d)} />
            <Stat icon={<Zap className="h-4 w-4" />} label={t("cto.tokens7d")} value={formatNumber(data.totalTokens7d)} />
          </div>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">{t("cto.topKeys")}</div>
            <div className="divide-y">
              {data.keys.slice(0, 20).map((k: any) => {
                const pct = Math.min(100, Math.round((k.usage7d / Math.max(1, k.daily_limit * 7)) * 100));
                return (
                  <div key={k.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{k.name}</span>
                        <Badge variant={k.is_active ? "default" : "secondary"} className="text-[10px]">
                          {k.is_active ? t("common.active") : t("common.disabled")}
                        </Badge>
                      </div>
                      <code className="text-[11px] text-muted-foreground font-mono">{k.key_prefix}</code>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{t("cto.lastUsed")}: {k.last_used_at ? formatDate(k.last_used_at) : "—"}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-mono">{formatNumber(k.usage7d)} · {t("cto.requests7d")}</div>
                      <div className="text-[10px] text-muted-foreground">{t("cto.limit")} {formatNumber(k.daily_limit)}/d · {pct}%</div>
                    </div>
                  </div>
                );
              })}
              {data.keys.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">{t("cto.noKeys")}</div>
              )}
            </div>
          </Card>
        </div>
      )}
    </CorePageShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </Card>
  );
}
