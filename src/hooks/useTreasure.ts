import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TreasureEvent {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: "upcoming" | "active" | "ended";
  jackpot_tier: string;
  bonus_camly: number;
  max_team_size: number;
}

export interface TreasureClue {
  id: string;
  event_id: string;
  seq: number;
  title: string;
  description: string | null;
  clue_type: "in_app" | "telegram" | "social" | "qr";
  payload: Record<string, unknown>;
  points: number;
}

export function useTreasure() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const activeEvent = useQuery({
    queryKey: ["treasure-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("treasure_events")
        .select("*")
        .in("status", ["active", "upcoming"])
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return (data ?? null) as TreasureEvent | null;
    },
  });

  const clues = useQuery({
    queryKey: ["treasure-clues", activeEvent.data?.id],
    enabled: !!activeEvent.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("treasure_clues")
        .select("id, event_id, seq, title, description, clue_type, payload, points")
        .eq("event_id", activeEvent.data!.id)
        .order("seq", { ascending: true });
      return (data ?? []) as TreasureClue[];
    },
  });

  const progress = useQuery({
    queryKey: ["treasure-progress", activeEvent.data?.id, user?.id],
    enabled: !!activeEvent.data?.id && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("treasure_progress")
        .select("clue_id, solved_at")
        .eq("event_id", activeEvent.data!.id)
        .eq("user_id", user!.id);
      return (data ?? []) as { clue_id: string; solved_at: string }[];
    },
  });

  const fragments = useQuery({
    queryKey: ["treasure-fragments", activeEvent.data?.id, user?.id],
    enabled: !!activeEvent.data?.id && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("treasure_fragments")
        .select("fragment_index, acquired_at")
        .eq("event_id", activeEvent.data!.id)
        .eq("user_id", user!.id)
        .order("fragment_index");
      return (data ?? []) as { fragment_index: number; acquired_at: string }[];
    },
  });

  const claimed = useQuery({
    queryKey: ["treasure-claim", activeEvent.data?.id, user?.id],
    enabled: !!activeEvent.data?.id && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("treasure_jackpot_claims")
        .select("ticket_id, claimed_at")
        .eq("event_id", activeEvent.data!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const THEME_HINTS: Record<number, { theme: string; hint: string; emoji: string }> = {
    1: {
      theme: "Ánh sáng",
      emoji: "☀️",
      hint: "Thử nghĩ tới thứ làm tan bóng tối — mặt trời, tia rạng rỡ, sự bừng sáng…",
    },
    2: {
      theme: "Tình thương",
      emoji: "💗",
      hint: "Cảm xúc ấm áp từ trái tim — yêu thương, cảm thông, lòng trắc ẩn…",
    },
    3: {
      theme: "Hy vọng",
      emoji: "🌱",
      hint: "Điều giữ ta đi tiếp khi chưa thấy đường — niềm tin, mong chờ điều tốt đẹp…",
    },
    4: {
      theme: "Bình an",
      emoji: "🕊️",
      hint: "Trạng thái tâm tĩnh lặng — sự an yên, hài hoà, không xao động…",
    },
    5: {
      theme: "Niềm vui",
      emoji: "✨",
      hint: "Cảm xúc bừng nở khi tim nhẹ tênh — hạnh phúc, hân hoan, hỉ lạc…",
    },
  };

  const submitAnswer = useMutation({
    mutationFn: async (vars: { clue_id: string; answer: string; clue_seq?: number }) => {
      const { data, error } = await supabase.rpc("submit_treasure_answer", {
        p_clue_id: vars.clue_id,
        p_answer: vars.answer,
      });
      if (error) throw error;
      return {
        ...(data as {
          correct?: boolean;
          fragment_index?: number;
          already_solved?: boolean;
          points?: number;
          rate_limited?: boolean;
          wait_seconds?: number;
          cooldown_seconds?: number;
        }),
        _seq: vars.clue_seq,
      };
    },
    onSuccess: (data) => {
      if (data.already_solved) {
        toast("Bạn đã giải manh mối này rồi ✨");
      } else if (data.rate_limited) {
        toast.error(`⏳ Đợi ${data.wait_seconds}s rồi thử lại nhé`, {
          description: "Mỗi manh mối chỉ thử 1 lần / 60 giây",
        });
      } else if (data.correct) {
        toast.success(`🗺️ Đúng rồi! Nhận mảnh #${data.fragment_index}`);
        qc.invalidateQueries({ queryKey: ["treasure-progress"] });
        qc.invalidateQueries({ queryKey: ["treasure-fragments"] });
      } else {
        const hint = data._seq ? THEME_HINTS[data._seq] : undefined;
        if (hint) {
          toast(`${hint.emoji} Chưa đúng — gợi ý: ${hint.theme}`, {
            description: `${hint.hint}\nĐợi ${data.cooldown_seconds ?? 60}s rồi thử từ tiếng Anh khác cùng chủ đề.`,
          });
        } else {
          toast("Chưa đúng nhé, thử từ tiếng Anh khác cùng chủ đề", {
            description: `Đợi ${data.cooldown_seconds ?? 60}s để thử lại manh mối này.`,
          });
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const claimJackpot = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_treasure_jackpot", {
        p_event_id: activeEvent.data!.id,
      });
      if (error) throw error;
      return data as { ticket_id: string; tier: string };
    },
    onSuccess: (data) => {
      toast.success(`🎉 Jackpot! Nhận hộp ${data.tier.toUpperCase()}`, {
        description: "Mở trong Kho",
      });
      qc.invalidateQueries({ queryKey: ["treasure-claim"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    event: activeEvent.data,
    clues: clues.data ?? [],
    solvedIds: new Set((progress.data ?? []).map((p) => p.clue_id)),
    fragments: fragments.data ?? [],
    claimed: claimed.data,
    isLoading: activeEvent.isLoading || clues.isLoading,
    submit: submitAnswer.mutate,
    isSubmitting: submitAnswer.isPending,
    claim: claimJackpot.mutate,
    isClaiming: claimJackpot.isPending,
  };
}
