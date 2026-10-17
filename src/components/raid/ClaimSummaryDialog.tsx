import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Coins, Star, Gift, Package } from "lucide-react";
import type { LootEntry } from "@/hooks/useBossRaid";

interface Props {
  entry: LootEntry | null;
  onClose: () => void;
}

const TIER_LABEL: Record<string, string> = {
  common: "Common Box",
  rare: "Rare Box",
  epic: "Epic Box",
  cosmic: "Cosmic Box",
};

function summarize(entry: LootEntry) {
  const v = entry.reward_value as Record<string, unknown>;
  const amount = Number(v.amount ?? 0);
  const count = Math.max(1, Number(v.count ?? 1));
  const tier = String(v.tier ?? "");

  switch (entry.reward_type) {
    case "camly":
      return { icon: Coins, color: "text-amber-500", title: "Camly", value: `+${amount.toLocaleString()} Camly` };
    case "season_xp":
      return { icon: Star, color: "text-violet-500", title: "Season XP", value: `+${amount.toLocaleString()} XP` };
    case "box_ticket":
      return {
        icon: Gift,
        color: "text-rose-500",
        title: "Vé mở hộp",
        value: `${count}× ${TIER_LABEL[tier] ?? tier}`,
      };
    default:
      return { icon: Sparkles, color: "text-amber-500", title: entry.label, value: entry.label };
  }
}

export function ClaimSummaryDialog({ entry, onClose }: Props) {
  const navigate = useNavigate();
  if (!entry) return null;
  const s = summarize(entry);
  const Icon = s.icon;
  const isBox = entry.reward_type === "box_ticket";

  const goInventory = () => {
    onClose();
    navigate("/inventory#tickets");
  };

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Đã nhận phần thưởng ánh sáng
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-amber-500/10 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] flex items-center justify-center shrink-0">
              <Icon className="h-7 w-7 !text-black" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.title}</p>
              <p className="text-lg font-extrabold leading-tight truncate">{s.value}</p>
            </div>
          </div>

          <div className="rounded-md bg-background/60 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{entry.label}</span>
            <span className="ml-1">— ngưỡng {entry.min_pct.toFixed(2)}%</span>
          </div>

          {entry.reward_type === "box_ticket" && (
            <p className="text-[11px] text-muted-foreground italic">
              Vé đã được cộng vào kho — mở hộp tại trang Inventory để nhận phần thưởng bên trong.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button onClick={goInventory} className="w-full min-h-11 bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold hover:opacity-90">
            <Package className="h-4 w-4 mr-1.5" />
            {isBox ? "Mở vé trong Inventory" : "Xem trong Inventory"}
          </Button>
          <Button onClick={onClose} variant="ghost" className="w-full min-h-11">
            Tiếp tục thắp sáng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
