import { Progress } from "@/components/ui/progress";

interface Props {
  level: number;
  xp: number;
  xpPerLevel: number;
  maxLevel: number;
}

export function SeasonProgressBar({ level, xp, xpPerLevel, maxLevel }: Props) {
  const isMax = level >= maxLevel;
  const xpInLevel = xp % xpPerLevel;
  const remain = Math.max(0, xpPerLevel - xpInLevel);
  const pct = isMax ? 100 : Math.round((xpInLevel / xpPerLevel) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold">Level {level} / {maxLevel}</span>
        <span className="text-muted-foreground tabular-nums">
          {isMax ? "MAX" : `${xpInLevel} / ${xpPerLevel} XP`}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#b8860b] via-[#daa520] via-[#ffd700] to-[#ffec8b] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Tổng XP mùa: <span className="font-mono text-foreground">{xp}</span></span>
        {!isMax && <span className="font-semibold text-amber-500 tabular-nums">còn {remain} XP → Lv {level + 1}</span>}
      </div>
    </div>
  );
}
