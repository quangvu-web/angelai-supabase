import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface WeeklyQuest {
  id: string;
  code: string;
  title: string;
  description: string | null;
  source: string;
  target_count: number;
  xp_reward: number;
  is_premium_only: boolean;
  position: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimed_at: string | null;
}

export interface WeeklyQuestsPayload {
  season: { id: string; code: string; name: string } | null;
  week_start: string;
  week_end: string;
  is_premium: boolean;
  quests: WeeklyQuest[];
}

export function useWeeklyQuests() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["weekly-quests", user?.id ?? "guest"],
    queryFn: async (): Promise<WeeklyQuestsPayload> => {
      const { data, error } = await supabase.rpc("get_weekly_quests");
      if (error) throw error;
      return (data as unknown as WeeklyQuestsPayload) ?? { season: null, week_start: "", week_end: "", is_premium: false, quests: [] };
    },
    refetchInterval: 60_000,
  });

  // Refresh khi xp_log thay đổi
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`weekly-xp:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_season_xp_log", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["weekly-quests", user.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const claim = useMutation({
    mutationFn: async (templateId: string) => {
      const { data, error } = await supabase.rpc("claim_weekly_quest", { _template_id: templateId });
      if (error) throw error;
      return data as { ok: boolean; xp_reward: number; week_start: string };
    },
    onSuccess: (d) => {
      toast.success(`🎯 +${d.xp_reward} XP mùa từ quest tuần!`);
      qc.invalidateQueries({ queryKey: ["weekly-quests", user?.id] });
      qc.invalidateQueries({ queryKey: ["season-active", user?.id] });
    },
    onError: (e: Error) => {
      const map: Record<string, string> = {
        auth_required: "Đăng nhập để nhận thưởng",
        no_active_season: "Chưa có mùa đang chạy",
        quest_not_found: "Quest không tồn tại",
        premium_required: "Cần Premium Pass để claim quest này",
        not_completed: "Chưa đủ tiến độ",
        already_claimed: "Bạn đã nhận quest này tuần này rồi",
      };
      toast.error(map[e.message] ?? e.message);
    },
  });

  return {
    isLoading: q.isLoading,
    season: q.data?.season ?? null,
    weekStart: q.data?.week_start ?? "",
    weekEnd: q.data?.week_end ?? "",
    isPremium: q.data?.is_premium ?? false,
    quests: q.data?.quests ?? [],
    claim: claim.mutate,
    isClaiming: claim.isPending,
  };
}
