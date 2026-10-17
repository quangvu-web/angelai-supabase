import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { ShieldAlert, TrendingUp, Lock, Activity, HeartPulse, AlertTriangle } from "lucide-react";

const HEALTH_COLORS = {
  good: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  danger: "hsl(0, 84%, 60%)",
  neutral: "hsl(var(--muted-foreground))",
};

function healthColor(value: number, thresholds: { good: number; warn: number }): string {
  if (value >= thresholds.good) return HEALTH_COLORS.good;
  if (value >= thresholds.warn) return HEALTH_COLORS.warning;
  return HEALTH_COLORS.danger;
}

export default function MonetaryHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-monetary-health"],
    queryFn: async () => {
      // Get last 30 days of health metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: metrics, error } = await (supabase as any)
        .from("inflation_health_metrics")
        .select("*")
        .gte("metric_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("metric_date", { ascending: true });

      if (error) throw error;

      // Get latest health metrics via RPC
      const { data: latestHealth } = await supabase.rpc("compute_health_metrics" as any, {
        _date: new Date().toISOString().split("T")[0],
      });

      // Get treasury vault balances
      const { data: vaults } = await (supabase as any)
        .from("treasury_vaults")
        .select("vault_name, balance");

      // Get epoch snapshots summary
      const { data: snapshots } = await (supabase as any)
        .from("epoch_snapshots")
        .select("epoch_type, window_end, timing_adjusted_score, burst_penalty")
        .order("window_end", { ascending: false })
        .limit(200);

      return {
        metrics: metrics || [],
        latest: latestHealth || {},
        vaults: vaults || [],
        snapshots: snapshots || [],
      };
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Đang tải Monetary Health...</div>;
  }

  const latest = data?.latest || {};
  const metrics = data?.metrics || [];
  const vaults = data?.vaults || [];

  // Format chart data
  const chartData = metrics.map((m: any) => ({
    date: m.metric_date?.slice(5) || "",
    supply: (m.supply_growth_rate || 0) * 100,
    value: (m.value_expansion_ratio || 0) * 100,
    fraud: (m.fraud_pressure_ratio || 0) * 100,
    locked: (m.locked_circulating_ratio || 0) * 100,
    utility: (m.utility_absorption_ratio || 0) * 100,
    retention: (m.retention_quality_ratio || 0) * 100,
  }));

  const vaultTotal = vaults.reduce((s: number, v: any) => s + Number(v.balance || 0), 0);

  const isSafeMode = latest.safe_mode_active === true;

  return (
    <div className="space-y-4">
      {/* Safe Mode Alert */}
      {isSafeMode && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <div>
              <p className="font-bold text-destructive">⚠️ SAFE MODE ACTIVE</p>
              <p className="text-sm text-muted-foreground">{latest.safe_mode_reason || "System anomaly detected"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Health Ratios */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <HealthCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Value Expansion"
          value={latest.value_expansion_ratio}
          format="ratio"
          color={healthColor(latest.value_expansion_ratio || 0, { good: 0.8, warn: 0.4 })}
          tooltip="verified_value_growth / supply_growth"
        />
        <HealthCard
          icon={<Activity className="h-4 w-4" />}
          label="Utility Absorption"
          value={latest.utility_absorption_ratio}
          format="percent"
          color={healthColor(latest.utility_absorption_ratio || 0, { good: 0.6, warn: 0.3 })}
          tooltip="ecosystem_FUN_used / newly_unlocked"
        />
        <HealthCard
          icon={<HeartPulse className="h-4 w-4" />}
          label="Retention Quality"
          value={latest.retention_quality_ratio}
          format="percent"
          color={healthColor(latest.retention_quality_ratio || 0, { good: 0.7, warn: 0.4 })}
          tooltip="quality_active / total_claiming"
        />
        <HealthCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Fraud Pressure"
          value={latest.fraud_pressure_ratio}
          format="percent"
          color={healthColor(1 - (latest.fraud_pressure_ratio || 0), { good: 0.85, warn: 0.7 })}
          tooltip="flagged / total (lower = better)"
          inverted
        />
        <HealthCard
          icon={<Lock className="h-4 w-4" />}
          label="Locked Stability"
          value={latest.locked_stability_ratio}
          format="percent"
          color={healthColor(latest.locked_stability_ratio || 0, { good: 0.5, warn: 0.2 })}
          tooltip="locked_FUN / circulating_FUN"
        />
        <HealthCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Supply Growth"
          value={latest.supply_growth_rate}
          format="percent"
          color={healthColor(1 - Math.abs(latest.supply_growth_rate || 0), { good: 0.5, warn: 0.2 })}
          tooltip="30d supply growth rate"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Value vs Supply Growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Value vs Supply Growth (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke={HEALTH_COLORS.good} name="Value %" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="supply" stroke={HEALTH_COLORS.warning} name="Supply %" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fraud + Locked Ratio */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Fraud Pressure & Locked Ratio (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="locked" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Locked %" />
                <Area type="monotone" dataKey="fraud" stroke={HEALTH_COLORS.danger} fill={HEALTH_COLORS.danger} fillOpacity={0.15} name="Fraud %" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Treasury Vaults */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            Treasury Vaults
            <Badge variant="outline" className="text-xs">
              Total: {vaultTotal.toLocaleString()} FUN
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {vaults.map((v: any) => (
              <div key={v.vault_name} className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground capitalize">
                  {v.vault_name?.replace(/_/g, " ")}
                </p>
                <p className="text-lg font-bold">{Number(v.balance || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Utility & Retention Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Utility Absorption & Retention Quality (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="utility" stroke="hsl(var(--primary))" name="Utility %" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="retention" stroke={HEALTH_COLORS.good} name="Retention %" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Health Card Component
// ============================================================
function HealthCard({ icon, label, value, format, color, tooltip, inverted }: {
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  format: "percent" | "ratio";
  color: string;
  tooltip: string;
  inverted?: boolean;
}) {
  const displayValue = value !== undefined && value !== null
    ? format === "percent"
      ? `${(value * 100).toFixed(1)}%`
      : value.toFixed(2)
    : "—";

  return (
    <Card className="relative group">
      <CardContent className="p-3 text-center">
        <div className="flex items-center justify-center gap-1 mb-1" style={{ color }}>
          {icon}
        </div>
        <p className="text-lg font-bold" style={{ color }}>{displayValue}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover text-popover-foreground text-[9px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
          {tooltip}
        </div>
      </CardContent>
    </Card>
  );
}
