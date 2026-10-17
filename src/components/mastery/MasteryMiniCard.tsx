import { Sparkles, Award } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router-compat";
import { useMastery } from "@/hooks/useMastery";

export function MasteryMiniCard() {
  const navigate = useNavigate();
  const { state, isLoading } = useMastery();

  if (isLoading || !state?.ok) return null;

  const pct = state.xp_needed_for_next > 0
    ? Math.min(100, Math.round((state.xp_into_level / state.xp_needed_for_next) * 100))
    : 100;

  return (
    <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-fuchsia-500/5 to-indigo-500/10 border-amber-500/20">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-500/20 p-2 shrink-0">
          <Sparkles className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">Light Mastery</h3>
            <Badge variant="secondary" className="text-[10px]">Lv {state.level}/50</Badge>
            {state.pending_perks > 0 && (
              <Badge className="bg-amber-500 text-black text-[10px] gap-1">
                <Award className="h-3 w-3" /> {state.pending_perks} perk mới
              </Badge>
            )}
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-fuchsia-400 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {state.level >= 50
              ? "Đã đạt cấp tối đa ✨"
              : `${state.xp_into_level.toLocaleString()} / ${state.xp_needed_for_next.toLocaleString()} XP đến Lv ${state.level + 1}`}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 mt-2 text-xs"
            onClick={() => navigate("/mastery")}
          >
            Xem cây kỹ năng
          </Button>
        </div>
      </div>
    </Card>
  );
}
