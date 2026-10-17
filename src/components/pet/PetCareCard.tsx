import { useNavigate } from "@/lib/router-compat";
import { motion } from "framer-motion";
import { Loader2, PawPrint, ChevronRight, Check } from "lucide-react";
import { usePet, xpForLevel } from "@/hooks/usePet";
import { PetAvatar } from "@/components/pet/PetAvatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type CareAction = "feed" | "play" | "meditate";
const ACTIONS: { key: CareAction; label: string; emoji: string; xp: number; stat: string; tint: string; ring: string }[] = [
  { key: "feed",     label: "Cho ăn",    emoji: "🍙", xp: 10, stat: "+Energy", tint: "bg-orange-50 border-orange-100", ring: "ring-orange-300" },
  { key: "play",     label: "Chơi đùa",  emoji: "🎈", xp: 8,  stat: "+Mood",   tint: "bg-pink-50 border-pink-100",     ring: "ring-pink-300" },
  { key: "meditate", label: "Toả ánh sáng", emoji: "✨", xp: 12, stat: "+Aura",   tint: "bg-violet-50 border-violet-100", ring: "ring-violet-300" },
];

export function PetCareCard() {
  const navigate = useNavigate();
  const { pet, isLoading, care, isCaring, careTodayDone } = usePet();

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-amber-100 bg-amber-50/40 p-6 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!pet) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate("/pet")}
        className="relative overflow-hidden rounded-3xl p-5 cursor-pointer active:scale-[0.99] transition-transform border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white/80 flex items-center justify-center border border-amber-200">
            <PawPrint className="h-7 w-7 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-extrabold text-base text-foreground">Đón thú cưng ánh sáng</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Chọn linh thú đồng hành, mở multiplier 1.0–1.20× Camly.</p>
          </div>
          <ChevronRight className="h-5 w-5 text-amber-600 shrink-0" />
        </div>
      </motion.div>
    );
  }

  const xpMax = xpForLevel(pet.level);
  const xpPct = Math.min(100, (pet.xp / xpMax) * 100);
  const doneCount = ACTIONS.filter((a) => careTodayDone.has(a.key)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-4 space-y-4"
    >
      {/* Top: pet snapshot */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/pet")} className="shrink-0 active:scale-95 transition-transform">
          <PetAvatar pet={pet} size={64} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-base text-foreground truncate">{pet.name}</h3>
            <Badge variant="outline" className="text-[10px] py-0 h-5">Lv {pet.level}</Badge>
            <Badge className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold border-0 text-[10px] py-0 h-5 capitalize">
              {pet.evolution}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 mb-1">
            <span>XP</span>
            <span>{pet.xp}/{xpMax}</span>
          </div>
          <Progress value={xpPct} className="h-1.5" />
          <div className="flex gap-3 mt-2 text-[11px]">
            <span>⚡ {pet.energy}</span>
            <span>💖 {pet.mood}</span>
            <span>🌟 {pet.aura}</span>
          </div>
        </div>
      </div>

      {/* Daily care heading */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-bold text-foreground">Chăm sóc hôm nay</div>
        <div className="text-[10px] text-muted-foreground">{doneCount}/{ACTIONS.length} đã hoàn thành</div>
      </div>

      {/* Action tiles */}
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => {
          const done = careTodayDone.has(a.key);
          return (
            <button
              key={a.key}
              type="button"
              disabled={done || isCaring}
              onClick={() => care(a.key)}
              className={`relative p-3 rounded-2xl border text-center transition-all min-h-[96px] flex flex-col items-center justify-center gap-1 ${
                done
                  ? "bg-emerald-50 border-emerald-200 opacity-90"
                  : `${a.tint} active:scale-[0.96] hover:ring-2 ${a.ring}`
              } disabled:cursor-not-allowed`}
            >
              {done && (
                <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
              <div className="text-2xl leading-none">{a.emoji}</div>
              <div className="text-[12px] font-bold text-foreground">{a.label}</div>
              <div className="text-[10px] text-muted-foreground">+{a.xp} XP · {a.stat}</div>
            </button>
          );
        })}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/pet")}
        className="w-full text-amber-700 hover:bg-amber-100/60"
      >
        Trò chuyện & xem chi tiết <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </motion.div>
  );
}
