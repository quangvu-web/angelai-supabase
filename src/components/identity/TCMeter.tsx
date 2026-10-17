import { cn } from "@/lib/utils";

interface Props {
  tc: number;
  className?: string;
}

/**
 * Visual gauge for Trust Confidence (0.300 – 1.500).
 * Uses Gold 11 gradient for high values, neutral for low.
 */
export function TCMeter({ tc, className }: Props) {
  const pct = Math.max(0, Math.min(100, ((tc - 0.3) / 1.2) * 100));
  const tier =
    tc >= 1.25 ? "T4" : tc >= 1.0 ? "T3" : tc >= 0.8 ? "T2" : tc >= 0.6 ? "T1" : "T0";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Trust Confidence</span>
        <span className="text-2xl font-bold tabular-nums">
          {tc.toFixed(3)}
          <span className="ml-2 text-sm font-medium text-muted-foreground">/ 1.500</span>
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-300 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
        {/* tier markers */}
        <div className="absolute inset-y-0 left-[25%] w-px bg-border/60" />
        <div className="absolute inset-y-0 left-[42%] w-px bg-border/60" />
        <div className="absolute inset-y-0 left-[58%] w-px bg-border/60" />
        <div className="absolute inset-y-0 left-[79%] w-px bg-border/60" />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>T0</span>
        <span>T1</span>
        <span>T2</span>
        <span>T3</span>
        <span>T4</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Hạng hiện tại: <span className="font-semibold text-foreground">{tier}</span>
      </div>
    </div>
  );
}
