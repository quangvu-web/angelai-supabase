import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LanternTheme {
  key: string;
  label: string;
  emoji: string;
  dim: string;
  prompt: string;
}

export interface LanternDay {
  day_idx: number;
  theme_key: string;
  ai_score: number;
  camly_awarded: number;
  xp_awarded: number;
  completed_at: string;
  evidence: string;
}

export interface LanternProgress {
  ok: boolean;
  week_start: string;
  themes: LanternTheme[];
  days: LanternDay[];
  bonus_claimed: boolean;
  bonus: { camly_awarded: number; xp_awarded: number; claimed_at: string } | null;
}

export function useLanternPath() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const progress = useQuery({
    queryKey: ["lantern-progress", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LanternProgress | null> => {
      const { data, error } = await supabase.rpc("lantern_get_my_progress");
      if (error) throw error;
      return data as unknown as LanternProgress;
    },
    refetchOnWindowFocus: false,
  });

  const submitDay = useMutation({
    mutationFn: async (input: { day_idx: number; theme_key: string; evidence: string }) => {
      const { data, error } = await supabase.functions.invoke("lantern-submit", { body: input });
      if (error) throw error;
      return data as { ok: boolean; reason?: string; camly?: number; xp?: number; score?: number; ai_reason?: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lantern-progress"] }),
  });

  const claimWeekly = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("lantern_claim_weekly_bonus");
      if (error) throw error;
      return data as { ok: boolean; reason?: string; camly?: number; xp?: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lantern-progress"] }),
  });

  return {
    progress: progress.data,
    isLoading: progress.isLoading,
    refetch: progress.refetch,
    submitDay: submitDay.mutateAsync,
    isSubmitting: submitDay.isPending,
    claimWeekly: claimWeekly.mutateAsync,
    isClaiming: claimWeekly.isPending,
  };
}
