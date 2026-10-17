import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SeasonInfo {
  id: string;
  code: string;
  name: string;
  theme: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  xp_per_level: number;
  max_level: number;
  premium_price_camly: number;
}
export interface UserPass {
  id: string;
  user_id: string;
  season_id: string;
  xp: number;
  level: number;
  is_premium: boolean;
  premium_unlocked_at: string | null;
}
export interface SeasonReward {
  id: string;
  level: number;
  track: "free" | "premium";
  reward_type: "camly" | "box_ticket" | "pet_xp" | "badge" | "cosmetic" | "fun_money";
  reward_value: Record<string, unknown> & { amount?: number; xp?: number; tier?: string };
  label: string;
  icon: string | null;
}
export interface ActiveSeasonPayload {
  active: boolean;
  season?: SeasonInfo;
  pass?: UserPass | null;
  rewards?: SeasonReward[];
  claimed?: { level: number; track: "free" | "premium" }[];
}

export function useSeasonPass() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["season-active", user?.id ?? "guest"],
    queryFn: async (): Promise<ActiveSeasonPayload> => {
      const { data, error } = await supabase.rpc("get_active_season");
      if (error) throw error;
      return (data as unknown as ActiveSeasonPayload) ?? { active: false };
    },
    refetchInterval: 60_000,
  });

  // Realtime: refresh on pass updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`season-pass:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_season_pass", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["season-active", user.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  const claim = useMutation({
    mutationFn: async ({ level, track }: { level: number; track: "free" | "premium" }) => {
      const { data, error } = await supabase.rpc("claim_season_reward", { p_level: level, p_track: track });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      toast.success(`🎉 Nhận thưởng level ${v.level} (${v.track === "premium" ? "Premium" : "Free"})`);
      qc.invalidateQueries({ queryKey: ["season-active", user?.id] });
      qc.invalidateQueries({ queryKey: ["box-inventory"] });
    },
    onError: (e: Error) => {
      const map: Record<string, string> = {
        auth_required: "Đăng nhập để nhận thưởng",
        invalid_track: "Track không hợp lệ",
        no_active_season: "Chưa có mùa đang chạy",
        no_pass_yet: "Cần có XP đầu tiên",
        level_not_reached: "Chưa đạt level này",
        premium_required: "Cần mở Premium",
        reward_not_found: "Không có thưởng ở level này",
        already_claimed: "Bạn đã nhận thưởng này rồi",
      };
      toast.error(map[e.message] ?? e.message);
    },
  });

  const unlockPremium = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("unlock_season_premium");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("⭐ Đã mở Premium Pass!");
      qc.invalidateQueries({ queryKey: ["season-active", user?.id] });
      qc.invalidateQueries({ queryKey: ["camly-balance"] });
    },
    onError: (e: Error) => {
      const map: Record<string, string> = {
        auth_required: "Đăng nhập để mở Premium",
        no_active_season: "Chưa có mùa đang chạy",
        insufficient_camly: "Không đủ Camly để mở Premium",
      };
      toast.error(map[e.message] ?? e.message);
    },
  });

  const data = q.data;
  const claimedSet = new Set((data?.claimed ?? []).map((c) => `${c.level}:${c.track}`));

  return {
    isLoading: q.isLoading,
    active: data?.active ?? false,
    season: data?.season,
    pass: data?.pass ?? null,
    rewards: data?.rewards ?? [],
    isClaimed: (level: number, track: "free" | "premium") => claimedSet.has(`${level}:${track}`),
    claim: claim.mutate,
    isClaiming: claim.isPending,
    unlockPremium: unlockPremium.mutate,
    isUnlocking: unlockPremium.isPending,
  };
}
