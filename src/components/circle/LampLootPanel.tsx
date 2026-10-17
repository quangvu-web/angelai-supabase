import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles, Coins, Ticket, Check, Award } from "lucide-react";
import { toast } from "sonner";
import Confetti from "@/components/quest/Confetti";

interface Grant {
  id: string;
  user_id: string;
  contribution: number;
  share_pct: number;
  box_tickets_granted: number;
  xp_granted: number;
  camly_granted: number;
  claimed_at: string | null;
}
interface Loot {
  total_contributors: number;
  total_light: number;
  base_box_tier: string;
  base_box_count: number;
}
interface LootPayload {
  has_loot: boolean;
  loot?: Loot;
  my_grant?: Grant | null;
  total_claimed?: number;
}

const errMap: Record<string, string> = {
  unauthorized: "Hãy đăng nhập trước",
  no_grant: "Bạn không có phần trong ngọn đèn này",
  already_claimed: "Bạn đã nhận thưởng rồi",
};

export function LampLootPanel({ lampId }: { lampId: string }) {
  const [showConfetti, setShowConfetti] = useState(false);
  const qc = useQueryClient();

  const lootQ = useQuery({
    queryKey: ["lamp-loot", lampId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lamp_loot", { p_lamp_id: lampId });
      if (error) throw error;
      return data as unknown as LootPayload;
    },
  });

  // Realtime: khi grants update (ai đó nhận) → refresh
  useEffect(() => {
    const ch = supabase
      .channel(`lamp-loot:${lampId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "light_circle_lamp_loot_grants", filter: `lamp_id=eq.${lampId}` },
        () => qc.invalidateQueries({ queryKey: ["lamp-loot", lampId] }))
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "light_circle_lamp_loot", filter: `lamp_id=eq.${lampId}` },
        () => qc.invalidateQueries({ queryKey: ["lamp-loot", lampId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [lampId, qc]);

  const claim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_lamp_loot", { p_lamp_id: lampId });
      if (error) throw error;
      return data as { ok: boolean; granted: { boxes: number; xp: number; camly: number; tier: string } };
    },
    onSuccess: (res) => {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      toast.success(
        `Đã nhận: ${res.granted.boxes} vé hộp · ${res.granted.xp.toLocaleString()} XP · ${res.granted.camly.toLocaleString()} Camly`,
        { duration: 6000 }
      );
      qc.invalidateQueries({ queryKey: ["lamp-loot", lampId] });
      qc.invalidateQueries({ queryKey: ["box-tickets"] });
      qc.invalidateQueries({ queryKey: ["camly-balance"] });
    },
    onError: (e: Error) => toast.error(errMap[e.message] ?? "Có lỗi, thử lại nhé"),
  });

  if (lootQ.isLoading) return null;
  const data = lootQ.data;
  if (!data?.has_loot) {
    return (
      <Card className="p-3 border-dashed border-amber-400/30 bg-amber-500/5">
        <p className="text-xs italic text-muted-foreground text-center">
          Đèn vừa hoàn thành — phần thưởng sẽ xuất hiện sau vài giây…
        </p>
      </Card>
    );
  }

  const grant = data.my_grant ?? null;
  const loot = data.loot!;

  return (
    <>
      <Confetti show={showConfetti} />
      <Card className="p-4 space-y-3 border-amber-400/50 bg-gradient-to-br from-[#b8860b]/10 via-[#daa520]/10 to-[#ffd700]/15">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-amber-600" />
        <p className="font-extrabold text-sm flex-1">Phần thưởng ngọn đèn</p>
        <Badge variant="outline" className="text-[10px]">
          {data.total_claimed ?? 0}/{loot.total_contributors} đã nhận
        </Badge>
      </div>

      {!grant ? (
        <p className="text-xs italic text-muted-foreground text-center py-2">
          Bạn chưa góp ánh sáng cho ngọn đèn này — không có phần thưởng.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-background/60 p-2 text-center">
              <Ticket className="h-4 w-4 mx-auto text-amber-600 mb-0.5" />
              <p className="text-base font-extrabold tabular-nums">{grant.box_tickets_granted}</p>
              <p className="text-[9px] text-muted-foreground">vé hộp {loot.base_box_tier}</p>
            </div>
            <div className="rounded-lg bg-background/60 p-2 text-center">
              <Sparkles className="h-4 w-4 mx-auto text-amber-600 mb-0.5" />
              <p className="text-base font-extrabold tabular-nums">{grant.xp_granted.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground">Season XP</p>
            </div>
            <div className="rounded-lg bg-background/60 p-2 text-center">
              <Coins className="h-4 w-4 mx-auto text-amber-600 mb-0.5" />
              <p className="text-base font-extrabold tabular-nums">{grant.camly_granted.toLocaleString()}</p>
              <p className="text-[9px] text-muted-foreground">Camly</p>
            </div>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Bạn góp <span className="font-bold text-amber-600">{grant.contribution.toLocaleString()}</span> ánh sáng
            ({grant.share_pct}% tổng đèn)
          </p>

          {Number(grant.share_pct) >= 25 && (
            <div className="rounded-lg border border-amber-400/50 bg-gradient-to-r from-[#b8860b]/15 via-[#daa520]/15 to-[#ffd700]/20 p-2 flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold !text-black dark:text-amber-200 leading-tight">
                  🏆 NFT "Lamp Keeper" — Soulbound
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Vì bạn góp ≥25%, NFT đã tự động bay vào kho. Xem ở /inventory.
                </p>
              </div>
            </div>
          )}

          {grant.claimed_at ? (
            <Badge className="w-full justify-center bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 gap-1">
              <Check className="h-3.5 w-3.5" /> Đã nhận lúc {new Date(grant.claimed_at).toLocaleString("vi-VN")}
            </Badge>
          ) : (
            <Button
              onClick={() => claim.mutate()}
              disabled={claim.isPending}
              className="w-full bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold"
            >
              <Gift className="h-4 w-4 mr-1" /> Nhận thưởng
            </Button>
          )}
        </>
      )}

      <p className="text-[9px] text-center italic text-muted-foreground">
        Mỗi người đều có phần — chia theo tỉ lệ đóng góp, không xếp hạng.
      </p>
      </Card>
    </>
  );
}
