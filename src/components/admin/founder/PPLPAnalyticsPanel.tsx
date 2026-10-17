import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

const PILLARS = ["pillar_s", "pillar_t", "pillar_h", "pillar_c", "pillar_u"] as const;
const PILLAR_LABELS: Record<string, string> = {
  pillar_s: "Sám Hối (SH)",
  pillar_t: "Biết Ơn (BƠ)",
  pillar_h: "Phụng Sự (PS)",
  pillar_c: "Giúp Đỡ (GĐ)",
  pillar_u: "Trao Tặng (TT)",
};

export default function PPLPAnalyticsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-pplp-analytics"],
    queryFn: async () => {
      const { data: scores } = await supabase
        .from("pplp_scores")
        .select("pillar_s, pillar_t, pillar_h, pillar_c, pillar_u, decision")
        .limit(1000);

      const rows = scores || [];
      const count = rows.length || 1;

      const avgs = PILLARS.map(p => ({
        pillar: PILLAR_LABELS[p],
        avg: Number((rows.reduce((s, r) => s + Number(r[p] || 0), 0) / count).toFixed(2)),
      }));

      const strongest = [...avgs].sort((a, b) => b.avg - a.avg)[0]?.pillar || "-";
      const weakest = [...avgs].sort((a, b) => a.avg - b.avg)[0]?.pillar || "-";

      // Score distribution buckets
      const buckets = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
      const distMap: Record<string, number> = {};
      buckets.slice(0, -1).forEach((b, i) => {
        const label = `${(b * 100).toFixed(0)}-${(buckets[i + 1] * 100).toFixed(0)}%`;
        distMap[label] = 0;
      });
      rows.forEach(r => {
        const avg = PILLARS.reduce((s, p) => s + Number(r[p] || 0), 0) / 5;
        const idx = Math.min(Math.floor(avg / 0.2), 4);
        const label = `${(buckets[idx] * 100).toFixed(0)}-${(buckets[idx + 1] * 100).toFixed(0)}%`;
        distMap[label] = (distMap[label] || 0) + 1;
      });
      const distribution = Object.entries(distMap).map(([range, count]) => ({ range, count }));

      const rejected = rows.filter(r => r.decision === "fail").length;
      const flagged = rows.filter(r => r.decision === "manual_review").length;

      return { avgs, strongest, weakest, distribution, total: rows.length, rejected, flagged };
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Scores</p><p className="text-lg font-bold">{data?.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Strongest Pillar</p><p className="text-lg font-bold text-emerald-600">{data?.strongest}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Weakest Pillar</p><p className="text-lg font-bold text-amber-600">{data?.weakest}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rejected / Flagged</p><p className="text-lg font-bold text-destructive">{data?.rejected} / {data?.flagged}</p></CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Pillar Averages (Radar)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={data?.avgs || []}>
                <PolarGrid />
                <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 9 }} />
                <Radar dataKey="avg" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Score Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.distribution || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
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
