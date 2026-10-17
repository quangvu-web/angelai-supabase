import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSlashValidator } from "@/hooks/useValidatorRewards";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function SlashValidatorDialog({ stakeId, validatorName }: { stakeId: string; validatorName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pct, setPct] = useState("50");
  const slash = useSlashValidator();

  const handleSubmit = () => {
    const slashPct = Number(pct) / 100;
    if (slashPct <= 0 || slashPct > 1) return toast.error("Slash 1-100%");
    if (reason.trim().length < 10) return toast.error("Lý do ≥ 10 ký tự");

    slash.mutate(
      { stake_id: stakeId, reason: reason.trim(), slash_pct: slashPct },
      {
        onSuccess: (res: any) => {
          if (res?.success) {
            toast.success(`Đã slash ${Number(res.slashed_amount).toLocaleString()} CLY`);
            setOpen(false);
          } else {
            toast.error(res?.error || "Slash thất bại");
          }
        },
        onError: (e: any) => toast.error(e?.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <AlertTriangle className="h-3 w-3 mr-1" /> Slash
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Slash Validator
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
            <div className="font-semibold">{validatorName}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Hành động không thể hoàn tác. Phần stake bị slash sẽ vào treasury, phần còn lại refund.
            </div>
          </div>
          <div>
            <Label className="text-xs">Slash % (1-100)</Label>
            <Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} min={1} max={100} />
          </div>
          <div>
            <Label className="text-xs">Lý do (≥10 ký tự)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="VD: Chứng thực sai sự thật, sybil farming, vi phạm hiến chương..." />
          </div>
          <Button variant="destructive" className="w-full" onClick={handleSubmit} disabled={slash.isPending}>
            {slash.isPending ? "Đang xử lý..." : "Xác nhận Slash"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
