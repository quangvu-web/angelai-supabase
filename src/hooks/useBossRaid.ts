import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BossInfo {
  id: string;
  code: string;
  name: string;
  lore: string | null;
  art_url: string | null;
  total_hp: number;
  current_hp: number;
  hp_pct: number;
  status: "upcoming" | "active" | "defeated" | "expired";
  starts_at: string;
  ends_at: string;
  defeated_at: string | null;
}

export interface BossTopContrib {
  user_id: string;
  display_name: string;
  handle: string | null;
  avatar_url: string | null;
  pct: number;
}

export interface ActiveBossPayload {
  active: boolean;
  boss?: BossInfo;
  me?: { damage: number; pct: number; authenticated: boolean };
  top_contributors?: BossTopContrib[];
}

export interface LootEntry {
  id: string;
  tier: "common" | "rare" | "epic" | "cosmic";
  label: string;
  reward_type: string;
  reward_value: Record<string, unknown>;
  min_pct: number;
  eligible: boolean;
  claimed: boolean;
  position: number;
}

export function useBossRaid() {
  const qc = useQueryClient();

  const active = useQuery({
    queryKey: ["active-boss"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_boss");
      if (error) throw error;
      return (data as unknown) as ActiveBossPayload;
    },
    refetchInterval: 30000,
  });

  const bossId = active.data?.boss?.id;

  const loot = useQuery({
    queryKey: ["boss-loot", bossId],
    enabled: !!bossId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_boss_loot_preview", { p_boss_id: bossId! });
      if (error) throw error;
      return data as unknown as { boss_status: string; my_pct: number; loot: LootEntry[] };
    },
  });

  // Realtime HP updates
  useEffect(() => {
    if (!bossId) return;
    const ch = supabase
      .channel(`raid-boss:${bossId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "raid_bosses", filter: `id=eq.${bossId}` },
        () => qc.invalidateQueries({ queryKey: ["active-boss"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [bossId, qc]);

  const [lastClaimed, setLastClaimed] = useState<LootEntry | null>(null);

  const claim = useMutation({
    mutationFn: async (lootId: string) => {
      if (!bossId) throw new Error("no_boss");
      const { data, error } = await supabase.rpc("claim_boss_loot", {
        p_boss_id: bossId,
        p_loot_id: lootId,
      });
      if (error) throw error;
      const res = data as { success: boolean; error?: string };
      if (!res.success) throw new Error(res.error || "claim_failed");
      const entry = (loot.data?.loot ?? []).find((l) => l.id === lootId) ?? null;
      return entry;
    },
    onSuccess: (entry) => {
      if (entry) setLastClaimed(entry);
      // Mark new tickets for Inventory highlight (kept to first claim of session)
      if (entry?.reward_type === "box_ticket" && !sessionStorage.getItem("inv:newSince")) {
        sessionStorage.setItem("inv:newSince", String(Date.now() - 60_000));
      }
      toast.success("Đã nhận phần thưởng ánh sáng ✨");
      qc.invalidateQueries({ queryKey: ["boss-loot", bossId] });
      qc.invalidateQueries({ queryKey: ["active-boss"] });
    },
    onError: (e: Error) => {
      const map: Record<string, string> = {
        unauthorized: "Hãy đăng nhập trước nhé",
        boss_alive: "Ngọn đèn chưa sáng trọn — chưa thể nhận phần thưởng",
        already_claimed: "Bạn đã nhận phần thưởng này rồi",
        insufficient_contribution: "Đóng góp chưa đủ ngưỡng",
      };
      toast.error(map[e.message] ?? "Không nhận được phần thưởng");
    },
  });

  return {
    isLoading: active.isLoading,
    payload: active.data,
    boss: active.data?.boss,
    me: active.data?.me,
    top: active.data?.top_contributors ?? [],
    loot: loot.data?.loot ?? [],
    myPct: loot.data?.my_pct ?? 0,
    claim: claim.mutate,
    isClaiming: claim.isPending,
    lastClaimed,
    clearLastClaimed: () => setLastClaimed(null),
  };
}
