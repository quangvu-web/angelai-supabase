import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useSeasonPass } from "@/hooks/useSeasonPass";
import { SeasonProgressBar } from "@/components/season/SeasonProgressBar";

export function SeasonMiniCard() {
  const s = useSeasonPass();
  if (!s.active || !s.season) return null;
  const xp = s.pass?.xp ?? 0;
  const level = s.pass?.level ?? 1;
  return (
    <Card className="p-3 space-y-2 bg-gradient-to-br from-[#b8860b]/10 via-[#daa520]/5 to-[#ffd700]/10 border-amber-400/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-amber-400" /> Season Pass
          {s.pass?.is_premium && <Crown className="h-3.5 w-3.5 text-amber-400" />}
        </div>
        <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{s.season.name}</span>
      </div>
      <SeasonProgressBar level={level} xp={xp} xpPerLevel={s.season.xp_per_level} maxLevel={s.season.max_level} />
      <Button asChild size="sm" className="w-full h-8 text-xs bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-bold hover:opacity-90">
        <Link to="/season">Mở Pass</Link>
      </Button>
    </Card>
  );
}
