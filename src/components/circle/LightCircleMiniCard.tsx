import { useNavigate } from "@/lib/router-compat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Users2 } from "lucide-react";
import { useLightCircle } from "@/hooks/useLightCircle";

export function LightCircleMiniCard() {
  const navigate = useNavigate();
  const { my, isLoading } = useLightCircle();
  if (isLoading) return null;

  if (!my?.in_circle) {
    return (
      <Card className="p-3 border-amber-400/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/10 cursor-pointer" onClick={() => navigate("/circle")}>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] flex items-center justify-center">
            <Users2 className="h-4 w-4 !text-black" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold leading-tight">Tham gia Vòng Sáng</p>
            <p className="text-[11px] text-muted-foreground">Cùng 5–20 người thắp sáng mỗi ngày</p>
          </div>
          <Button size="sm" variant="ghost">→</Button>
        </div>
      </Card>
    );
  }

  const c = my.circle!;
  return (
    <Card className="p-3 border-amber-400/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/10 cursor-pointer" onClick={() => navigate("/circle")}>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-amber-500/20 flex items-center justify-center text-lg">
          {c.avatar_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{c.name}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span className="inline-flex items-center gap-0.5"><Users2 className="h-3 w-3" />{c.member_count}/{c.max_members}</span>
            <span className="inline-flex items-center gap-0.5"><Sparkles className="h-3 w-3 text-amber-500" />{c.light_pool.toLocaleString()}</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
