import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Coins, TrendingUp, Percent, ArrowUpDown } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(38,92%,50%)", "hsl(142,76%,36%)", "hsl(0,84%,60%)"];

export default function EconomyFlowPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-economy"],
    queryFn: async () => {
      const [distRes, txRes, allocRes] = await Promise.all([
        supabase.from("fun_distribution_logs")
          .select("total_reward, user_amount, platform_amount, genesis_amount, partners_amount, created_at")
          .order("created_at", { ascending: true }).limit(500),
        supabase.from("camly_coin_transactions")
          .select("amount, transaction_type, created_at")
          .order("created_at", { ascending: false }).limit(500),
        supabase.from("pplp_mint_allocations")
          .select("fun_allocated, status")
          .limit(500),
      ]);

      const dists = distRes.data || [];
      const totalUser = dists.reduce((s, r) => s + Number(r.user_amount || 0), 0);
      const totalPlatform = dists.reduce((s, r) => s + Number(r.platform_amount || 0), 0);
      const totalGenesis = dists.reduce((s, r) => s + Number(r.genesis_amount || 0), 0);
      const totalPartners = dists.reduce((s, r) => s + Number(r.partners_amount || 0), 0);
      const totalMinted = dists.reduce((s, r) => s + Number(r.total_reward || 0), 0);

      const splitData = [
        { name: "User (99%)", value: totalUser },
        { name: "Platform (1%)", value: totalPlatform },
        { name: "Genesis", value: totalGenesis },
        { name: "Partners", value: totalPartners },
      ].filter(d => d.value > 0);

      // Mint trend by day
      const trendMap: Record<string, number> = {};
      dists.forEach(r => {
        const day = (r.created_at || "").slice(0, 10);
        trendMap[day] = (trendMap[day] || 0) + Number(r.total_reward || 0);
      });
      const mintTrend = Object.entries(trendMap).slice(-14).map(([date, amount]) => ({ date: date.slice(5), amount }));

      // Transaction type breakdown
      const txTypeMap: Record<string, number> = {};
      (txRes.data || []).forEach(t => {
        txTypeMap[t.transaction_type] = (txTypeMap[t.transaction_type] || 0) + Number(t.amount || 0);
      });
      const txBreakdown = Object.entries(txTypeMap).map(([type, total]) => ({ type, total: Math.abs(total) }));

      const totalAllocated = (allocRes.data || []).reduce((s, r) => s + Number(r.fun_allocated || 0), 0);

      return { totalMinted, totalUser, totalPlatform, totalAllocated, splitData, mintTrend, txBreakdown };
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  const kpis = [
    { label: "Total Minted", value: data?.totalMinted?.toLocaleString() || "0", icon: Coins, color: "text-amber-500" },
    { label: "User Share", value: data?.totalUser?.toLocaleString() || "0", icon: TrendingUp, color: "text-emerald-500" },
    { label: "Platform Share", value: data?.totalPlatform?.toLocaleString() || "0", icon: Percent, color: "text-blue-500" },
    { label: "Allocated", value: data?.totalAllocated?.toLocaleString() || "0", icon: ArrowUpDown, color: "text-purple-500" },
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mint Flow (14 ngày)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data?.mintTrend || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">99/1 Split Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data?.splitData || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {(data?.splitData || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">FUN Usage Breakdown</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.txBreakdown || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 9 }} width={120} />
              <Tooltip />
              <Bar dataKey="total" fill="hsl(38,92%,50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
