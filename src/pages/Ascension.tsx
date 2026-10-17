import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Sparkles, Crown, Coins, Gem, Star, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { smartBack } from "@/lib/smartBack";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAscension } from "@/hooks/useAscension";


type NftLite = {
  id: string;
  collection_code: string;
  traits: { tier?: string } & Record<string, unknown>;
};

const TIER_LABEL: Record<string, string> = {
  epic: "Epic",
  legendary: "Legendary",
};

export default function Ascension() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { state, isLoading, ascend, isAscending } = useAscension();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nftsQ = useQuery({
    queryKey: ["ascension-nfts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nft_items")
        .select("id, collection_code, traits")
        .eq("owner_user_id", user!.id)
        .neq("collection_code", "light_ascendant")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as NftLite[];
    },
  });

  const statsQ = useQuery({
    queryKey: ["ascension-bonus-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ascension_bonus_stats", { p_user_id: user!.id });
      if (error) throw error;
      return data as unknown as {
        ok: boolean;
        total_bonus: number;
        total_base: number;
        total_received: number;
        tx_count: number;
        per_tier: { tier: string; bonus: number; received: number; tx_count: number }[];
        today: {
          cap: number;
          earned: number;
          clipped: number;
          remaining: number;
          hit_cap_at: string | null;
          capped_tx_count: number;
          clipped_bonus_estimate: number;
        };
      };

    },
  });


  const eligibleNfts = useMemo(
    () =>
      (nftsQ.data ?? []).filter((n) => {
        const t = String(n.traits?.tier ?? "");
        return t === "epic" || t === "legendary";
      }),
    [nftsQ.data]
  );

  if (isLoading || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const handleAscend = async () => {
    if (!selectedId) {
      toast.error("Hãy chọn 1 NFT epic hoặc legendary để hiến");
      return;
    }
    try {
      const res = await ascend(selectedId);
      if (!res.ok) {
        toast.error(`Không Thăng Sáng được: ${res.reason ?? "lỗi"}`);
        return;
      }
      toast.success(`✨ Thăng Sáng thành công! Đạt Tier ${res.new_tier} · Bonus +${res.bonus_pct}% Camly vĩnh viễn`);
      setSelectedId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const atMax = state.tier >= 5;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-5 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11 -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <Badge className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black border-0 font-extrabold">
            <Crown className="h-3.5 w-3.5 mr-1" /> Light Ascension
          </Badge>
        </div>

        {/* Hero */}
        <Card className="p-6 text-center space-y-3 bg-gradient-to-br from-[#b8860b]/10 via-[#daa520]/10 to-[#ffd700]/10 border-amber-400/40">
          <div className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700]">
            <Crown className="h-9 w-9 !text-black" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Thăng Sáng</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Khi Mastery đạt Lv 50, bạn có thể Thăng Sáng — reset Mastery về 1
            (giữ toàn bộ perk đã unlock), nhận danh hiệu NFT vĩnh viễn và
            +1% Camly bonus mỗi tier.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {[1, 2, 3, 4, 5].map((t) => (
              <Star
                key={t}
                className={`h-6 w-6 ${
                  t <= state.tier ? "fill-amber-400 text-amber-500" : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <p className="text-xs font-bold">
            Tier hiện tại: <span className="text-amber-600">{state.tier}/5</span>
            {state.tier > 0 && <> · Bonus Camly <span className="text-emerald-600">+{state.bonus_pct}%</span></>}
          </p>
        </Card>

        {/* Eligibility */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm font-bold">Điều kiện Thăng Sáng</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-3 rounded-lg border ${state.level >= 50 ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20" : "bg-muted/40"}`}>
              <div className="text-muted-foreground">Mastery Level</div>
              <div className="font-bold">{state.level} / 50 {state.level >= 50 ? "✓" : ""}</div>
            </div>
            <div className={`p-3 rounded-lg border ${eligibleNfts.length > 0 ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20" : "bg-muted/40"}`}>
              <div className="text-muted-foreground">NFT epic+ sở hữu</div>
              <div className="font-bold">{state.epic_count}E · {state.legendary_count}L {eligibleNfts.length > 0 ? "✓" : ""}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1 pt-1">
            <p>• Hiến 1 NFT <b>Epic</b> + <b>50.000 Camly</b>, hoặc</p>
            <p>• Hiến 1 NFT <b>Legendary</b> + <b>10.000 Camly</b>.</p>
            <p>• NFT đầu vào sẽ bị xoá vĩnh viễn.</p>
          </div>
        </Card>

        {/* NFT picker */}
        {!atMax && state.eligible && (
          <Card className="p-4 space-y-3 border-2 border-amber-300">
            <div>
              <div className="text-sm font-bold">Chọn 1 NFT để hiến</div>
              <div className="text-xs text-muted-foreground">
                {eligibleNfts.length} NFT đủ điều kiện
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {eligibleNfts.map((n) => {
                const t = String(n.traits?.tier ?? "");
                const isSel = selectedId === n.id;
                const tierColor = t === "legendary" ? "text-amber-500" : "text-violet-500";
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelectedId(isSel ? null : n.id)}
                    className={`relative p-2 rounded-xl border text-xs aspect-square flex flex-col items-center justify-center transition ${
                      isSel
                        ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300"
                        : "bg-card border-border hover:border-amber-300"
                    }`}
                  >
                    <Gem className={`h-5 w-5 mb-1 ${tierColor}`} />
                    <span className="text-[10px] font-bold uppercase">{TIER_LABEL[t]}</span>
                    <span className="font-mono text-[9px] truncate w-full text-muted-foreground">
                      {n.id.slice(0, 6)}
                    </span>
                    {isSel && (
                      <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedId && (
              <p className="text-xs flex items-center gap-1 text-muted-foreground">
                <Coins className="h-3.5 w-3.5" />
                Sẽ hiến{" "}
                <b className="text-foreground">
                  {(eligibleNfts.find((n) => n.id === selectedId)?.traits?.tier === "legendary"
                    ? 10000
                    : 50000
                  ).toLocaleString()}{" "}
                  Camly
                </b>
              </p>
            )}
            <Button
              className="w-full bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold hover:opacity-90"
              disabled={!selectedId || isAscending}
              onClick={handleAscend}
            >
              {isAscending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Thăng Sáng lên Tier {(state.next_tier ?? state.tier + 1)}
            </Button>
          </Card>
        )}

        {atMax && (
          <Card className="p-5 text-center bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/10 border-amber-400/40">
            <Crown className="h-10 w-10 mx-auto !text-amber-500 mb-2" />
            <p className="font-extrabold">Bạn đã đạt Tier 5 — cao nhất!</p>
            <p className="text-xs text-muted-foreground mt-1">
              +5% Camly vĩnh viễn. Bạn là một Light Ascendant huyền thoại.
            </p>
          </Card>
        )}

        {!atMax && !state.eligible && (
          <Card className="p-4 text-center text-xs text-muted-foreground">
            {state.level < 50
              ? "Đạt Mastery Lv 50 để mở khoá Thăng Sáng."
              : "Cần ít nhất 1 NFT epic hoặc legendary để Thăng Sáng."}
          </Card>
        )}

        {/* Daily cap status — cảnh báo khi bonus bị cắt */}
        {statsQ.data?.ok && state.tier > 0 && (() => {
          const t = statsQ.data.today;
          const pct = t.cap > 0 ? Math.min(100, Math.round((t.earned / t.cap) * 100)) : 0;
          const hit = t.remaining <= 0 || !!t.hit_cap_at;
          const hasClipped = t.clipped > 0;
          const tone = hit
            ? "from-rose-50 to-amber-50 dark:from-rose-950/20 dark:to-amber-950/10 border-rose-300/50"
            : hasClipped
              ? "from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/10 border-amber-300/50"
              : "from-sky-50/60 to-emerald-50/40 dark:from-sky-950/10 dark:to-emerald-950/10 border-sky-300/40";
          return (
            <Card className={`p-4 space-y-3 bg-gradient-to-br ${tone}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-1.5">
                  {hit || hasClipped ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Info className="h-4 w-4 text-sky-600" />
                  )}
                  Trần Camly hôm nay
                </h2>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[10px] cursor-help">
                        {t.earned.toLocaleString()} / {t.cap.toLocaleString()}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      Mỗi tài khoản chỉ nhận tối đa <b>{t.cap.toLocaleString()} Camly/ngày</b> (reset 00:00 VN).
                      Phần vượt trần sẽ bị cắt, kể cả ascension bonus.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Progress value={pct} className="h-2" />

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-background/60 border">
                  <div className="text-[10px] text-muted-foreground">Đã nhận</div>
                  <div className="font-extrabold">{t.earned.toLocaleString()}</div>
                </div>
                <div className="p-2 rounded-lg bg-background/60 border">
                  <div className="text-[10px] text-muted-foreground">Còn lại</div>
                  <div className={`font-extrabold ${hit ? "text-rose-600" : "text-emerald-600"}`}>
                    {t.remaining.toLocaleString()}
                  </div>
                </div>
                <div className={`p-2 rounded-lg border ${hasClipped ? "bg-amber-100/60 dark:bg-amber-950/30 border-amber-300/50" : "bg-background/60"}`}>
                  <div className="text-[10px] text-muted-foreground">Bị cắt</div>
                  <div className={`font-extrabold ${hasClipped ? "text-amber-700 dark:text-amber-400" : ""}`}>
                    {t.clipped.toLocaleString()}
                  </div>
                </div>
              </div>

              {hit && (
                <div className="flex gap-2 p-2.5 rounded-lg bg-rose-100/60 dark:bg-rose-950/20 border border-rose-300/50 text-xs">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-700 dark:text-rose-400">Đã chạm trần hôm nay</p>
                    <p className="text-muted-foreground">
                      {t.hit_cap_at && (
                        <>Chạm trần lúc {new Date(t.hit_cap_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}. </>
                      )}
                      Mọi reward (bao gồm <b>+{state.bonus_pct}% ascension bonus</b>) sẽ bị cắt cho đến 00:00 VN. Quà tặng nhận từ người khác không bị tính cap.
                    </p>
                  </div>
                </div>
              )}

              {!hit && hasClipped && (
                <div className="flex gap-2 p-2.5 rounded-lg bg-amber-100/50 dark:bg-amber-950/20 border border-amber-300/50 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-amber-700 dark:text-amber-400">
                      Có {t.capped_tx_count} reward bị cắt một phần
                    </p>
                    <p className="text-muted-foreground">
                      Tổng {t.clipped.toLocaleString()} Camly bị clip do gần trần.
                      {t.clipped_bonus_estimate > 0 && (
                        <> Trong đó ~<b>{Math.round(t.clipped_bonus_estimate).toLocaleString()} Camly</b> thuộc phần ascension bonus.</>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          );
        })()}

        {/* Bonus stats */}

        {statsQ.data?.ok && statsQ.data.tx_count > 0 && (
          <Card className="p-4 space-y-3 bg-gradient-to-br from-emerald-50/60 to-amber-50/40 dark:from-emerald-950/10 dark:to-amber-950/10 border-emerald-300/40">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-emerald-600" /> Thống kê bonus đã nhận
              </h2>
              <Badge variant="outline" className="text-[10px]">{statsQ.data.tx_count} giao dịch</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-background/60 border">
                <div className="text-[10px] text-muted-foreground">Tổng nhận</div>
                <div className="font-extrabold text-sm">{Number(statsQ.data.total_received).toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-background/60 border">
                <div className="text-[10px] text-muted-foreground">Phần gốc</div>
                <div className="font-extrabold text-sm">{Number(statsQ.data.total_base).toLocaleString()}</div>
              </div>
              <div className="p-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/30 border border-emerald-300/40">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400">Bonus cộng thêm</div>
                <div className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400">+{Number(statsQ.data.total_bonus).toLocaleString()}</div>
              </div>
            </div>
            {statsQ.data.per_tier.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Theo từng tier</div>
                {statsQ.data.per_tier.map((p) => (
                  <div key={p.tier} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-background/40 border border-border/60">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      <span className="font-bold">Tier {p.tier}</span>
                      <span className="text-muted-foreground">({p.tx_count} gd)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{Number(p.received).toLocaleString()} nhận</span>
                      <span className="font-bold text-emerald-600">+{Number(p.bonus).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* History */}
        {state.history.length > 0 && (
          <Card className="p-4 space-y-2">
            <h2 className="text-sm font-bold">Lịch sử Thăng Sáng</h2>
            <div className="space-y-1.5">
              {state.history.map((h) => (
                <div key={h.tier} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                    <span className="font-bold">Tier {h.tier}</span>
                    <span className="text-muted-foreground">
                      {new Date(h.ascended_at).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    -{h.camly_burned.toLocaleString()} Camly · {h.nft_burned_tier}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
