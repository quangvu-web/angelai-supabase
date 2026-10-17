import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { ChevronLeft, Loader2, Flame, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { smartBack } from "@/lib/smartBack";
import { useLanternPath, type LanternTheme } from "@/hooks/useLanternPath";

const dimColor: Record<string, string> = {
  S: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  T: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  H: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  C: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  U: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

export default function Lantern() {
  const navigate = useNavigate();
  const { progress, isLoading, submitDay, isSubmitting, claimWeekly, isClaiming } = useLanternPath();
  const [active, setActive] = useState<{ idx: number; theme: LanternTheme } | null>(null);
  const [evidence, setEvidence] = useState("");

  if (isLoading || !progress?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const doneMap = new Map(progress.days.map((d) => [d.day_idx, d]));
  const doneCount = progress.days.length;
  const totalCamly = progress.days.reduce((a, d) => a + d.camly_awarded, 0);
  const totalXp = progress.days.reduce((a, d) => a + d.xp_awarded, 0);

  const handleSubmit = async () => {
    if (!active) return;
    if (evidence.trim().length < 30) {
      toast.error("Cần ít nhất 30 ký tự chia sẻ chân thật");
      return;
    }
    try {
      const res = await submitDay({ day_idx: active.idx, theme_key: active.theme.key, evidence: evidence.trim() });
      if (res?.ok) {
        toast.success(`✨ +${res.camly} Camly · +${res.xp} XP (AI score ${(res.score ?? 0).toFixed(2)})`);
        setActive(null);
        setEvidence("");
      } else if (res?.reason === "ai_gate_failed") {
        toast.error("Chia sẻ chưa đủ chân thật. Thử viết cụ thể hơn về cảm xúc / hành động.");
      } else if (res?.reason === "day_already_done") {
        toast.error("Chặng này đã hoàn thành tuần này rồi.");
        setActive(null);
      } else {
        toast.error(res?.reason ?? "Lỗi không xác định");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Lỗi");
    }
  };

  const handleClaim = async () => {
    try {
      const res = await claimWeekly();
      if (res?.ok) {
        toast.success(`🏮 Weekly Lantern! +${res.camly} Camly · +${res.xp} XP`);
      } else {
        toast.error(res?.reason ?? "Chưa đủ 7/7 chặng");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Lỗi");
    }
  };

  const canClaim = doneCount >= 7 && !progress.bonus_claimed;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>

        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center rounded-full bg-amber-500/20 p-3">
            <Flame className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold">Lantern Path</h1>
          <p className="text-sm text-muted-foreground">
            Chuỗi 7 chặng/tuần · viết chân thật → AI chấm → nhận Camly + XP. Đủ 7/7 nhận Weekly Lantern.
          </p>
        </header>

        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 border-amber-500/20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Tuần bắt đầu</p>
              <p className="font-semibold">{progress.week_start}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tiến độ</p>
              <p className="font-semibold">{doneCount}/7 chặng</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Đã nhận</p>
              <p className="font-semibold">{totalCamly.toLocaleString()} Camly · {totalXp} XP</p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-fuchsia-400 transition-all" style={{ width: `${(doneCount / 7) * 100}%` }} />
          </div>
          {progress.bonus_claimed ? (
            <Badge className="mt-3 bg-emerald-500 text-black gap-1">
              <CheckCircle2 className="h-3 w-3" /> Đã nhận Weekly Lantern (+{progress.bonus?.camly_awarded} Camly · +{progress.bonus?.xp_awarded} XP)
            </Badge>
          ) : canClaim ? (
            <Button className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-black" onClick={handleClaim} disabled={isClaiming}>
              {isClaiming ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Nhận Weekly Lantern (+400 Camly · +600 XP)
            </Button>
          ) : (
            <p className="mt-2 text-[11px] text-muted-foreground">Hoàn thành 7/7 chặng để mở Weekly Lantern.</p>
          )}
        </Card>

        <div className="grid sm:grid-cols-2 gap-3">
          {progress.themes.map((theme, idx) => {
            const done = doneMap.get(idx);
            return (
              <Card key={theme.key} className={`p-4 ${done ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{theme.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{theme.label}</span>
                      <Badge variant="outline" className={`text-[10px] ${dimColor[theme.dim] ?? ""}`}>{theme.dim}</Badge>
                      {done && <Badge className="bg-emerald-500 text-black text-[10px]">+{done.camly_awarded}/+{done.xp_awarded}xp</Badge>}
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1">{theme.prompt}</p>
                    {done ? (
                      <p className="text-[11px] text-muted-foreground mt-2 italic line-clamp-2">"{done.evidence}"</p>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 mt-2 text-xs" onClick={() => { setActive({ idx, theme }); setEvidence(""); }}>
                        Chia sẻ chặng này
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-4 bg-muted/30 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Cách chấm điểm</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Mỗi chia sẻ ≥ 30 ký tự, AI chấm 0–1, gate ≥ 0.55 mới trao thưởng.</li>
            <li>Camly mỗi chặng: 30 + score × 50 (30–80). XP cố định 60/chặng.</li>
            <li>Weekly Lantern: +400 Camly + +600 XP khi đủ 7/7. Tuần mới reset thứ 2.</li>
            <li>XP tự cộng vào Season Pass + Light Mastery.</li>
          </ul>
        </Card>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{active?.theme.emoji}</span>
              {active?.theme.label}
            </DialogTitle>
            <DialogDescription>{active?.theme.prompt}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Viết chân thật, cụ thể (tối thiểu 30 ký tự)..."
            rows={5}
            maxLength={800}
          />
          <p className="text-[11px] text-muted-foreground text-right">{evidence.length}/800</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)} disabled={isSubmitting}>Huỷ</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || evidence.trim().length < 30}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gửi & nhận thưởng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
