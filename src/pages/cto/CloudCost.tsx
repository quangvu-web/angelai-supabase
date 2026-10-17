import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell, KpiCard } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { DollarSign, Zap, Database, AlertTriangle, TrendingUp, Cpu } from "lucide-react";

const fmt = (n: any) => Number(n ?? 0).toLocaleString("vi-VN");
const shortDate = (d: string) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

type Daily = {
  day: string; calls: number; tokens_in: number; tokens_out: number;
  avg_latency_ms: number; p95_latency_ms: number; errors: number; fallbacks: number;
};
type Intent = {
  intent: string; model_used: string; calls: number;
  tokens_total: number; avg_latency_ms: number; errors: number;
};
type SlowQ = {
  query: string; calls: number; total_ms: number;
  mean_ms: number; max_ms: number; rows_returned: number;
};

export default function CloudCost() {
  const daily = useQuery({
    queryKey: ["cloud-cost-daily"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cloud_cost_daily" as any, { _days: 14 });
      if (error) throw error;
      return (data ?? []) as Daily[];
    },
    refetchInterval: 60_000,
  });

  const intents = useQuery({
    queryKey: ["cloud-cost-intents"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cloud_cost_top_intents" as any, { _days: 7, _limit: 20 });
      if (error) throw error;
      return (data ?? []) as Intent[];
    },
    refetchInterval: 60_000,
  });

  const slow = useQuery({
    queryKey: ["cloud-cost-slow-queries"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cloud_top_slow_queries" as any, { _limit: 15 });
      if (error) throw error;
      return (data ?? []) as SlowQ[];
    },
    refetchInterval: 120_000,
  });

  const days = (daily.data ?? []).slice().reverse();
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const totalCalls7d = days.slice(-7).reduce((s, d) => s + Number(d.calls || 0), 0);
  const totalTokens7d = days.slice(-7).reduce((s, d) => s + Number(d.tokens_in || 0) + Number(d.tokens_out || 0), 0);
  const errors7d = days.slice(-7).reduce((s, d) => s + Number(d.errors || 0), 0);
  const avgLatency7d = days.slice(-7).length
    ? Math.round(days.slice(-7).reduce((s, d) => s + Number(d.avg_latency_ms || 0), 0) / days.slice(-7).length)
    : 0;

  const dayChart = days.map((d) => ({
    day: shortDate(d.day),
    calls: Number(d.calls),
    tokens: Number(d.tokens_in) + Number(d.tokens_out),
    latency: Number(d.avg_latency_ms),
    errors: Number(d.errors),
  }));

  return (
    <CorePageShell
      title="💰 Cloud Cost Monitor"
      subtitle="Chi phí AI theo ngày · Top tác vụ tốn tài nguyên · Top query chậm"
      showPhase2={false}
    >
      {/* KPIs */}
      {daily.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="AI calls hôm nay"
            value={fmt(today?.calls)}
            hint={yesterday ? `Hôm qua ${fmt(yesterday.calls)}` : ""}
          />
          <KpiCard
            label="Tokens 7 ngày"
            value={fmt(totalTokens7d)}
            hint={`~${fmt(Math.round(totalTokens7d / 1000))}K tokens`}
          />
          <KpiCard
            label="Latency TB (7d)"
            value={`${fmt(avgLatency7d)} ms`}
            hint={today ? `Hôm nay p95 ${fmt(today.p95_latency_ms)}ms` : ""}
          />
          <KpiCard
            label="Lỗi 7 ngày"
            value={fmt(errors7d)}
            hint={errors7d > 0 ? "Xem tab AI Tasks" : "Sạch"}
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">AI calls & tokens (14 ngày)</h2>
          </div>
          {dayChart.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dayChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={10} />
                <YAxis yAxisId="l" fontSize={10} />
                <YAxis yAxisId="r" orientation="right" fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="l" type="monotone" dataKey="calls" name="Calls" stroke="#daa520" fill="#daa520" fillOpacity={0.3} />
                <Area yAxisId="r" type="monotone" dataKey="tokens" name="Tokens" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Latency & lỗi mỗi ngày</h2>
          </div>
          {dayChart.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Chưa có dữ liệu</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dayChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={10} />
                <YAxis yAxisId="l" fontSize={10} />
                <YAxis yAxisId="r" orientation="right" fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="latency" name="Latency (ms)" fill="#8b5cf6" />
                <Bar yAxisId="r" dataKey="errors" name="Errors" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Detail tabs */}
      <Tabs defaultValue="intents" className="mt-4">
        <TabsList>
          <TabsTrigger value="intents" className="text-xs"><Cpu className="h-3 w-3 mr-1" />Top AI tasks</TabsTrigger>
          <TabsTrigger value="slow" className="text-xs"><Database className="h-3 w-3 mr-1" />Top slow queries</TabsTrigger>
          <TabsTrigger value="daily" className="text-xs"><DollarSign className="h-3 w-3 mr-1" />Bảng theo ngày</TabsTrigger>
        </TabsList>

        <TabsContent value="intents">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Tác vụ AI tốn nhiều token nhất trong 7 ngày qua (ai_routing_log).
            </p>
            {intents.isLoading ? <Skeleton className="h-64" /> : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Intent</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Avg latency</TableHead>
                      <TableHead className="text-right">Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(intents.data ?? []).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-xs">{r.intent}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{r.model_used}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.calls)}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{fmt(r.tokens_total)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.avg_latency_ms)} ms</TableCell>
                        <TableCell className="text-right">
                          {Number(r.errors) > 0
                            ? <Badge variant="destructive" className="text-xs">{fmt(r.errors)}</Badge>
                            : <span className="text-xs text-muted-foreground">0</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(intents.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">Chưa có dữ liệu</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="slow">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Top query đốt CPU nhất (pg_stat_statements). Ưu tiên tối ưu các dòng có <b>total_ms</b> cao.
            </p>
            {slow.isLoading ? <Skeleton className="h-64" /> : slow.error ? (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" /> Không đọc được pg_stat_statements ({String((slow.error as any)?.message ?? "")}).
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Query</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Total ms</TableHead>
                      <TableHead className="text-right">Mean ms</TableHead>
                      <TableHead className="text-right">Max ms</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(slow.data ?? []).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-[10px] whitespace-pre-wrap break-all max-w-[520px]">
                          {r.query}
                        </TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.calls)}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{fmt(r.total_ms)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.mean_ms)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.max_ms)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.rows_returned)}</TableCell>
                      </TableRow>
                    ))}
                    {(slow.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">Không có dữ liệu</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card className="p-4">
            {daily.isLoading ? <Skeleton className="h-64" /> : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Tokens in</TableHead>
                      <TableHead className="text-right">Tokens out</TableHead>
                      <TableHead className="text-right">Avg ms</TableHead>
                      <TableHead className="text-right">p95 ms</TableHead>
                      <TableHead className="text-right">Errors</TableHead>
                      <TableHead className="text-right">Fallbacks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(daily.data ?? []).map((r) => (
                      <TableRow key={r.day}>
                        <TableCell className="text-xs font-mono">{r.day}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.calls)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.tokens_in)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.tokens_out)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.avg_latency_ms)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.p95_latency_ms)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.errors)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.fallbacks)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        Auto refresh 60s · Dữ liệu từ ai_routing_log + pg_stat_statements · Chỉ admin xem được
      </p>
    </CorePageShell>
  );
}
