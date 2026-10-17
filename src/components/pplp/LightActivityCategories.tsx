import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers } from "lucide-react";

const CATEGORY_META: Record<string, { vi: string; en: string; icon: string; color: string }> = {
  self_light: { vi: "Hoạt động cá nhân", en: "Self Light", icon: "🧘", color: "#8BC34A" },
  community_interaction: { vi: "Tương tác cộng đồng", en: "Community Interaction", icon: "💬", color: "#2196F3" },
  content_value: { vi: "Tạo giá trị nội dung", en: "Content Value", icon: "✍️", color: "#FF9800" },
  web3_economic: { vi: "Kinh tế Web3", en: "Web3 Economic", icon: "⛓️", color: "#9C27B0" },
  ecosystem_contribution: { vi: "Đóng góp hệ sinh thái", en: "Ecosystem", icon: "🌍", color: "#00BCD4" },
};

interface CategorySummary {
  category: string;
  count: number;
}

export function LightActivityCategories() {
  const { currentLanguage: language } = useLanguage();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["activity-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pplp_activity_categories")
        .select("category, action_type, base_weight, description_vi, description_en")
        .eq("is_active", true);

      if (error) throw error;

      // Group by category
      const grouped: Record<string, CategorySummary> = {};
      for (const row of data || []) {
        if (!grouped[row.category]) {
          grouped[row.category] = { category: row.category, count: 0 };
        }
        grouped[row.category].count++;
      }
      return Object.values(grouped);
    },
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          {language === "vi" ? "6 Nhóm Hoạt Động" : "6 Activity Groups"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(categories || []).map((cat) => {
            const meta = CATEGORY_META[cat.category];
            if (!meta) return null;
            return (
              <div
                key={cat.category}
                className="p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow text-center"
              >
                <div className="text-2xl mb-1">{meta.icon}</div>
                <p className="text-xs font-medium leading-tight" style={{ color: meta.color }}>
                  {language === "vi" ? meta.vi : meta.en}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {cat.count} {language === "vi" ? "hành động" : "actions"}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
