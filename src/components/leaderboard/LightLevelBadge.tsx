import { CommunityLightInfo } from "@/hooks/useLeaderboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { TrendingUp, Minus, TrendingDown } from "lucide-react";

interface LightLevelBadgeProps {
  lightInfo?: CommunityLightInfo;
  size?: "xs" | "sm" | "md" | "lg";
  showTrend?: boolean;
}

const levelColors: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700" },
  2: { bg: "bg-teal-50", border: "border-teal-300", text: "text-teal-700" },
  3: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-700" },
  4: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  5: { bg: "bg-purple-50", border: "border-purple-400", text: "text-purple-700" },
};

const trendConfig = {
  growing: { icon: TrendingUp, label_vi: "Đang phát triển", label_en: "Growing", className: "text-emerald-500" },
  stable: { icon: Minus, label_vi: "Ổn định", label_en: "Stable", className: "text-blue-400" },
  reflecting: { icon: TrendingDown, label_vi: "Chiêm nghiệm", label_en: "Reflecting", className: "text-amber-400" },
  rebalancing: { icon: TrendingDown, label_vi: "Tái cân bằng", label_en: "Rebalancing", className: "text-orange-400" },
};

export function LightLevelBadge({ lightInfo, size = "md", showTrend = true }: LightLevelBadgeProps) {
  const { currentLanguage } = useLanguage();
  
  if (!lightInfo) return null;
  const info = lightInfo;
  const trend = trendConfig[info.trend as keyof typeof trendConfig] || trendConfig.stable;
  const TrendIcon = trend.icon;
  const levelName = currentLanguage === "vi" ? info.name_vi : info.name_en;
  const colors = levelColors[info.level] || levelColors[1];

  if (size === "xs") {
    return (
      <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${colors.bg} border ${colors.border} shadow-sm max-w-full`}>
        <span className="text-[10px]">{info.icon}</span>
        <span className={`text-[9px] font-semibold ${colors.text} truncate`}>{levelName}</span>
      </div>
    );
  }

  if (size === "sm") {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${colors.bg} border ${colors.border} shadow-sm`}>
        <span className="text-xs">{info.icon}</span>
        <span className={`text-[10px] font-semibold ${colors.text}`}>Light {levelName}</span>
      </div>
    );
  }

  if (size === "lg") {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${colors.bg} border-2 ${colors.border} shadow-sm`}>
        <span className="text-base">{info.icon}</span>
        <span className={`text-sm font-bold ${colors.text}`}>Light {levelName}</span>
        {showTrend && <TrendIcon className={`w-3.5 h-3.5 ${trend.className}`} />}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg} border ${colors.border} shadow-sm`}>
      <span className="text-sm">{info.icon}</span>
      <span className={`text-xs font-semibold ${colors.text}`}>Light {levelName}</span>
      {showTrend && <TrendIcon className={`w-3 h-3 ${trend.className}`} />}
    </div>
  );
}
