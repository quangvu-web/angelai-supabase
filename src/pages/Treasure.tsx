import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, MapPin, Lock, CheckCircle2, Gift, Sparkles, Users } from "lucide-react";
import { useTreasure } from "@/hooks/useTreasure";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { TreasureTeamPanel } from "@/components/treasure/TreasureTeamPanel";
import { smartBack } from "@/lib/smartBack";

const clueTypeLabel: Record<string, string> = {
  in_app: "Trong app",
  telegram: "Telegram",
  social: "Social",
  qr: "QR ngoài đời",
};

export default function Treasure() {
  const navigate = useNavigate();
  const t = useTreasure();
  const [activeClueId, setActiveClueId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const activeClue = t.clues.find((c) => c.id === activeClueId);
  const fragmentSet = new Set(t.fragments.map((f) => f.fragment_index));
  const fragmentCount = fragmentSet.size;

  const onSubmit = () => {
    if (!activeClue) return;
    t.submit({ clue_id: activeClue.id, answer, clue_seq: activeClue.seq });
    setActiveClueId(null);
    setAnswer("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <Badge className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold">
            <MapPin className="h-3 w-3 mr-1" /> Treasure Hunt
          </Badge>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Săn kho báu ánh sáng
          </h1>
          <p className="text-sm text-muted-foreground">
            Giải 5 manh mối → ghép bản đồ → mở Cosmic Box
          </p>
        </div>

        {t.isLoading ? (
          <Card className="h-40 animate-pulse bg-muted/30" />
        ) : !t.event ? (
          <Card className="p-8 text-center text-muted-foreground space-y-3">
            <MapPin className="h-10 w-10 mx-auto opacity-50" />
            <div>
              <p>Chưa có sự kiện kho báu nào đang diễn ra.</p>
              <p className="text-xs mt-1">Đợi event mới mỗi tuần nhé.</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Event header */}
            <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold text-lg">{t.event.name}</h2>
                  {t.event.description && (
                    <p className="text-xs text-muted-foreground mt-1">{t.event.description}</p>
                  )}
                </div>
                <Badge variant={t.event.status === "active" ? "default" : "outline"}>
                  {t.event.status === "active" ? "Đang diễn ra" : "Sắp tới"}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Kết thúc: {new Date(t.event.ends_at).toLocaleString("vi-VN")}
              </div>
            </Card>

            {/* Fragment progress */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Bản đồ kho báu</span>
                <span className="text-sm font-bold">{fragmentCount}/5 mảnh</span>
              </div>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center text-2xl ${
                      fragmentSet.has(i)
                        ? "bg-gradient-to-br from-[#daa520] to-[#ffd700] border-[#b8860b] !text-black"
                        : "bg-muted/30 border-dashed border-muted text-muted-foreground"
                    }`}
                  >
                    {fragmentSet.has(i) ? "🗺️" : i}
                  </div>
                ))}
              </div>
              <Progress value={(fragmentCount / 5) * 100} className="h-2" />

              {fragmentCount === 5 && !t.claimed && (
                <Button
                  className="w-full mt-3 bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold min-h-12"
                  onClick={() => t.claim()}
                  disabled={t.isClaiming}
                >
                  <Gift className="h-4 w-4 mr-2" />
                  {t.isClaiming ? "Đang mở..." : "Mở Cosmic Box 🎁"}
                </Button>
              )}
              {t.claimed && (
                <Button variant="outline" className="w-full mt-3" onClick={() => navigate("/inventory")}>
                  Đã claim — xem trong Kho
                </Button>
              )}
            </Card>

            {/* Clues */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" /> 5 Manh mối
              </h3>
              {t.clues.map((c, i) => {
                const solved = t.solvedIds.has(c.id);
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className={`p-4 ${solved ? "opacity-70" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                          {solved ? <CheckCircle2 className="h-5 w-5" /> : c.seq}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-sm">{c.title}</h4>
                            <Badge variant="outline" className="text-[10px]">
                              {clueTypeLabel[c.clue_type]}
                            </Badge>
                          </div>
                          {c.description && (
                            <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                          )}
                          <div className="text-xs text-primary font-semibold mt-1">+{c.points} điểm</div>
                        </div>
                        {solved ? (
                          <Badge className="bg-emerald-600 text-white">Solved</Badge>
                        ) : (
                          <Button size="sm" onClick={() => setActiveClueId(c.id)} className="min-h-11">
                            Giải
                          </Button>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {t.event && <TreasureTeamPanel eventId={t.event.id} totalClues={t.clues.length} />}
          </>
        )}
      </div>

      <Dialog open={!!activeClueId} onOpenChange={(o) => { if (!o) { setActiveClueId(null); setAnswer(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeClue?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{activeClue?.description}</p>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Đáp án của bạn..."
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Giới hạn 1 lần thử / 10 phút
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActiveClueId(null); setAnswer(""); }}>Huỷ</Button>
            <Button onClick={onSubmit} disabled={t.isSubmitting || answer.trim().length < 1}>
              {t.isSubmitting ? "Đang kiểm tra..." : "Nộp đáp án"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
