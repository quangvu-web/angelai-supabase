import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, XCircle, Coins, ShieldCheck, Vault, RefreshCw, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Health = {
  actions_24h: number;
  scored_24h: number;
  rejected_24h: number;
  pending_actions: number;
  success_rate: number;
  pending_distributions: number;
  settled_distributions: number;
  total_settled_fun: number;
  pending_audits: number;
  resolved_audits: number;
  treasury_vaults: { vault_name: string; balance: number }[];
  treasury_total: number;
  last_settler_run: string | null;
  last_audit_run: string | null;
  computed_at: string;
};

function fmt(n: number | null | undefined) {
  return Number(n || 0).toLocaleString();
}

function timeAgo(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins}m trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h trước`;
  return `${Math.floor(hrs / 24)}d trước`;
}

export default function OperationalHealthPanel() {
  const [running, setRunning] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["founder-operational-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_operational_health" as any);
      if (error) throw error;
      return data as Health;
    },
    refetchInterval: 60_000,
  });

  const runFunction = async (name: string, label: string) => {
    setRunning(name);
    try {
      const { data, error } = await supabase.functions.invoke(name, { body: {} });
      if (error) throw error;
      toast.success(`${label}: ${JSON.stringify(data?.processed ?? data?.success ?? "ok")}`);
      await refetch();
    } catch (e: any) {
      toast.error(`${label} thất bại: ${e?.message || e}`);
    } finally {
      setRunning(null);
    }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải Operational Health...</div>;
  if (!data) return <div className="text-center py-8 text-muted-foreground">Không có dữ liệu</div>;

  const successColor =
    data.success_rate >= 90 ? "text-emerald-500" : data.success_rate >= 70 ? "text-amber-500" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Batch Success Rate (24h)"
          value={`${data.success_rate}%`}
          sub={`${fmt(data.scored_24h)}/${fmt(data.actions_24h)} scored`}
          valueClass={successColor}
        />
        <KpiCard
          icon={<XCircle className="h-4 w-4" />}
          label="Rejected (24h)"
          value={fmt(data.rejected_24h)}
          sub={data.pending_actions > 0 ? `${fmt(data.pending_actions)} pending` : "0 pending"}
          valueClass={data.rejected_24h > 0 ? "text-amber-500" : ""}
        />
        <KpiCard
          icon={<Coins className="h-4 w-4" />}
          label="Pending Distributions"
          value={fmt(data.pending_distributions)}
          sub={`${fmt(data.settled_distributions)} settled · ${fmt(data.total_settled_fun)} FUN`}
          valueClass={data.pending_distributions > 0 ? "text-amber-500" : "text-emerald-500"}
        />
        <KpiCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Audit Backlog"
          value={fmt(data.pending_audits)}
          sub={`${fmt(data.resolved_audits)} đã xử lý`}
          valueClass={data.pending_audits > 100 ? "text-amber-500" : "text-emerald-500"}
        />
      </div>

      {/* Treasury vaults */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Vault className="h-4 w-4" />
            Treasury Vaults
            <Badge variant="outline" className="text-xs ml-auto">
              Tổng: {fmt(data.treasury_total)} FUN
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {data.treasury_vaults.map((v) => (
              <div key={v.vault_name} className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground capitalize">{v.vault_name.replace(/_/g, " ")}</p>
                <p className={`text-lg font-bold ${v.balance > 0 ? "" : "text-muted-foreground"}`}>
                  {fmt(v.balance)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Manual triggers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Vận hành thủ công
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ActionRow
              label="Distribution Settler"
              hint={`Cron 6h · Last: ${timeAgo(data.last_settler_run)}`}
              onRun={() => runFunction("pplp-distribution-settler", "Settler")}
              running={running === "pplp-distribution-settler"}
              disabled={data.pending_distributions === 0}
            />
            <ActionRow
              label="Audit Processor"
              hint={`Cron 1h · Last: ${timeAgo(data.last_audit_run)}`}
              onRun={() => runFunction("pplp-audit-processor", "Audit")}
              running={running === "pplp-audit-processor"}
              disabled={data.pending_audits === 0}
            />
            <ActionRow
              label="Batch Processor"
              hint={`${fmt(data.pending_actions)} actions pending`}
              onRun={() => runFunction("pplp-batch-processor", "Batch")}
              running={running === "pplp-batch-processor"}
            />
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Cập nhật: {new Date(data.computed_at).toLocaleString("vi-VN")} · Auto refresh 60s
          </p>
        </CardContent>
      </Card>

      {/* Status summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-3 flex items-center gap-3 text-sm">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="font-semibold">Hệ thống vận hành ổn định</p>
            <p className="text-xs text-muted-foreground">
              Batch processor đã reject {fmt(data.rejected_24h)} hành động không hợp lệ trong 24h ·{" "}
              {fmt(data.settled_distributions)} distributions đã giải ngân ({fmt(data.total_settled_fun)} FUN)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, valueClass = "" }: {
  icon: React.ReactNode; label: string; value: string; sub: string; valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
          {icon} {label}
        </div>
        <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ActionRow({ label, hint, onRun, running, disabled }: {
  label: string; hint: string; onRun: () => void; running: boolean; disabled?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg border bg-card flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRun} disabled={running || disabled}>
        {running ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Run"}
      </Button>
    </div>
  );
}
