import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Lock, CheckCircle2, Loader2 } from "lucide-react";
import type { LootEntry } from "@/hooks/useBossRaid";

interface Props {
  loot: LootEntry[];
  myPct: number;
  bossStatus: string;
  onClaim: (lootId: string) => void;
  isClaiming: boolean;
}

const tierColor: Record<string, string> = {
  common: "border-slate-400/40 bg-slate-50 dark:bg-slate-900/30",
  rare: "border-sky-400/50 bg-sky-50 dark:bg-sky-950/30",
  epic: "border-fuchsia-400/50 bg-fuchsia-50 dark:bg-fuchsia-950/30",
  cosmic: "border-amber-400/60 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30",
};

export function RaidLootGrid({ loot, myPct, bossStatus, onClaim, isClaiming }: Props) {
  if (loot.length === 0) {
    return <p className="text-xs text-center text-muted-foreground">Chưa có loot table.</p>;
  }
  const canClaimWindow = bossStatus === "defeated" || bossStatus === "expired";

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {loot.map((l) => {
        const need = Math.max(0, l.min_pct - myPct);
        const cls = tierColor[l.tier] ?? tierColor.common;
        return (
          <Card key={l.id} className={`p-3 space-y-2 border ${cls}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <Gift className="h-4 w-4" /> {l.label}
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">
                {l.tier}
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Cần ≥ <span className="font-bold text-foreground">{l.min_pct}%</span> đóng góp
              {!l.eligible && need > 0 && bossStatus !== "active" && (
                <> · còn thiếu <span className="text-rose-500 font-semibold">{need.toFixed(3)}%</span></>
              )}
            </div>
            {l.claimed ? (
              <Button size="sm" variant="outline" disabled className="w-full h-8 text-xs gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Đã nhận
              </Button>
            ) : !canClaimWindow ? (
              <Button size="sm" variant="outline" disabled className="w-full h-8 text-xs gap-1">
                <Lock className="h-3.5 w-3.5" /> Chờ ngọn đèn sáng trọn
              </Button>
            ) : !l.eligible ? (
              <Button size="sm" variant="outline" disabled className="w-full h-8 text-xs gap-1">
                <Lock className="h-3.5 w-3.5" /> Chưa đủ ngưỡng
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onClaim(l.id)}
                disabled={isClaiming}
                className="w-full h-8 text-xs bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-bold hover:opacity-90"
              >
                {isClaiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Nhận phần thưởng"}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
