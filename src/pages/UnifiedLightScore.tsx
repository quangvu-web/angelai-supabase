import { AppLayout } from "@/components/layouts/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Globe, History, TrendingUp, Shield, User, Activity, Link2, Eye, Leaf, AlertTriangle, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GuestCTABanner } from "@/components/guest/GuestCTABanner";
import { format } from "date-fns";
import { useDimensionScores } from "@/hooks/useDimensionScores";
import { getLightLevelInfo } from "@/lib/scoring-engine";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";

function useLightScoreHistory(userId?: string) {
  return useQuery({
    queryKey: ["light-score-history", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("features_user_day")
        .select("date, daily_light_score, count_questions, count_posts, count_comments, count_help")
        .eq("user_id", userId!)
        .order("date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data || [];
    },
  });
}

const DIMENSION_CONFIG = [
  { key: "identity_score" as const, label: "Identity", icon: User, radarLabel: "Identity" },
  { key: "activity_score" as const, label: "Activity", icon: Activity, radarLabel: "Activity" },
  { key: "onchain_score" as const, label: "On-Chain", icon: Link2, radarLabel: "OnChain" },
  { key: "transparency_score" as const, label: "Transparency", icon: Eye, radarLabel: "Transparency" },
  { key: "ecosystem_score" as const, label: "Ecosystem", icon: Leaf, radarLabel: "Ecosystem" },
];

export default function UnifiedLightScore() {
  const { user, isLoading } = useAuth();
  const { data: history = [], isLoading: historyLoading } = useLightScoreHistory(user?.id);
  const { data: dimensions, isLoading: dimLoading } = useDimensionScores();

  const totalScore = dimensions?.total_light_score ?? 0;
  const levelInfo = getLightLevelInfo(totalScore);

  const radarData = DIMENSION_CONFIG.map((d) => ({
    dimension: d.radarLabel,
    value: dimensions?.[d.key] ?? 0,
    fullMark: 100,
  }));

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            Light Score
          </h1>
          <p className="text-muted-foreground mt-1">
            Web3 Reputation System — 5 Trụ Cột Ánh Sáng
          </p>
        </div>

        {!user && (
          <GuestCTABanner
            title="Đăng ký để xem Light Score cá nhân"
            description="Tạo tài khoản miễn phí để tích lũy Điểm Ánh Sáng và theo dõi hành trình của bạn ✨"
          />
        )}

        {/* Total Score + Level */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="md:col-span-1 border-primary/20 bg-primary/5">
            <CardContent className="pt-6 text-center">
              <div className="text-4xl mb-1">{levelInfo.emoji}</div>
              <p className="text-sm text-muted-foreground">Level</p>
              <p className="text-xl font-bold text-foreground">{dimensions?.level_name ?? "Light Seed"}</p>
              <p className="text-3xl font-bold text-primary mt-2">{totalScore.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">/ 500 điểm tối đa</p>

              {/* Streak & Decay indicators */}
              {dimensions && (
                <div className="mt-4 space-y-2">
                  {(dimensions.streak_bonus_pct ?? 0) > 0 && (
                    <div className="flex items-center justify-center gap-1 text-xs text-green-500">
                      <Flame className="w-3 h-3" />
                      Streak +{((dimensions.streak_bonus_pct ?? 0) * 100).toFixed(0)}%
                    </div>
                  )}
                  {dimensions.decay_applied && (
                    <div className="flex items-center justify-center gap-1 text-xs text-amber-500">
                      <AlertTriangle className="w-3 h-3" />
                      Decay: {dimensions.inactive_days}d inactive
                    </div>
                  )}
                  {(dimensions.risk_penalty ?? 0) > 0 && (
                    <div className="flex items-center justify-center gap-1 text-xs text-destructive">
                      <Shield className="w-3 h-3" />
                      Risk Penalty: -{dimensions.risk_penalty}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Radar Chart */}
          <Card className="md:col-span-2">
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Light Score"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 5 Dimension Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
          {DIMENSION_CONFIG.map((dim) => {
            const score = dimensions?.[dim.key] ?? 0;
            const Icon = dim.icon;
            return (
              <Card key={dim.key} className="border-border/50">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground">{dim.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{score.toFixed(0)}</p>
                  <Progress value={score} className="h-1.5 mt-2" />
                  <p className="text-[10px] text-muted-foreground mt-1">/ 100</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Lịch sử Light Score (Activity)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <p className="text-muted-foreground text-center py-8">Đang tải...</p>
            ) : history.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Ngày</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">LS</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Câu hỏi</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Bài viết</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Bình luận</th>
                      <th className="text-right py-3 px-2 text-muted-foreground font-medium">Giúp đỡ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.date} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-2">{format(new Date(row.date), "dd/MM/yyyy")}</td>
                        <td className="text-right py-2 px-2 font-semibold">{(row.daily_light_score ?? 0).toFixed(1)}</td>
                        <td className="text-right py-2 px-2">{row.count_questions ?? 0}</td>
                        <td className="text-right py-2 px-2">{row.count_posts ?? 0}</td>
                        <td className="text-right py-2 px-2">{row.count_comments ?? 0}</td>
                        <td className="text-right py-2 px-2">{row.count_help ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}
