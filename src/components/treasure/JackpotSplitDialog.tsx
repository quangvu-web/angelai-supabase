import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Trophy, CheckCircle2, Gift } from "lucide-react";
import type { JackpotSplit } from "@/components/treasure/JackpotSplitPanel";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  split: JackpotSplit;
}

export function JackpotSplitDialog({ open, onOpenChange, split }: Props) {
  const claimed = split.members.filter((m) => m.has_claimed).length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" /> {split.team_name}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] uppercase">{split.jackpot_tier}</Badge>
            <span>{claimed}/{split.members.length} thành viên đã claim · {split.total_solved} clue tổng cộng</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {split.members.map((m, idx) => {
            const name = m.display_name || m.handle || "Ẩn danh";
            return (
              <div key={m.user_id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/40">
                <span className="text-xs font-bold w-5 text-center text-muted-foreground tabular-nums">#{idx + 1}</span>
                <Avatar className="h-9 w-9">
                  {m.avatar_url && <AvatarImage src={m.avatar_url} alt={name} />}
                  <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    {m.is_leader && <Crown className="h-3 w-3 text-amber-400" />}
                    <span className="text-sm font-semibold truncate">{name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{m.solved_count}/{split.total_clues} clue</span>
                    {m.has_claimed ? (
                      <span className="flex items-center gap-0.5 text-emerald-400">
                        <CheckCircle2 className="h-2.5 w-2.5" /> đã nhận hộp
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        <Gift className="h-2.5 w-2.5" /> chưa claim
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold tabular-nums bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent">
                    {m.share_pct}%
                  </div>
                  <div className="text-[9px] text-muted-foreground">đóng góp</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 leading-snug">
          ✨ Mỗi người nhận <strong className="text-foreground">1 hộp {split.jackpot_tier.toUpperCase()}</strong> giống nhau khi claim.
          Tỉ lệ % chỉ vinh danh đóng góp clue trong team — không cắt bớt phần thưởng của ai cả.
        </div>
      </DialogContent>
    </Dialog>
  );
}
