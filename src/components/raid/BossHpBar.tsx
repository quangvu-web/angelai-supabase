import { motion } from "framer-motion";
import { Sun } from "lucide-react";

interface Props {
  current: number;
  total: number;
  status: "active" | "defeated" | "expired" | "upcoming";
}

export function BossHpBar({ current, total, status }: Props) {
  // current_hp giảm dần = phần ngọn đèn CHƯA được thắp.
  // Độ sáng đã đạt = total - current.
  const litPct = total > 0 ? Math.max(0, Math.min(100, ((total - current) / total) * 100)) : 0;
  const barColor =
    litPct > 70
      ? "from-yellow-300 via-amber-300 to-yellow-400"
      : litPct > 30
      ? "from-amber-400 via-yellow-400 to-amber-500"
      : "from-amber-600 via-orange-500 to-amber-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Sun className="h-3 w-3 text-amber-500" /> Độ sáng
        </span>
        <span className="tabular-nums">
          {(total - current).toLocaleString()} / {total.toLocaleString()}
          <span className="ml-2 text-muted-foreground">({litPct.toFixed(2)}%)</span>
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/40">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barColor}`}
          initial={false}
          animate={{ width: `${litPct}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
        />
        {status === "active" && (
          <motion.div
            className="absolute inset-y-0 left-0 w-12 bg-white/30 blur-sm"
            animate={{ x: ["-3rem", "100%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      {status === "defeated" && (
        <p className="text-[10px] text-emerald-500 font-bold">✨ Ngọn đèn đã sáng trọn vẹn — kiểm tra phần thưởng!</p>
      )}
      {status === "expired" && (
        <p className="text-[10px] text-muted-foreground">Hết thời gian — chỉ nhận phần thưởng common/rare</p>
      )}
    </div>
  );
}
