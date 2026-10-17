import { Sparkles, Flame, ChevronRight } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { Card } from "@/components/ui/card";
import { useDailyQuests } from "@/hooks/useDailyQuests";

export default function DailyQuestWidget() {
  const { quests, streak, isLoading } = useDailyQuests();
  if (isLoading) return null;

  const completed = quests.filter((q) => q.status === "completed").length;
  const total = quests.length || 5;

  return (
    <Link to="/quest" className="block">
      <Card className="p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 hover:border-primary/40 transition">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#daa520] to-[#ffd700] flex items-center justify-center">
              <Sparkles className="h-5 w-5 !text-black" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Today's Light Quests</h3>
              <p className="text-xs text-muted-foreground">{completed}/{total} hoàn thành hôm nay</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {streak && streak.current_streak > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/10 text-orange-500">
                <Flame className="h-3 w-3" />
                <span className="text-xs font-bold">{streak.current_streak}d</span>
              </div>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </Card>
    </Link>
  );
}
