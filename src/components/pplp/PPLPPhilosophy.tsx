import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Eye, EyeOff, Clock } from "lucide-react";

const antiEgoLayers = [
  {
    icon: EyeOff,
    title_vi: "Không bảng xếp hạng cạnh tranh",
    title_en: "No competitive leaderboard",
    desc_vi: "Chỉ hiển thị Light Level cá nhân và xu hướng tăng trưởng. Không Top 1 – Top 2.",
    desc_en: "Only personal Light Level and growth trends. No Top 1 – Top 2.",
  },
  {
    icon: Eye,
    title_vi: "Không hiển thị điểm chi tiết công khai",
    title_en: "No public detailed scores",
    desc_vi: 'Người khác chỉ thấy: "Light Stable", "Light Growing", "Light Builder", "Light Guardian".',
    desc_en: 'Others only see: "Light Stable", "Light Growing", "Light Builder", "Light Guardian".',
  },
  {
    icon: Clock,
    title_vi: "Mint không tức thì",
    title_en: "No instant minting",
    desc_vi: "Có độ trễ để loại bỏ hành vi kích thích dopamine và chặn động cơ ngắn hạn.",
    desc_en: "Deliberate delay to eliminate dopamine-driven behavior and short-term motives.",
  },
];

export function PPLPPhilosophy() {
  const { currentLanguage: language } = useLanguage();
  const isVi = language === "vi";

  return (
    <Card className="border-0 bg-gradient-to-br from-emerald-50/60 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/20">
      <CardContent className="p-5 space-y-5">
        {/* Anti-Ego Protection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm">
              {isVi ? "🌿 3 Lớp Bảo Vệ Không Nuôi Ego" : "🌿 3 Anti-Ego Protection Layers"}
            </h3>
          </div>
          <div className="space-y-2">
            {antiEgoLayers.map((layer, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-background/50">
                <div className="p-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mt-0.5">
                  <layer.icon className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{isVi ? layer.title_vi : layer.title_en}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isVi ? layer.desc_vi : layer.desc_en}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Philosophy Quote */}
        <div className="border-t border-emerald-200/50 dark:border-emerald-800/30 pt-4">
          <blockquote className="text-sm italic text-muted-foreground space-y-2 pl-3 border-l-2 border-emerald-400">
            <p>
              {isVi
                ? '"PLP không tạo ra người nổi tiếng. PLP tạo ra người có giá trị."'
                : '"PLP doesn\'t create celebrities. PLP creates people of value."'}
            </p>
            <p>
              {isVi
                ? '"FUN Money không chảy về nơi ồn ào. FUN Money chảy về nơi có nhịp sống tử tế và bền vững."'
                : '"FUN Money doesn\'t flow to noise. FUN Money flows to kindness and sustainability."'}
            </p>
          </blockquote>
        </div>
      </CardContent>
    </Card>
  );
}
