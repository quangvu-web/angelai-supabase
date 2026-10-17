import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Coins, AlertCircle } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useDailyCamlyCap } from "@/hooks/useDailyCamlyCap";

const fmt = (n: number) => n.toLocaleString("vi-VN");

export default function DailyCapBar() {
  const { earned, cap, remaining, percent, hitCapAt, clipped, loading } = useDailyCamlyCap();
  if (loading) return null;

  const hot = percent >= 95;
  const warn = percent >= 80 && !hot;
  const barClass = hot
    ? "bg-gradient-to-r from-rose-500 to-red-500"
    : warn
    ? "bg-gradient-to-r from-amber-500 to-yellow-400"
    : "bg-gradient-to-r from-primary to-primary/60";

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-primary" />
          Trần Camly hôm nay
        </span>
        <span className="text-sm font-bold tabular-nums">
          {fmt(earned)} / {fmt(cap)}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${barClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>
          {hitCapAt ? (
            <span className="flex items-center gap-1 text-rose-400">
              <AlertCircle className="h-3 w-3" />
              Đã đạt trần — 00:00 VN ngày mai reset
            </span>
          ) : (
            <>Còn lại <strong className="text-foreground">{fmt(remaining)}</strong> Camly</>
          )}
        </span>
        <Link to="/docs/daily-camly-cap" className="underline hover:text-foreground">
          Vì sao có trần?
        </Link>
      </div>
      {clipped > 0 && (
        <p className="mt-1 text-[11px] text-amber-400/80">
          Đã cắt mềm {fmt(clipped)} Camly do vượt trần hôm nay.
        </p>
      )}
    </Card>
  );
}
