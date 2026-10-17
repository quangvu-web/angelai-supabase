import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTrustTrend } from "@/hooks/useTrustTrend";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface Props {
  days?: number;
  currentDecay?: number;
  daysInactive?: number;
}

export function TrustTrendChart({ days = 30, currentDecay = 1.0, daysInactive = 0 }: Props) {
  const { data, isLoading } = useTrustTrend(days);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Xu hướng Trust ({days} ngày)</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  const points = data || [];
  const first = points[0]?.tc;
  const last = points[points.length - 1]?.tc;
  const delta = first != null && last != null ? Number(last) - Number(first) : 0;

  const trendIcon =
    delta > 0.01 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> :
    delta < -0.01 ? <TrendingDown className="h-4 w-4 text-rose-500" /> :
    <Minus className="h-4 w-4 text-muted-foreground" />;

  const chartData = points.map((p) => ({
    date: new Date(p.snapshot_date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
    tc: Number(p.tc),
    decay: Number(p.decay_factor),
  }));

  const isDecaying = currentDecay < 1.0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Xu hướng Trust ({days} ngày)
            {trendIcon}
          </CardTitle>
          {delta !== 0 && (
            <Badge variant={delta > 0 ? "default" : "destructive"} className="text-xs">
              {delta > 0 ? "+" : ""}{delta.toFixed(3)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isDecaying && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <div className="font-medium text-amber-700 dark:text-amber-300">
                Trust đang giảm do không hoạt động ({daysInactive} ngày)
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Hệ số decay hiện tại: <span className="font-mono font-semibold">×{currentDecay.toFixed(2)}</span>.
                Quay lại tương tác để hồi phục.
              </div>
            </div>
          </div>
        )}

        {chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Chưa có dữ liệu lịch sử. Trust history sẽ được snapshot daily lúc 02:00 ICT.
          </div>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  domain={[0.3, 1.5]}
                  ticks={[0.3, 0.6, 0.8, 1.0, 1.25, 1.5]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => v.toFixed(3)}
                />
                <ReferenceLine y={0.6} stroke="hsl(var(--muted))" strokeDasharray="2 2" label={{ value: "T1", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <ReferenceLine y={1.0} stroke="hsl(var(--muted))" strokeDasharray="2 2" label={{ value: "T3", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <Line
                  type="monotone"
                  dataKey="tc"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <Stat label="Hiện tại" value={last != null ? Number(last).toFixed(3) : "–"} />
          <Stat label="Decay" value={`×${currentDecay.toFixed(2)}`} highlight={isDecaying} />
          <Stat label="Inactive" value={`${daysInactive}d`} highlight={daysInactive >= 60} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-mono font-semibold ${highlight ? "text-amber-600 dark:text-amber-400" : ""}`}>
        {value}
      </div>
    </div>
  );
}
