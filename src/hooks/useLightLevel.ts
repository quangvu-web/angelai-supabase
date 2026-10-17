import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LightLevel {
  level: number;
  name_vi: string;
  name_en: string;
  icon: string;
  color: string;
  total_score: number;
  avg_light_score: number;
  completed_sequences: number;
  min_score: number;
  max_score: number | null;
  perks: unknown[];
  // v2.5 3-layer fields
  personal_light?: number;
  network_light?: number;
  legacy_light?: number;
  total_light_raw?: number;
  display_light?: number;
  light_tier?: string;
}

// v2.5 tier config
const TIER_CONFIG: Record<string, { level: number; name_vi: string; name_en: string; icon: string; color: string; min: number; max: number | null }> = {
  seed_light:    { level: 1, name_vi: "Hạt Giống Ánh Sáng", name_en: "Seed Light",    icon: "🌱", color: "#10b981", min: 0,   max: 50  },
  pure_light:    { level: 2, name_vi: "Ánh Sáng Thuần Khiết", name_en: "Pure Light",    icon: "🌿", color: "#14b8a6", min: 50,  max: 150 },
  guiding_light: { level: 3, name_vi: "Ánh Sáng Dẫn Đường", name_en: "Guiding Light",  icon: "🏗️", color: "#0ea5e9", min: 150, max: 300 },
  radiant_light: { level: 4, name_vi: "Ánh Sáng Rạng Rỡ", name_en: "Radiant Light",   icon: "🛡️", color: "#f59e0b", min: 300, max: 500 },
  legacy_light:  { level: 5, name_vi: "Ánh Sáng Di Sản", name_en: "Legacy Light",    icon: "⭐", color: "#a855f7", min: 500, max: 800 },
  cosmic_light:  { level: 6, name_vi: "Ánh Sáng Vũ Trụ", name_en: "Cosmic Light",    icon: "🌟", color: "#ec4899", min: 800, max: null },
};

export function useLightLevel() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["light-level", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // v2.5: Try user_light_scores first
      const { data: lightScores } = await (supabase as any)
        .from("user_light_scores")
        .select("personal_light, network_light, legacy_light, total_light_raw, display_light, light_tier")
        .eq("user_id", user.id)
        .maybeSingle();

      if (lightScores && lightScores.display_light > 0) {
        const tier = TIER_CONFIG[lightScores.light_tier] || TIER_CONFIG.seed_light;
        return {
          level: tier.level,
          name_vi: tier.name_vi,
          name_en: tier.name_en,
          icon: tier.icon,
          color: tier.color,
          total_score: lightScores.display_light,
          avg_light_score: lightScores.total_light_raw,
          completed_sequences: 0,
          min_score: tier.min,
          max_score: tier.max,
          perks: [],
          personal_light: lightScores.personal_light,
          network_light: lightScores.network_light,
          legacy_light: lightScores.legacy_light,
          total_light_raw: lightScores.total_light_raw,
          display_light: lightScores.display_light,
          light_tier: lightScores.light_tier,
        } as LightLevel;
      }

      // Fallback: legacy RPC
      const { data: legacyData, error } = await supabase.rpc("get_user_light_level", {
        _user_id: user.id,
      });

      if (error) throw error;
      return legacyData as unknown as LightLevel;
    },
    enabled: !!user?.id,
  });

  return {
    lightLevel: data,
    isLoading,
  };
}
