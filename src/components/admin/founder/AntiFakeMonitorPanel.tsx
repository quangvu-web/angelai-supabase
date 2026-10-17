import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, ShieldAlert, Bug, Clock } from "lucide-react";

export default function AntiFakeMonitorPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-anti-fake"],
    queryFn: async () => {
      const [alertsRes, recentRes] = await Promise.all([
        supabase.from("fraud_alerts").select("alert_type, severity, is_reviewed, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("fraud_alerts").select("*").eq("is_reviewed", false).order("created_at", { ascending: false }).limit(20),
      ]);

      const alerts = alertsRes.data || [];
      const unreviewed = alerts.filter(a => !a.is_reviewed).length;
      const critical = alerts.filter(a => a.severity === "critical").length;
      const high = alerts.filter(a => a.severity === "high").length;

      // By type
      const typeMap: Record<string, number> = {};
      alerts.forEach(a => { typeMap[a.alert_type] = (typeMap[a.alert_type] || 0) + 1; });
      const byType = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count }));

      // By day (last 14 days)
      const dayMap: Record<string, number> = {};
      alerts.forEach(a => {
        const day = (a.created_at || "").slice(0, 10);
        dayMap[day] = (dayMap[day] || 0) + 1;
      });
      const byDay = Object.entries(dayMap).slice(-14).map(([date, count]) => ({ date: date.slice(5), count }));

      return { unreviewed, critical, high, total: alerts.length, byType, byDay, queue: recentRes.data || [] };
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  const kpis = [
    { label: "Chưa review", value: data?.unreviewed || 0, icon: Clock, color: "text-amber-500" },
    { label: "Critical", value: data?.critical || 0, icon: ShieldAlert, color: "text-destructive" },
    { label: "High", value: data?.high || 0, icon: AlertTriangle, color: "text-orange-500" },
    { label: "Tổng cảnh báo", value: data?.total || 0, icon: Bug, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><k.icon className={`w-4 h-4 ${k.color}`} /><span className="text-xs text-muted-foreground">{k.label}</span></div>
            <p className="text-lg font-bold">{k.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alerts by Type</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.byType || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 9 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(0,84%,60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alert Trend (14 ngày)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.byDay || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Manual Review Queue</CardTitle></CardHeader>
        <CardContent className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b"><th className="text-left py-1">User</th><th>Type</th><th>Severity</th><th className="text-right">Time</th></tr></thead>
            <tbody>
              {(data?.queue || []).map((q: any, i: number) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1 font-mono text-[10px]">{q.user_id?.slice(0, 8)}...</td>
                  <td>{q.alert_type}</td>
                  <td><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${q.severity === "critical" ? "bg-destructive/20 text-destructive" : "bg-amber-100 text-amber-700"}`}>{q.severity}</span></td>
                  <td className="text-right text-muted-foreground">{new Date(q.created_at).toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
