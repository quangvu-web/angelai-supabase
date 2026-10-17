import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  priceCamly: number;
  seasonName: string;
  onConfirm: () => void;
  isPending: boolean;
}

export function SeasonPremiumDialog({ open, onOpenChange, priceCamly, seasonName, onConfirm, isPending }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" /> Mở Premium Pass
          </DialogTitle>
          <DialogDescription>
            Mở khoá toàn bộ phần thưởng Premium của mùa <strong>{seasonName}</strong>: hộp Rare → Cosmic, Pet XP, Camly thưởng lớn ở mỗi level.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-amber-400/40 bg-gradient-to-br from-amber-400/10 to-rose-500/10 p-4 text-center">
          <div className="text-xs text-muted-foreground">Giá một lần</div>
          <div className="text-3xl font-extrabold tabular-nums bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent">
            {priceCamly.toLocaleString()} Camly
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Giữ trọn mùa, không hết hạn theo level.</div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Để sau</Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            className="bg-gradient-to-r from-amber-400 to-rose-500 !text-black font-bold hover:opacity-90"
          >
            {isPending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang mở...</> : "Xác nhận mở"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
