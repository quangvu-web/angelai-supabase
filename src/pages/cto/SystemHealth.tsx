import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell, KpiCard } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, AlertTriangle, Database, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

type Overview = {
  cron_jobs: Array<{
    jobname: string; schedule: string; active: boolean;
    last_status: string | null; last_start: string | null;
    last_end: string | null; last_message: string | null;
  }>;
  edge_errors: Array<any>;
  fraud: { total_24h: number; unreviewed: number; severe: number; recent: any[] };
  audit: { pplp_audits_pending: number; pplp_audits_resolved_24h: number; backlog_audit_pending: number };
  db: { db_size_mb: number; connections: number };
  computed_at: string;
};

export default function SystemHealth() {
  const { t, formatNumber, formatDate } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ["system-health-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_health_overview" as any);
      if (error) throw error;
      return data as Overview;
    },
    refetchInterval: 60_000,
  });

  const cronActive = data?.cron_jobs.filter(j => j.active).length ?? 0;
  const cronFailed = data?.cron_jobs.filter(j => j.last_status && j.last_status !== "succeeded").length ?? 0;
  const errors24h = data?.edge_errors.length ?? 0;

  return (
    <CorePageShell title={t("cto.systemHealth.title")} subtitle={t("cto.systemHealth.subtitle")} showPhase2={false}>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !data ? (
        <Card className="p-6 text-sm text-muted-foreground">{t("cto.noData")}</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label={t("cto.cronRunning")} value={`${cronActive}/${data.cron_jobs.length}`} hint={cronFailed ? t("cto.needsReview") : "OK"} />
            <KpiCard label={t("core.edgeErrors")} value={formatNumber(errors24h)} hint={errors24h > 0 ? t("cto.needsReview") : t("cto.clean")} />
            <KpiCard label={t("cto.fraudAlerts")} value={formatNumber(data.fraud.total_24h)} hint={data.fraud.unreviewed ? t("cto.needsReview") : t("cto.clean")} />
            <KpiCard label={t("cto.databaseSize")} value={`${formatNumber(data.db.db_size_mb)} MB`} hint={`${formatNumber(data.db.connections)} ${t("cto.connections")}`} />
          </div>

          {/* Cron jobs */}
          <Card className="p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Cron Jobs ({data.cron_jobs.length})</h2>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>{t("cto.lastRun")}</TableHead>
                    <TableHead>{t("cto.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.cron_jobs.map(j => {
                    const ok = j.last_status === "succeeded";
                    return (
                      <TableRow key={j.jobname}>
                        <TableCell className="font-mono text-xs">{j.jobname}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{j.schedule}</TableCell>
                        <TableCell>
                          {j.active
                            ? <Badge variant="outline" className="text-emerald-600 border-emerald-300">on</Badge>
                            : <Badge variant="outline" className="text-muted-foreground">off</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">{j.last_start ? formatDate(j.last_start) : "—"}</TableCell>
                        <TableCell>
                          {!j.last_status ? <span className="text-xs text-muted-foreground">—</span>
                            : ok
                              ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {j.last_status}</span>
                              : <span className="inline-flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3 w-3" /> {j.last_status}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Audit + DB summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3"><Activity className="h-4 w-4 text-primary" /><h2 className="font-semibold">{t("cto.auditBacklog")}</h2></div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label={t("cto.pendingAudits")} value={formatNumber(data.audit.pplp_audits_pending)} warn={data.audit.pplp_audits_pending > 100} />
                <Stat label={t("cto.resolved24h")} value={formatNumber(data.audit.pplp_audits_resolved_24h)} />
                <Stat label={t("cto.auditBacklog")} value={formatNumber(data.audit.backlog_audit_pending)} warn={data.audit.backlog_audit_pending > 50} />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3"><Database className="h-4 w-4 text-primary" /><h2 className="font-semibold">Database</h2></div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <Stat label={t("cto.databaseSize")} value={`${formatNumber(data.db.db_size_mb)} MB`} />
                <Stat label={t("cto.connections")} value={formatNumber(data.db.connections)} warn={data.db.connections > 50} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">{t("common.updated")}: {formatDate(data.computed_at)} · {t("cto.autoRefresh")}</p>
            </Card>
          </div>

          {/* Quick link to logs */}
          <Card className="p-4 mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm">{formatNumber(errors24h)} {t("core.edgeErrors")} · {formatNumber(data.fraud.total_24h)} {t("cto.fraudAlerts")}</span>
            </div>
            <Link to="/core/logs" className="text-sm font-semibold text-primary hover:underline">{t("cto.openLogs")}</Link>
          </Card>
        </>
      )}
    </CorePageShell>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="p-2 rounded bg-muted/50">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${warn ? "text-amber-600" : ""}`}>{value}</p>
    </div>
  );
}
