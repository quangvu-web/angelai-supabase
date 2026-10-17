import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AchievementItem {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: number;
  title_text: string | null;
  sort_order: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export function useAchievements(userId?: string) {
  const { user } = useAuth();
  const target = userId ?? user?.id ?? null;
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!target) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: achData }, { data: profileData }] = await Promise.all([
      supabase.rpc("get_user_achievements", { _user_id: target }),
      supabase.from("profiles").select("active_achievement_code").eq("user_id", target).maybeSingle(),
    ]);
    setItems((achData as unknown as AchievementItem[]) ?? []);
    setActiveCode((profileData?.active_achievement_code as string | null) ?? null);
    setLoading(false);
  }, [target]);

  useEffect(() => {
    load();
  }, [load]);

  const setActiveTitle = useCallback(
    async (code: string | null) => {
      const { data, error } = await supabase.rpc("set_active_title", { _code: code as string });
      if (error) throw error;
      await load();
      return data;
    },
    [load]
  );

  const unlocked = items.filter((i) => i.unlocked);
  const total = items.length;

  return { items, unlocked, total, activeCode, loading, reload: load, setActiveTitle };
}
