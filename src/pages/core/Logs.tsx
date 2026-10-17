import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, ShieldAlert, Bug } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const WINDOWS: { label: string; hours: number }[] = [
  { label: "24h", hours: 24 },
  { label: "7 ngày", hours: 168 },
  { label: "30 ngày", hours: 720 },
];

export default function Logs() {
  const { t, formatDate } = useLanguage();
  const [hours, setHours] = useState<number>(168);

  const { data, isLoading } = useQuery({
    queryKey: ["system-health-overview-logs", hours],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_health_overview" as any, { p_hours: hours } as any);
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 30_000,
  });

  const errors = (data?.edge_errors ?? []) as any[];
  const fraud = (data?.fraud?.recent ?? []) as any[];
  const windowLabel = WINDOWS.find((w) => w.hours === hours)?.label ?? `${hours}h`;

  return (
    <CorePageShell title={t("core.logs.title")} subtitle={t("core.logs.subtitle", { window: windowLabel })} showPhase2={false}>
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">{t("core.timeRange")}</span>
        {WINDOWS.map((w) => (
          <Button
            key={w.hours}
            size="sm"
            variant={hours === w.hours ? "default" : "outline"}
            onClick={() => setHours(w.hours)}
          >
            {w.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <Tabs defaultValue="errors">
          <TabsList>
            <TabsTrigger value="errors" className="gap-1"><Bug className="h-3 w-3" /> {t("core.edgeErrors")} ({errors.length})</TabsTrigger>
            <TabsTrigger value="fraud" className="gap-1"><ShieldAlert className="h-3 w-3" /> {t("core.fraud")} ({fraud.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="errors" className="mt-4 space-y-2">
            {errors.length === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground text-center">{t("core.noEdgeErrors", { window: windowLabel })}</Card>
            ) : errors.map((e) => (
              <Card key={e.id} className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={e.severity === "critical" || e.severity === "high" ? "destructive" : "secondary"}>
                      {e.severity || "error"}
                    </Badge>
                    <span className="font-mono text-xs truncate">{e.function_name}</span>
                    {e.sqlstate && <span className="text-[10px] text-muted-foreground">SQL {e.sqlstate}</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(e.created_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground break-words">{e.message || "(no message)"}</p>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="fraud" className="mt-4 space-y-2">
            {fraud.length === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground text-center">{t("core.noFraud", { window: windowLabel })}</Card>
            ) : fraud.map((a) => (
              <Card key={a.id} className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={a.severity === "critical" || a.severity === "high" ? "destructive" : "secondary"}>
                      {a.severity}
                    </Badge>
                    <span className="font-mono text-xs truncate">{a.alert_type}</span>
                    {!a.is_reviewed && <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">unreviewed</Badge>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(a.created_at)}</span>
                </div>
                {a.matched_pattern && <p className="text-xs text-muted-foreground break-words"><AlertTriangle className="inline h-3 w-3 mr-1" />{a.matched_pattern}</p>}
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </CorePageShell>
  );
}
