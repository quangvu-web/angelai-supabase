import { Trophy, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAchievements } from "@/hooks/useAchievements";

export function AchievementsMiniCard() {
  const navigate = useNavigate();
  const { items, unlocked, total, activeCode, loading } = useAchievements();

  if (loading || total === 0) return null;

  const activeTitle = items.find((i) => i.code === activeCode)?.title_text ?? null;
  const pct = total ? Math.round((unlocked.length / total) * 100) : 0;

  return (
    <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent border-amber-500/20">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-500/20 p-2 shrink-0">
          <Trophy className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">Thành tựu</h3>
            <Badge variant="secondary" className="text-[10px]">
              {unlocked.length}/{total}
            </Badge>
            {activeTitle && (
              <Badge className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black text-[10px] gap-1 font-bold">
                <Crown className="h-3 w-3" /> {activeTitle}
              </Badge>
            )}
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {activeTitle
              ? "Đổi danh hiệu hoặc mở khoá thêm thành tựu mới."
              : "Mở khoá thành tựu để nhận danh hiệu hiển thị trên hồ sơ."}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 mt-2 text-xs"
            onClick={() => navigate("/achievements")}
          >
            Xem tất cả thành tựu
          </Button>
        </div>
      </div>
    </Card>
  );
}
