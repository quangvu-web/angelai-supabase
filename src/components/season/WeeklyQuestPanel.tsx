import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarRange, CheckCircle2, Crown, Loader2, Target } from "lucide-react";
import { useWeeklyQuests } from "@/hooks/useWeeklyQuests";
import { format } from "date-fns";

export function WeeklyQuestPanel() {
  const w = useWeeklyQuests();

  if (w.isLoading) {
    return (
      <Card className="p-4 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!w.season || w.quests.length === 0) return null;

  const weekLabel = w.weekStart && w.weekEnd
    ? `${format(new Date(w.weekStart), "dd/MM")} – ${format(new Date(new Date(w.weekEnd).getTime() - 86400000), "dd/MM")}`
    : "";

  return (
    <Card className="p-4 space-y-3 border-amber-400/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-500" />
          <h2 className="font-extrabold text-sm">Nhiệm vụ tuần</h2>
          <Badge variant="outline" className="gap-1 text-[10px] font-mono">
            <CalendarRange className="h-3 w-3" /> {weekLabel}
          </Badge>
        </div>
        <span className="text-[11px] text-muted-foreground">Reset mỗi thứ 2</span>
      </div>

      <div className="grid gap-2">
        {w.quests.map((q) => {
          const pct = Math.min(100, Math.round((q.progress / q.target_count) * 100));
          const locked = q.is_premium_only && !w.isPremium;
          return (
            <div
              key={q.id}
              className={`rounded-lg border p-3 space-y-2 ${q.claimed ? "bg-muted/40 border-muted" : "bg-card"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm">{q.title}</span>
                    {q.is_premium_only && (
                      <Badge className="bg-gradient-to-r from-amber-400 to-rose-500 !text-black text-[9px] gap-0.5 h-4 px-1.5">
                        <Crown className="h-2.5 w-2.5" /> Premium
                      </Badge>
                    )}
                    {q.claimed && (
                      <Badge variant="outline" className="text-[9px] gap-0.5 h-4 px-1.5 text-emerald-600 border-emerald-500/40">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Đã nhận
                      </Badge>
                    )}
                  </div>
                  {q.description && <p className="text-[11px] text-muted-foreground mt-0.5">{q.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-amber-600 font-extrabold text-sm leading-none">+{q.xp_reward}</div>
                  <div className="text-[9px] text-muted-foreground">XP mùa</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Progress value={pct} className="h-1.5 flex-1" />
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {Math.min(q.progress, q.target_count)}/{q.target_count}
                </span>
              </div>

              {!q.claimed && (
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  disabled={!q.completed || locked || w.isClaiming}
                  onClick={() => w.claim(q.id)}
                >
                  {locked ? "Cần Premium" : q.completed ? `Nhận +${q.xp_reward} XP` : "Đang làm…"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
