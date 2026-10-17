import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Coins, ShieldCheck } from "lucide-react";
import MintPipelineHealthCard from "@/components/admin/MintPipelineHealthCard";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(142,76%,36%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)"];

export default function OverviewPanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["founder-overview"],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

      const [lightRes, mintRes, dauRes, wauRes, mauRes, validationRes, actionCatRes, mintTrendRes] = await Promise.all([
        supabase.from("light_score_ledger").select("final_light_score").order("computed_at", { ascending: false }).limit(500),
        supabase.from("fun_distribution_logs").select("total_reward, user_amount, platform_amount"),
        supabase.from("daily_login_tracking").select("user_id", { count: "exact", head: true }).eq("login_date", today),
        supabase.from("daily_login_tracking").select("user_id").gte("login_date", weekAgo),
        supabase.from("daily_login_tracking").select("user_id").gte("login_date", monthAgo),
        supabase.from("pplp_scores").select("decision"),
        supabase.from("pplp_actions").select("action_type").limit(1000),
        supabase.from("fun_distribution_logs").select("total_reward, created_at").order("created_at", { ascending: true }).limit(500),
      ]);

      const totalLight = (lightRes.data || []).reduce((s, r) => s + Number(r.final_light_score || 0), 0);
      const totalMinted = (mintRes.data || []).reduce((s, r) => s + Number(r.total_reward || 0), 0);
      const dau = dauRes.count || 0;
      const wau = new Set((wauRes.data || []).map(r => r.user_id)).size;
      const mau = new Set((mauRes.data || []).map(r => r.user_id)).size;

      const decisions = validationRes.data || [];
      const approved = decisions.filter(d => d.decision === "pass").length;
      const validationRate = decisions.length > 0 ? Math.round((approved / decisions.length) * 100) : 0;

      // Action categories
      const catMap: Record<string, number> = {};
      (actionCatRes.data || []).forEach(a => {
        catMap[a.action_type] = (catMap[a.action_type] || 0) + 1;
      });
      const actionCategories = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));

      // Mint trend by day
      const trendMap: Record<string, number> = {};
      (mintTrendRes.data || []).forEach(r => {
        const day = (r.created_at || "").slice(0, 10);
        trendMap[day] = (trendMap[day] || 0) + Number(r.total_reward || 0);
      });
      const mintTrend = Object.entries(trendMap).slice(-14).map(([date, amount]) => ({
        date: date.slice(5),
        amount,
      }));

      return { totalLight, totalMinted, dau, wau, mau, validationRate, actionCategories, mintTrend };
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  const kpis = [
    { label: "Total Light Score", value: stats?.totalLight?.toLocaleString() || "0", icon: TrendingUp, color: "text-primary" },
    { label: "Total FUN Minted", value: stats?.totalMinted?.toLocaleString() || "0", icon: Coins, color: "text-amber-500" },
    { label: "DAU / WAU / MAU", value: `${stats?.dau} / ${stats?.wau} / ${stats?.mau}`, icon: Users, color: "text-emerald-500" },
    { label: "Validation Rate", value: `${stats?.validationRate}%`, icon: ShieldCheck, color: "text-blue-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <k.icon className={`w-4 h-4 ${k.color}`} />
                <span className="text-xs text-muted-foreground">{k.label}</span>
              </div>
              <p className="text-lg font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <MintPipelineHealthCard />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">FUN Mint Trend (14 ngày)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats?.mintTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Action Categories</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats?.actionCategories || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {(stats?.actionCategories || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
