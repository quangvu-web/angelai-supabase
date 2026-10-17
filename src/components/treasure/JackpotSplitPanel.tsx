import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Crown, Loader2, Trophy, Sparkles, CheckCircle2, Gift } from "lucide-react";
import { JackpotSplitDialog } from "@/components/treasure/JackpotSplitDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface JackpotMember {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  is_leader: boolean;
  joined_at: string;
  solved_count: number;
  share_pct: number;
  has_claimed: boolean;
  ticket_id: string | null;
}

export interface JackpotSplit {
  team_id: string;
  team_name: string;
  event_id: string;
  total_clues: number;
  total_solved: number;
  jackpot_tier: string;
  members: JackpotMember[];
}

const TIER_COLOR: Record<string, string> = {
  common: "from-slate-500/20 to-slate-700/20 text-slate-200",
  rare: "from-blue-500/20 to-indigo-700/20 text-blue-200",
  epic: "from-purple-500/20 to-fuchsia-700/20 text-purple-200",
  cosmic: "from-amber-400/30 to-rose-600/30 text-amber-200",
};

export function JackpotSplitPanel({ teamId }: { teamId: string }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["jackpot-split", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_jackpot_split", { p_team_id: teamId });
      if (error) throw error;
      return data as unknown as JackpotSplit;
    },
    refetchInterval: 30000,
  });

  const eventId = q.data?.event_id;
  useEffect(() => {
    if (!eventId) return;
    const ch = supabase
      .channel(`jackpot-claims:${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "treasure_jackpot_claims", filter: `event_id=eq.${eventId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["jackpot-split", teamId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [eventId, teamId, qc]);

  const claim = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase.rpc("claim_treasure_jackpot", { p_event_id: eventId });
      if (error) throw error;
      return data as { ticket_id: string; tier: string };
    },
    onMutate: async () => {
      // Optimistic: mark current user as claimed immediately
      await qc.cancelQueries({ queryKey: ["jackpot-split", teamId] });
      const prev = qc.getQueryData<JackpotSplit>(["jackpot-split", teamId]);
      if (prev && user) {
        qc.setQueryData<JackpotSplit>(["jackpot-split", teamId], {
          ...prev,
          members: prev.members.map((m) =>
            m.user_id === user.id ? { ...m, has_claimed: true } : m
          ),
        });
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jackpot-split", teamId], ctx.prev);
      toast.error(e.message || "Không thể claim jackpot");
    },
    onSuccess: (data) => {
      toast.success(`🎉 Jackpot! Nhận hộp ${data.tier.toUpperCase()}`, { description: "Mở trong Kho" });
      qc.invalidateQueries({ queryKey: ["jackpot-split", teamId] });
      qc.invalidateQueries({ queryKey: ["box-inventory"] });
      qc.invalidateQueries({ queryKey: ["treasure-claim"] });
    },
  });

  if (q.isLoading) {
    return <Card className="p-3 text-center"><Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /></Card>;
  }
  if (!q.data) return null;
  const s = q.data;
  const tierClass = TIER_COLOR[s.jackpot_tier] ?? TIER_COLOR.cosmic;
  const me = user ? s.members.find((m) => m.user_id === user.id) : null;
  const canClaim = !!me && !me.has_claimed;

  return (
    <>
      <Card className={`p-3 space-y-3 bg-gradient-to-br ${tierClass} border-amber-400/30`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-amber-400" /> Chia Jackpot
            <Badge variant="outline" className="text-[10px] uppercase">{s.jackpot_tier}</Badge>
          </div>
          <span className="text-[10px] opacity-80">{s.total_solved}/{s.total_clues * s.members.length} clue</span>
        </div>

        <div className="space-y-2">
          {s.members.map((m) => (
            <MemberRow key={m.user_id} m={m} totalClues={s.total_clues} isMe={user?.id === m.user_id} />
          ))}
        </div>

        {me?.has_claimed ? (
          <Button size="sm" disabled className="w-full h-9 text-xs bg-emerald-600/30 text-emerald-200 border border-emerald-400/40">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Bạn đã nhận hộp {s.jackpot_tier.toUpperCase()}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={!canClaim || claim.isPending}
            onClick={() => claim.mutate(s.event_id)}
            className="w-full h-9 text-xs bg-gradient-to-r from-amber-400 to-rose-500 !text-black font-bold hover:opacity-90"
          >
            {claim.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Đang nhận...</>
            ) : (
              <><Gift className="h-3.5 w-3.5 mr-1" /> Claim hộp {s.jackpot_tier.toUpperCase()}</>
            )}
          </Button>
        )}

        <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setOpen(true)}>
          <Sparkles className="h-3 w-3 mr-1" /> Xem chi tiết chia thưởng
        </Button>
        <p className="text-[10px] opacity-70 leading-snug">
          Mỗi thành viên claim hộp <strong>{s.jackpot_tier}</strong> riêng. Tỉ lệ % chỉ thể hiện đóng góp clue, không trừ phần thưởng.
        </p>
      </Card>

      <JackpotSplitDialog open={open} onOpenChange={setOpen} split={s} />
    </>
  );
}

function MemberRow({ m, totalClues, isMe }: { m: JackpotMember; totalClues: number; isMe?: boolean }) {
  const name = m.display_name || m.handle || "Ẩn danh";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <Avatar className="h-6 w-6">
          {m.avatar_url && <AvatarImage src={m.avatar_url} alt={name} />}
          <AvatarFallback className="text-[9px]">{initial}</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {m.is_leader && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
          <span className="font-semibold truncate">{name}{isMe && <span className="ml-1 text-[9px] opacity-70">(bạn)</span>}</span>
          {m.has_claimed && (
            <Badge variant="secondary" className="text-[9px] h-4 gap-0.5">
              <CheckCircle2 className="h-2.5 w-2.5" /> claim
            </Badge>
          )}
        </div>
        <span className="text-[10px] opacity-80 shrink-0">{m.solved_count}/{totalClues}</span>
        <span className="text-xs font-bold tabular-nums shrink-0 w-12 text-right">{m.share_pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-background/40 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-700 ease-out"
          style={{ width: `${Math.min(100, m.share_pct)}%` }}
        />
      </div>
    </div>
  );
}
