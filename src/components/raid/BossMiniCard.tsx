import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useBossRaid } from "@/hooks/useBossRaid";
import { BossHpBar } from "@/components/raid/BossHpBar";

export function BossMiniCard() {
  const { boss, me, isLoading } = useBossRaid();
  if (isLoading || !boss) return null;

  return (
    <Card className="p-3 space-y-2 border-amber-400/40 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-amber-500/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Lightbulb className="h-4 w-4 text-amber-500" /> {boss.name}
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            boss.status === "active"
              ? "bg-amber-500/15 text-amber-700"
              : boss.status === "defeated"
              ? "bg-emerald-500/15 text-emerald-600"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {boss.status === "active" ? "Đang thắp sáng" : boss.status === "defeated" ? "Đã trọn sáng" : "Hết hạn"}
        </span>
      </div>
      <BossHpBar current={boss.current_hp} total={boss.total_hp} status={boss.status} />
      {me?.authenticated && me.damage > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Bạn đã góp <span className="font-bold text-amber-600">{me.damage.toLocaleString()}</span> ánh sáng
          ({me.pct.toFixed(3)}%)
        </p>
      )}
      <Button
        asChild
        size="sm"
        className="w-full h-8 text-xs gap-1 bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold hover:opacity-90"
      >
        <Link to="/raid">
          <Sparkles className="h-3.5 w-3.5" /> Góp ánh sáng
        </Link>
      </Button>
    </Card>
  );
}
