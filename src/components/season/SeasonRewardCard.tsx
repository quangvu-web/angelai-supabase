import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, CheckCircle2, Loader2, Crown } from "lucide-react";
import type { SeasonReward } from "@/hooks/useSeasonPass";
import { cn } from "@/lib/utils";

interface Props {
  reward: SeasonReward;
  currentLevel: number;
  isPremium: boolean;
  claimed: boolean;
  onClaim: () => void;
  isClaiming?: boolean;
}

export function SeasonRewardCard({ reward, currentLevel, isPremium, claimed, onClaim, isClaiming }: Props) {
  const reached = currentLevel >= reward.level;
  const needsPremium = reward.track === "premium" && !isPremium;
  const canClaim = reached && !claimed && !needsPremium;

  return (
    <Card
      className={cn(
        "p-2.5 flex flex-col items-center gap-2 min-w-[110px] border transition-all",
        reward.track === "premium"
          ? "bg-gradient-to-br from-amber-500/10 to-rose-500/10 border-amber-400/40"
          : "bg-card border-border/60",
        claimed && "opacity-60",
        !reached && "opacity-50"
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase">
        {reward.track === "premium" && <Crown className="h-3 w-3 text-amber-400" />}
        Lv {reward.level}
      </div>
      <div className="text-2xl">{reward.icon ?? "🎁"}</div>
      <div className="text-[11px] font-medium text-center leading-tight min-h-[28px]">{reward.label}</div>
      {claimed ? (
        <Badge variant="secondary" className="text-[9px] gap-0.5 h-5 w-full justify-center">
          <CheckCircle2 className="h-2.5 w-2.5" /> Đã nhận
        </Badge>
      ) : needsPremium ? (
        <Badge variant="outline" className="text-[9px] gap-0.5 h-5 w-full justify-center border-amber-400/40">
          <Lock className="h-2.5 w-2.5" /> Premium
        </Badge>
      ) : (
        <Button
          size="sm"
          disabled={!canClaim || isClaiming}
          onClick={onClaim}
          className={cn(
            "h-7 w-full text-[10px]",
            reward.track === "premium" && canClaim && "bg-gradient-to-r from-amber-400 to-rose-500 !text-black font-bold hover:opacity-90"
          )}
        >
          {isClaiming ? <Loader2 className="h-3 w-3 animate-spin" /> : reached ? "Nhận" : `Cần Lv ${reward.level}`}
        </Button>
      )}
    </Card>
  );
}
