import { useLightLevel } from "@/hooks/useLightLevel";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, Minus, RefreshCw, Scale } from "lucide-react";

const TREND_CONFIG: Record<string, { icon: typeof TrendingUp; label_vi: string; label_en: string; color: string }> = {
  growing: { icon: TrendingUp, label_vi: "Đang tăng trưởng", label_en: "Growing", color: "text-green-500" },
  stable: { icon: Minus, label_vi: "Ổn định", label_en: "Stable", color: "text-blue-500" },
  reflecting: { icon: RefreshCw, label_vi: "Đang suy ngẫm", label_en: "Reflecting", color: "text-amber-500" },
  rebalancing: { icon: Scale, label_vi: "Đang cân bằng lại", label_en: "Rebalancing", color: "text-purple-500" },
};

export function LightLevelBadge() {
  const { lightLevel, isLoading } = useLightLevel();
  const { currentLanguage: language } = useLanguage();
  const { user } = useAuth();

  const { data: ledgerEntry } = useQuery({
    queryKey: ["light-ledger-trend", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase as any)
        .from("light_score_ledger")
        .select("trend, rule_version")
        .eq("user_id", user.id)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { trend: string; rule_version: string } | null;
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  if (!lightLevel) return null;

  const name = language === "vi" ? lightLevel.name_vi : lightLevel.name_en;
  const progress = lightLevel.max_score
    ? ((lightLevel.total_score - lightLevel.min_score) / (lightLevel.max_score - lightLevel.min_score)) * 100
    : 100;

  const trend = ledgerEntry?.trend || "stable";
  const trendInfo = TREND_CONFIG[trend] || TREND_CONFIG.stable;
  const TrendIcon = trendInfo.icon;

  return (
    <Card className="border-0 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg"
            style={{ backgroundColor: lightLevel.color + "22", borderColor: lightLevel.color, borderWidth: 2 }}
          >
            {lightLevel.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {language === "vi" ? "Cấp độ Ánh Sáng" : "Light Level"} {lightLevel.level}
            </p>
            <h3 className="text-lg font-bold truncate" style={{ color: lightLevel.color }}>
              {name}
            </h3>
            <div className="mt-1 flex items-center gap-2">
              <TrendIcon className={`h-3.5 w-3.5 ${trendInfo.color}`} />
              <span className={`text-xs font-medium ${trendInfo.color}`}>
                {language === "vi" ? trendInfo.label_vi : trendInfo.label_en}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, progress)}%`, backgroundColor: lightLevel.color }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
