import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Shield, Coins } from "lucide-react";

const layers = [
  {
    icon: Sparkles,
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    title_vi: "1️⃣ Light Score (Điểm năng lượng)",
    title_en: "1️⃣ Light Score (Energy Score)",
    desc_vi: "Thước đo hành vi & tần số. Không phải ai có điểm cũng được mint. Light Score = 5 Cột Trụ × Reputation × Consistency × Sequence – Integrity Penalty.",
    desc_en: "Behavior & frequency metric. Having a score doesn't guarantee minting. Light Score = 5 Pillars × Reputation × Consistency × Sequence – Integrity Penalty.",
  },
  {
    icon: Shield,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    title_vi: "2️⃣ Mint Eligibility (Điều kiện mint)",
    title_en: "2️⃣ Mint Eligibility",
    desc_vi: "Dựa trên Reputation, Consistency, Integrity — không dựa trên cảm xúc. Chặn đội nhóm tự chấm điểm, thưởng cho nhịp điệu đều đặn.",
    desc_en: "Based on Reputation, Consistency, Integrity — not emotions. Blocks group self-scoring, rewards steady rhythm.",
  },
  {
    icon: Coins,
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-900/30",
    title_vi: "3️⃣ FUN Money Flow (Dòng chảy phát hành)",
    title_en: "3️⃣ FUN Money Flow",
    desc_vi: "Mint theo chu kỳ, phân bổ theo giá trị thật toàn hệ. FUN = (Mint Pool) × (Light của bạn / Tổng Light hệ thống). Không farm vô hạn.",
    desc_en: "Cycle-based minting, allocated by real ecosystem value. FUN = (Mint Pool) × (Your Light / Total System Light). No infinite farming.",
  },
];

export function ThreeLayerRewardExplainer() {
  const { currentLanguage: language } = useLanguage();
  const isVi = language === "vi";

  return (
    <Card className="border-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
      <CardContent className="p-5 space-y-4">
        <h3 className="font-semibold text-sm">
          {isVi ? "🌟 3 Lớp trong hệ thống thưởng" : "🌟 3 Layers of the Reward System"}
        </h3>
        <div className="space-y-3">
          {layers.map((layer, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${layer.bg} mt-0.5`}>
                <layer.icon className={`h-4 w-4 ${layer.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {isVi ? layer.title_vi : layer.title_en}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isVi ? layer.desc_vi : layer.desc_en}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
