import { Link } from "@/lib/router-compat";
import { Card } from "@/components/ui/card";
import { usePet, xpForLevel } from "@/hooks/usePet";
import { PetAvatar } from "@/components/pet/PetAvatar";
import { Sparkles } from "lucide-react";

export default function PetMiniCard() {
  const { pet, isLoading } = usePet();
  if (isLoading) return null;

  if (!pet) {
    return (
      <Link to="/pet">
        <Card className="p-4 flex items-center gap-3 hover:bg-muted/40 transition cursor-pointer border-dashed">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/30 to-transparent flex items-center justify-center text-2xl">
            ✨
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Đón thú cưng ánh sáng
            </div>
            <p className="text-xs text-muted-foreground">Mở multiplier Camly +5% → +20% theo level</p>
          </div>
        </Card>
      </Link>
    );
  }

  const need = xpForLevel(pet.level);
  const pct = Math.min(100, (pet.xp / need) * 100);
  const remain = Math.max(0, need - pet.xp);
  return (
    <Link to="/pet">
      <Card className="p-4 flex items-center gap-3 hover:bg-muted/40 transition cursor-pointer">
        <PetAvatar pet={pet} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{pet.name}</span>
            <span className="text-xs text-muted-foreground">Lv {pet.level} • {pet.evolution}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1.5 mb-1">
            <span className="text-muted-foreground tabular-nums">{pet.xp} / {need} XP</span>
            <span className="font-semibold tabular-nums text-primary">còn {remain} XP</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Trò chuyện để bạn ấy lên level →</p>
        </div>
      </Card>
    </Link>
  );
}
