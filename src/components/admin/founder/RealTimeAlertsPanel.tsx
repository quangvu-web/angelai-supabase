import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Zap, AlertTriangle, Activity, TrendingUp } from "lucide-react";

export default function RealTimeAlertsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-realtime-alerts"],
    queryFn: async () => {
      const now = new Date();
      const h24 = new Date(now.getTime() - 24 * 3600000).toISOString();
      const h1 = new Date(now.getTime() - 3600000).toISOString();

      const [alerts24hRes, recentActionsRes, mintSpikeRes] = await Promise.all([
        supabase.from("fraud_alerts").select("alert_type, severity, created_at, user_id, matched_pattern").gte("created_at", h24).order("created_at", { ascending: false }),
        supabase.from("pplp_actions").select("action_type, created_at, actor_id, status").gte("created_at", h24).order("created_at", { ascending: false }).limit(200),
        supabase.from("fun_distribution_logs").select("total_reward, created_at").gte("created_at", h24).order("created_at", { ascending: true }),
      ]);

      const alerts = alerts24hRes.data || [];
      const actions = recentActionsRes.data || [];
      const mints = mintSpikeRes.data || [];

      // Alerts in last 1h vs 24h
      const alertsLastHour = alerts.filter(a => new Date(a.created_at || 0).getTime() >= new Date(h1).getTime()).length;
      const actionsLastHour = actions.filter(a => new Date(a.created_at || 0).getTime() >= new Date(h1).getTime()).length;

      // Activity by hour (last 24h)
      const hourMap: Record<string, number> = {};
      actions.forEach(a => {
        const hour = (a.created_at || "").slice(0, 13);
        hourMap[hour] = (hourMap[hour] || 0) + 1;
      });
      const activityByHour = Object.entries(hourMap).map(([hour, count]) => ({
        hour: hour.slice(11) + ":00",
        count,
      }));

      // Mint volume by hour
      const mintHourMap: Record<string, number> = {};
      mints.forEach(m => {
        const hour = (m.created_at || "").slice(0, 13);
        mintHourMap[hour] = (mintHourMap[hour] || 0) + Number(m.total_reward || 0);
      });
      const mintByHour = Object.entries(mintHourMap).map(([hour, amount]) => ({
        hour: hour.slice(11) + ":00",
        amount,
      }));

      // Anomalies: users with >5 actions in last hour
      const userActionCount: Record<string, number> = {};
      actions.filter(a => new Date(a.created_at || 0).getTime() >= new Date(h1).getTime()).forEach(a => {
        userActionCount[a.actor_id] = (userActionCount[a.actor_id] || 0) + 1;
      });
      const anomalies = Object.entries(userActionCount).filter(([_, c]) => c > 5).map(([user, count]) => ({ user, count }));

      return {
        alerts24h: alerts.length,
        alertsLastHour,
        actionsLastHour,
        totalActions24h: actions.length,
        activityByHour,
        mintByHour,
        anomalies,
        recentAlerts: alerts.slice(0, 10),
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  const kpis = [
    { label: "Alerts (24h)", value: data?.alerts24h || 0, icon: AlertTriangle, color: "text-destructive" },
    { label: "Alerts (1h)", value: data?.alertsLastHour || 0, icon: Zap, color: "text-amber-500" },
    { label: "Actions (1h)", value: data?.actionsLastHour || 0, icon: Activity, color: "text-blue-500" },
    { label: "Anomalies", value: data?.anomalies?.length || 0, icon: TrendingUp, color: "text-orange-500" },
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Activity (24h by Hour)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.activityByHour || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mint Volume (24h by Hour)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.mintByHour || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="hsl(38,92%,50%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {(data?.anomalies?.length || 0) > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-600">⚠️ Velocity Anomalies (&gt;5 actions/hour)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data?.anomalies?.map((a, i) => (
                <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-mono">
                  {a.user.slice(0, 8)}... ({a.count} actions)
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Alerts</CardTitle></CardHeader>
        <CardContent className="max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b"><th className="text-left py-1">Time</th><th>Type</th><th>Severity</th><th>Pattern</th></tr></thead>
            <tbody>
              {(data?.recentAlerts || []).map((a: any, i: number) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1 text-muted-foreground">{new Date(a.created_at).toLocaleTimeString("vi-VN")}</td>
                  <td>{a.alert_type}</td>
                  <td><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${a.severity === "critical" ? "bg-destructive/20 text-destructive" : "bg-amber-100 text-amber-700"}`}>{a.severity}</span></td>
                  <td className="text-muted-foreground">{a.matched_pattern || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
