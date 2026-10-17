import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrustAdminStats } from "@/hooks/useTrustAdmin";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";

const TIER_COLORS: Record<string, string> = {
  T0: "hsl(var(--muted-foreground))",
  T1: "hsl(var(--primary))",
  T2: "hsl(var(--accent))",
  T3: "hsl(var(--primary))",
  T4: "hsl(45 93% 47%)",
};
const SYBIL_ORDER = ["very_low", "low", "medium", "high", "critical"];

export function TrustStatsCharts() {
  const { data, isLoading } = useTrustAdminStats();
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  const tierData = Object.entries(data.tier_distribution || {}).map(([name, value]) => ({ name, value: Number(value) }));
  const sybilData = SYBIL_ORDER
    .filter((k) => data.sybil_distribution?.[k] != null)
    .map((k) => ({ name: k, value: Number(data.sybil_distribution[k] || 0) }));
  const trendData = (data.tc_trend_30d || []).map((d) => ({
    day: new Date(d.day).toLocaleDateString("vi-VN", { month: "2-digit", day: "2-digit" }),
    avg_tc: Number(d.avg_tc),
  }));

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Phân bố Tier</CardTitle></CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={tierData} dataKey="value" nameKey="name" outerRadius={60} label>
                {tierData.map((d) => <Cell key={d.name} fill={TIER_COLORS[d.name] || "hsl(var(--primary))"} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Phân bố Sybil Risk</CardTitle></CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sybilData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">TC trung bình 30 ngày</CardTitle></CardHeader>
        <CardContent className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 1]} />
              <Tooltip />
              <Line type="monotone" dataKey="avg_tc" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
