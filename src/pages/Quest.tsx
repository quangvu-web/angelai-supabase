import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Flame, ChevronLeft, CheckCircle2, Lock, Loader2, Package, MapPin, ChevronDown, ExternalLink, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDailyQuests, type DailyQuest } from "@/hooks/useDailyQuests";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import RotateRunStatus from "@/components/quest/RotateRunStatus";
import Confetti from "@/components/quest/Confetti";
import PetMiniCard from "@/components/pet/PetMiniCard";
import { SeasonMiniCard } from "@/components/season/SeasonMiniCard";
import { MasteryMiniCard } from "@/components/mastery/MasteryMiniCard";
import { AchievementsMiniCard } from "@/components/achievements/AchievementsMiniCard";
import { LanternMiniCard } from "@/components/lantern/LanternMiniCard";
import { RiddleMiniCard } from "@/components/riddles/RiddleMiniCard";
import { BossMiniCard } from "@/components/raid/BossMiniCard";
import { LightCircleMiniCard } from "@/components/circle/LightCircleMiniCard";
import ShareCard from "@/components/viral/ShareCard";
import DailyCapBar from "@/components/quest/DailyCapBar";
import { getQuestGuide } from "@/lib/questGuides";
import { smartBack } from "@/lib/smartBack";

const dimColor: Record<string, string> = {
  S: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  T: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  H: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  C: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  U: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  bonus: "bg-muted text-muted-foreground",
};

const nextStreakMilestone = (s: number) => {
  for (const m of [3, 7, 14, 30, 60, 90, 180]) if (s < m) return m;
  return s;
};

export default function Quest() {
  const navigate = useNavigate();
  const { quests, streak, isLoading, claim, isClaiming, refetch } = useDailyQuests();
  const [active, setActive] = useState<DailyQuest | null>(null);
  const [evidence, setEvidence] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const [statusKey, setStatusKey] = useState(0);
  const [confetti, setConfetti] = useState(false);

  const completed = quests.filter((q) => q.status === "completed").length;
  const total = quests.length || 5;
  const next = streak ? nextStreakMilestone(streak.current_streak) : 3;

  const assignToday = async () => {
    setAssigning(true);
    try {
      const { data, error } = await supabase.functions.invoke("quest-daily-rotate");
      if (error) throw error;
      if (data?.success) {
        toast.success(`Đã gán ${data.assigned ?? 0} quest cho hôm nay 🌟`);
        refetch();
      } else {
        toast.error(data?.error || "Không gán được quest");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi gán quest");
    } finally {
      setAssigning(false);
      setStatusKey((k) => k + 1);
    }
  };

  useEffect(() => {
    if (!isLoading && quests.length === 0 && !autoTried && !assigning) {
      setAutoTried(true);
      assignToday();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, quests.length, autoTried]);

  const prevCompletedRef = useRef(0);
  useEffect(() => {
    if (completed > prevCompletedRef.current && prevCompletedRef.current !== 0) {
      setConfetti(true);
      const t = setTimeout(() => setConfetti(false), 2400);
      prevCompletedRef.current = completed;
      return () => clearTimeout(t);
    }
    prevCompletedRef.current = completed;
  }, [completed]);

  const onClaim = () => {
    if (!active) return;
    claim({ quest_id: active.id, evidence_text: evidence });
    setActive(null);
    setEvidence("");
  };

  return (
    <div className="min-h-screen bg-background">
      <Confetti show={confetti} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
            <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/treasure")} className="min-h-11">
              <MapPin className="h-4 w-4 mr-1" /> Kho báu
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/inventory")} className="min-h-11">
              <Package className="h-4 w-4 mr-1" /> Kho
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700]">
              <Flame className="h-4 w-4 !text-black" />
              <span className="!text-black font-extrabold text-sm">
                {streak?.current_streak ?? 0} ngày
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Today's Light Quests
          </h1>
          <p className="text-sm text-muted-foreground">
            Hoàn thành 5 nhiệm vụ ánh sáng mỗi ngày để giữ streak
          </p>
        </div>

        {/* Progress */}
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Tiến độ hôm nay</span>
            <span className="text-sm font-bold">{completed}/{total}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/60"
              initial={{ width: 0 }}
              animate={{ width: `${(completed / total) * 100}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          {streak && streak.current_streak < next && (
            <p className="text-xs text-muted-foreground mt-2">
              Còn {next - streak.current_streak} ngày để mở milestone {next} ngày
              {streak.multiplier > 1 && ` • Multiplier hiện tại ×${streak.multiplier}`}
            </p>
          )}
        </Card>

        {/* Daily Camly cap */}
        <DailyCapBar />

        {/* Light Mastery (Sprint 1 mini game v2) */}
        <MasteryMiniCard />
        <AchievementsMiniCard />

        {/* Lantern Path (Sprint 2) */}
        <LanternMiniCard />
        <RiddleMiniCard />

        {/* Season Pass */}
        <SeasonMiniCard />

        {/* Boss Raid */}
        <BossMiniCard />

        {/* Light Circle */}
        <LightCircleMiniCard />

        {/* Pet companion */}
        <PetMiniCard />

        {/* Viral share card */}
        <ShareCard
          title="Mời bạn cùng săn ánh sáng"
          description="Mỗi người bạn mời thành công, cả hai +20000 Camly."
          emoji="🤝"
        />

        {/* Rotate run status */}
        <RotateRunStatus refreshKey={statusKey} />

        {/* Quest list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="h-24 animate-pulse bg-muted/30" />
            ))}
          </div>
        ) : quests.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground space-y-3">
            <Sparkles className="h-10 w-10 mx-auto opacity-50" />
            <div>
              <p>Chưa có quest nào cho hôm nay.</p>
              <p className="text-xs mt-1">Bấm nút bên dưới để Angel AI gán 5 quest ngay.</p>
            </div>
            <Button onClick={assignToday} disabled={assigning} className="min-h-11">
              {assigning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang gán...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Nhận 5 quest hôm nay</>
              )}
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {quests.map((q, i) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`p-4 ${q.status === "completed" ? "opacity-60" : ""} ${q.status === "frozen" ? "border-destructive/40" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${dimColor[q.template.dimension] || dimColor.bonus}`}>
                        {q.status === "completed" ? <CheckCircle2 className="h-5 w-5" />
                          : q.status === "frozen" ? <Lock className="h-5 w-5" />
                          : <Sparkles className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{q.template.title_vi}</h3>
                          <Badge variant="outline" className={`${dimColor[q.template.dimension]} text-[10px]`}>
                            {q.template.dimension}
                          </Badge>
                        </div>
                        {q.template.description_vi && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {q.template.description_vi}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-amber-500 font-semibold">+{q.template.base_camly} Camly</span>
                          <span className="text-primary font-semibold">+{q.template.base_xp} XP</span>
                        </div>
                      </div>
                      {q.status === "pending" || q.status === "in_progress" ? (
                        <Button size="sm" onClick={() => setActive(q)} className="min-h-11">
                          Claim
                        </Button>
                      ) : q.status === "completed" ? (
                        <Badge className="bg-emerald-600 text-white">Done</Badge>
                      ) : (
                        <Badge variant="destructive">Frozen</Badge>
                      )}
                    </div>

                    {/* Hướng dẫn chi tiết */}
                    {(() => {
                      const guide = getQuestGuide(q.template.code);
                      if (!guide) return null;
                      return (
                        <Collapsible className="mt-3">
                          <div className="flex items-center justify-between gap-2">
                            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-primary hover:underline min-h-[36px]">
                              <BookOpen className="h-3.5 w-3.5" />
                              <span>Hướng dẫn chi tiết</span>
                              <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            {q.status !== "completed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary"
                                onClick={() => navigate(guide.whereRoute)}
                              >
                                Đến {guide.whereLabel} <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                          <CollapsibleContent className="mt-2 rounded-md bg-muted/40 p-3 space-y-2">
                            <div className="text-xs">
                              <span className="font-semibold">Làm ở: </span>
                              <button
                                onClick={() => navigate(guide.whereRoute)}
                                className="text-primary hover:underline"
                              >
                                {guide.whereLabel}
                              </button>
                            </div>
                            <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
                              {guide.steps.map((s, idx) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ol>
                            <div className="text-xs pt-1 border-t border-border/50">
                              <span className="font-semibold">Bằng chứng cần: </span>
                              <span className="text-muted-foreground">{guide.evidenceHint}</span>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })()}
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Claim dialog */}
      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setEvidence(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active?.template.title_vi}</DialogTitle>
          </DialogHeader>
          {active && (() => {
            const guide = getQuestGuide(active.template.code);
            return (
              <div className="space-y-3">
                {guide && (
                  <div className="rounded-md bg-muted/50 p-3 space-y-2 text-xs">
                    <div>
                      <span className="font-semibold">Làm ở: </span>
                      <button
                        onClick={() => { navigate(guide.whereRoute); setActive(null); }}
                        className="text-primary hover:underline"
                      >
                        {guide.whereLabel} →
                      </button>
                    </div>
                    <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                      {guide.steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                )}
                {active.template.requires_evidence && (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-semibold">Bằng chứng: </span>
                      <span className="text-muted-foreground">
                        {guide?.evidenceHint ?? "Mô tả ngắn về điều bạn vừa làm (Angel AI sẽ chấm độ chân thật)."}
                      </span>
                    </p>
                    <Textarea
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder={guide?.evidencePlaceholder ?? "Mình vừa..."}
                      rows={4}
                      maxLength={500}
                    />
                    <p className="text-[10px] text-muted-foreground text-right">
                      {evidence.length}/500 · tối thiểu 5 ký tự
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActive(null); setEvidence(""); }}>
              Huỷ
            </Button>
            <Button onClick={onClaim} disabled={isClaiming || (active?.template.requires_evidence && evidence.length < 5)}>
              {isClaiming ? "Đang xử lý..." : "Xác nhận Claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
