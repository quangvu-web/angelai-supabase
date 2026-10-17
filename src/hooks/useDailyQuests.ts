import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DailyQuest {
  id: string;
  template_id: string;
  status: "pending" | "in_progress" | "completed" | "expired" | "frozen";
  assigned_date: string;
  xp_awarded: number;
  camly_awarded: number;
  multiplier_applied: number;
  evidence_ref: string | null;
  template: {
    code: string;
    dimension: string;
    title_vi: string;
    title_en: string;
    description_vi: string | null;
    icon: string;
    base_xp: number;
    base_camly: number;
    requires_evidence: boolean;
    evidence_type: string | null;
  };
}

export interface QuestStreak {
  current_streak: number;
  longest_streak: number;
  multiplier: number;
  last_claim_date: string | null;
}

const todayHCM = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }))
    .toISOString().slice(0, 10);

export function useDailyQuests() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const questsQuery = useQuery({
    queryKey: ["daily-quests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_daily_quests")
        .select("*, template:quest_templates(*)")
        .eq("user_id", user!.id)
        .eq("assigned_date", todayHCM())
        .order("status", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DailyQuest[];
    },
  });

  const streakQuery = useQuery({
    queryKey: ["quest-streak", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_quest_streaks")
        .select("current_streak, longest_streak, multiplier, last_claim_date")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data ?? { current_streak: 0, longest_streak: 0, multiplier: 1, last_claim_date: null }) as QuestStreak;
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (vars: { quest_id: string; evidence_text?: string; evidence_ref?: string }) => {
      const { data, error } = await supabase.functions.invoke("quest-claim", { body: vars });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `+${data.camly_awarded} Camly • +${data.xp_awarded} XP${data.multiplier > 1 ? ` (×${data.multiplier})` : ""}`,
        { description: `Streak: ${data.new_streak} ngày 🔥` }
      );
      if (data.granted_box) {
        toast.success(`🎁 Bạn vừa nhận 1 ${data.granted_box.tier.toUpperCase()} Box!`, {
          description: "Mở ngay tại Kho báu",
        });
      }
      // Trigger referral completion (silent if no referral / expired / already)
      import("@/hooks/useReferral").then(({ tryCompleteReferral }) => {
        tryCompleteReferral().then(() => {
          qc.invalidateQueries({ queryKey: ["camly-balance"] });
        });
      });
      qc.invalidateQueries({ queryKey: ["daily-quests", user?.id] });
      qc.invalidateQueries({ queryKey: ["quest-streak", user?.id] });
      qc.invalidateQueries({ queryKey: ["camly-balance"] });
      qc.invalidateQueries({ queryKey: ["box-tickets", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message || "Claim thất bại"),
  });

  return {
    quests: questsQuery.data ?? [],
    streak: streakQuery.data,
    isLoading: questsQuery.isLoading || streakQuery.isLoading,
    claim: claimMutation.mutate,
    isClaiming: claimMutation.isPending,
    refetch: () => {
      qc.invalidateQueries({ queryKey: ["daily-quests", user?.id] });
      qc.invalidateQueries({ queryKey: ["quest-streak", user?.id] });
    },
  };
}
