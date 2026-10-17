import { AppLayout } from "@/components/layouts/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { PPLPScoreRadar } from "@/components/pplp/PPLPScoreRadar";
import { LightLevelBadge } from "@/components/pplp/LightLevelBadge";
import { ValidationDetailCard } from "@/components/pplp/ValidationDetailCard";
import { usePPLPScore, PPLPPillarScores } from "@/hooks/usePPLPScore";
import { useLightLevel } from "@/hooks/useLightLevel";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Sun,
  Flame,
  Coins,
  Calendar,
  TrendingUp,
  User,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function LightProfile() {
  const { user } = useAuth();
  const { currentLanguage: language } = useLanguage();
  const { scores, stats, avgPillars, isLoading: scoresLoading } = usePPLPScore();
  const { lightLevel, isLoading: levelLoading } = useLightLevel();

  // Fetch profile info
  const { data: profile } = useQuery({
    queryKey: ["profile-light", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, handle")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch light score history
  const { data: lightHistory } = useQuery({
    queryKey: ["light-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase as any)
        .from("light_score_ledger")
        .select("period, final_light_score, level, period_start")
        .eq("user_id", user.id)
        .order("period_start", { ascending: true })
        .limit(20);
      return (data || []) as Array<{
        period: string;
        final_light_score: number;
        level: string;
        period_start: string;
      }>;
    },
    enabled: !!user?.id,
  });

  // Fetch streak
  const { data: streak } = useQuery({
    queryKey: ["streak-light", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from("daily_login_tracking")
        .select("streak_count")
        .eq("user_id", user.id)
        .order("login_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.streak_count || 0;
    },
    enabled: !!user?.id,
  });

  // Fetch total FUN minted
  const { data: totalMinted } = useQuery({
    queryKey: ["total-minted", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { data } = await supabase
        .from("fun_distribution_logs")
        .select("user_amount")
        .eq("actor_id", user.id);
      return data?.reduce((sum, d) => sum + (d.user_amount || 0), 0) || 0;
    },
    enabled: !!user?.id,
  });

  const isLoading = scoresLoading || levelLoading;

  // Compute trust level (0-10) from streak + actions + avg score
  const trustLevel = Math.min(
    10,
    Math.round(
      ((streak || 0) / 30) * 3 +
        ((stats?.passed_actions || 0) / 50) * 3 +
        ((stats?.avg_light_score || 0) / 100) * 4
    )
  );

  const chartData = (lightHistory || []).map((h) => ({
    name: h.period,
    score: Number(h.final_light_score),
  }));

  if (!user) {
    return (
      <AppLayout>
        <main className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          {language === "vi" ? "Vui lòng đăng nhập" : "Please sign in"}
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Back */}
          <Link to="/earn">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              {language === "vi" ? "Quay lại Earn" : "Back to Earn"}
            </Button>
          </Link>

          {/* Profile Header */}
          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 ring-2 ring-primary/30">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-xl font-bold">
                    {profile?.display_name || user.email?.split("@")[0]}
                  </h1>
                  {profile?.handle && (
                    <p className="text-sm text-muted-foreground">@{profile.handle}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Light Level Badge */}
          <LightLevelBadge />

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border-0 bg-gradient-to-br from-amber-100/50 to-orange-100/50 dark:from-amber-950/30 dark:to-orange-950/30">
                  <CardContent className="p-4 text-center">
                    <Sun className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                    <p className="text-2xl font-bold">{stats?.avg_light_score || 0}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {language === "vi" ? "Điểm TB" : "Avg Score"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-gradient-to-br from-green-100/50 to-emerald-100/50 dark:from-green-950/30 dark:to-emerald-950/30">
                  <CardContent className="p-4 text-center">
                    <Coins className="h-5 w-5 mx-auto text-green-500 mb-1" />
                    <p className="text-2xl font-bold">{(totalMinted || 0).toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">FUN Minted</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-gradient-to-br from-blue-100/50 to-cyan-100/50 dark:from-blue-950/30 dark:to-cyan-950/30">
                  <CardContent className="p-4 text-center">
                    <Flame className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                    <p className="text-2xl font-bold">{streak || 0}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {language === "vi" ? "Ngày streak" : "Streak Days"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-gradient-to-br from-purple-100/50 to-violet-100/50 dark:from-purple-950/30 dark:to-violet-950/30">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-5 w-5 mx-auto text-purple-500 mb-1" />
                    <p className="text-2xl font-bold">{stats?.total_actions || 0}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {language === "vi" ? "Hành động" : "Actions"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Trust Level */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {language === "vi" ? "Mức Tin Cậy" : "Trust Level"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Progress value={trustLevel * 10} className="flex-1 h-3" />
                    <span className="font-bold text-lg text-primary">{trustLevel}/10</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {language === "vi"
                      ? "Dựa trên: streak liên tục + số hành động pass + điểm Light Score trung bình"
                      : "Based on: streak consistency + passed actions + avg Light Score"}
                  </p>
                </CardContent>
              </Card>

              {/* Radar + History */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Aggregate Radar */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {language === "vi" ? "Biểu đồ 5 Trụ Cột" : "5 Pillar Radar"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <PPLPScoreRadar pillars={avgPillars} size="lg" />
                  </CardContent>
                </Card>

                {/* Light Score History Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {language === "vi" ? "Lịch sử Light Score" : "Light Score History"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {language === "vi" ? "Chưa có dữ liệu" : "No data yet"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Validated Actions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {language === "vi" ? "Hành động gần đây đã xác thực" : "Recent Validated Actions"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {scores.length > 0 ? (
                    scores.slice(0, 10).map((score) => (
                      <ValidationDetailCard
                        key={score.action_id}
                        actionId={score.action_id}
                        actionType={(score as any).action_type || "action"}
                        pillars={{
                          pillar_s: score.pillar_s,
                          pillar_t: score.pillar_t,
                          pillar_h: score.pillar_h,
                          pillar_c: score.pillar_c,
                          pillar_u: score.pillar_u,
                        }}
                        lightScore={score.light_score}
                        decision={score.decision}
                        finalReward={score.reward_amount}
                        qualityQ={(score as any).quality_q}
                        impactI={(score as any).impact_i}
                        integrityK={(score as any).integrity_k}
                        createdAt={score.created_at}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {language === "vi" ? "Chưa có hành động nào" : "No actions yet"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </AppLayout>
  );
}
