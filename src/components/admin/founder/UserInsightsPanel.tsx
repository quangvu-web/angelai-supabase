import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function UserInsightsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-user-insights"],
    queryFn: async () => {
      const [topUsersRes, flaggedRes, streakRes, levelRes] = await Promise.all([
        supabase.from("light_score_ledger")
          .select("user_id, final_light_score, level, trend")
          .order("final_light_score", { ascending: false })
          .limit(20),
        supabase.from("fraud_alerts")
          .select("user_id, alert_type, severity, created_at")
          .eq("is_reviewed", false)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("daily_login_tracking")
          .select("user_id, streak_count")
          .order("streak_count", { ascending: false })
          .limit(10),
        supabase.from("light_score_ledger")
          .select("level")
          .limit(500),
      ]);

      // Level distribution
      const levelMap: Record<string, number> = {};
      (levelRes.data || []).forEach(r => {
        const l = r.level || "unknown";
        levelMap[l] = (levelMap[l] || 0) + 1;
      });
      const levelDist = Object.entries(levelMap).map(([name, count]) => ({ name, count }));

      return {
        topUsers: topUsersRes.data || [],
        flaggedUsers: flaggedRes.data || [],
        topStreaks: streakRes.data || [],
        levelDist,
      };
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Light Score Users</CardTitle></CardHeader>
          <CardContent className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b"><th className="text-left py-1">User</th><th className="text-right">Score</th><th className="text-right">Level</th><th className="text-right">Trend</th></tr></thead>
              <tbody>
                {(data?.topUsers || []).map((u, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-1 font-mono text-[10px]">{u.user_id?.slice(0, 8)}...</td>
                    <td className="text-right font-bold">{Number(u.final_light_score).toFixed(1)}</td>
                    <td className="text-right">{u.level}</td>
                    <td className="text-right">{u.trend === "up" ? "📈" : u.trend === "down" ? "📉" : "➡️"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Flagged Users (Chưa review)</CardTitle></CardHeader>
          <CardContent className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b"><th className="text-left py-1">User</th><th>Type</th><th>Severity</th></tr></thead>
              <tbody>
                {(data?.flaggedUsers || []).map((f, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-1 font-mono text-[10px]">{f.user_id?.slice(0, 8)}...</td>
                    <td>{f.alert_type}</td>
                    <td><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${f.severity === "critical" ? "bg-destructive/20 text-destructive" : f.severity === "high" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>{f.severity}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Login Streaks</CardTitle></CardHeader>
          <CardContent className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b"><th className="text-left py-1">User</th><th className="text-right">Streak</th></tr></thead>
              <tbody>
                {(data?.topStreaks || []).map((s, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-1 font-mono text-[10px]">{s.user_id?.slice(0, 8)}...</td>
                    <td className="text-right font-bold">{s.streak_count} 🔥</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Trust Level Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data?.levelDist || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
