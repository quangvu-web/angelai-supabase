import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BehaviorSequence {
  id: string;
  user_id: string;
  sequence_type: string;
  actions: string[];
  stage: number;
  max_stage: number;
  sequence_multiplier: number;
  status: "active" | "completed" | "expired";
  started_at: string;
  completed_at: string | null;
  expires_at: string;
}

const SEQUENCE_LABELS: Record<string, { vi: string; en: string; icon: string }> = {
  light_growth: { vi: "Chuỗi Tăng Trưởng Ánh Sáng", en: "Light Growth Chain", icon: "🌱" },
  mentorship: { vi: "Chuỗi Hướng Dẫn", en: "Mentorship Chain", icon: "🤝" },
  value_creation: { vi: "Chuỗi Tạo Giá Trị", en: "Value Creation Loop", icon: "💎" },
  conflict_harmony: { vi: "Chuỗi Hoà Giải", en: "Conflict → Harmony", icon: "🕊️" },
  economic_integrity: { vi: "Chuỗi Kinh Tế Thuần Khiết", en: "Economic Integrity", icon: "💫" },
};

export function getSequenceLabel(type: string, lang: string = "vi") {
  const label = SEQUENCE_LABELS[type];
  if (!label) return { name: type, icon: "🔗" };
  return { name: lang === "vi" ? label.vi : label.en, icon: label.icon };
}

export function useBehaviorSequences() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["behavior-sequences", user?.id],
    queryFn: async () => {
      if (!user?.id) return { active: [], completed: [] };

      const { data: sequences, error } = await supabase
        .from("pplp_behavior_sequences")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const typed = (sequences || []) as unknown as BehaviorSequence[];
      return {
        active: typed.filter((s) => s.status === "active"),
        completed: typed.filter((s) => s.status === "completed"),
      };
    },
    enabled: !!user?.id,
  });

  return {
    activeSequences: data?.active || [],
    completedSequences: data?.completed || [],
    isLoading,
    refetch,
  };
}
