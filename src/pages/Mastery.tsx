import { ChevronLeft, Sparkles, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMastery } from "@/hooks/useMastery";
import { smartBack } from "@/lib/smartBack";
import { toast } from "sonner";

export default function Mastery() {
  const navigate = useNavigate();
  const { state, catalog, isLoading, claimPerk, isClaiming } = useMastery();

  const chosen = new Map(state?.perks?.map((p) => [p.level_unlocked, p.perk_key]) ?? []);

  const handleClaim = async (level: number, perk_key: string) => {
    try {
      const res = await claimPerk({ level, perk_key });
      if (res?.ok) toast.success("Đã nhận perk ✨");
      else toast.error(res?.reason ?? "Không thể nhận perk");
    } catch (e: any) {
      toast.error(e?.message ?? "Lỗi không xác định");
    }
  };

  const pct = state?.xp_needed_for_next
    ? Math.min(100, Math.round((state.xp_into_level / state.xp_needed_for_next) * 100))
    : 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>

        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center rounded-full bg-amber-500/20 p-3">
            <Sparkles className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold">Light Mastery</h1>
          <p className="text-sm text-muted-foreground">
            Cây kỹ năng ánh sáng xuyên suốt mọi mini game · 50 level · 10 mốc perk
          </p>
        </header>

        {isLoading || !state ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            <Card className="p-5 bg-gradient-to-br from-amber-500/10 to-fuchsia-500/10 border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold">Lv {state.level}<span className="text-base text-muted-foreground">/50</span></span>
                {state.pending_perks > 0 && (
                  <Badge className="bg-amber-500 text-black">{state.pending_perks} perk chưa chọn</Badge>
                )}
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-fuchsia-400" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {state.level >= 50
                  ? "Đã đạt cấp tối đa ✨"
                  : `${state.xp_into_level.toLocaleString()} / ${state.xp_needed_for_next.toLocaleString()} XP đến Lv ${state.level + 1}`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Tổng XP: {state.total_xp.toLocaleString()}</p>
            </Card>

            {state.level >= 50 && (
              <Card
                onClick={() => navigate("/ascension")}
                className="p-4 cursor-pointer bg-gradient-to-r from-[#b8860b]/15 via-[#daa520]/15 to-[#ffd700]/15 border-amber-400/50 hover:border-amber-400 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold">👑 Sẵn sàng Thăng Sáng</p>
                    <p className="text-xs text-muted-foreground">Hiến NFT epic+ → nhận danh hiệu & bonus Camly vĩnh viễn</p>
                  </div>
                  <Badge className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold border-0">
                    Mở khoá
                  </Badge>
                </div>
              </Card>
            )}

            <div className="space-y-3">
              {catalog.map((entry) => {
                const unlocked = state.level >= entry.level;
                const picked = chosen.get(entry.level);
                return (
                  <Card key={entry.level} className={`p-4 ${unlocked ? "" : "opacity-60"}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={unlocked ? "default" : "secondary"}>Lv {entry.level}</Badge>
                      <span className="text-sm font-semibold">{entry.description}</span>
                      {!unlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
                      {picked && <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {entry.options.map((opt) => {
                        const isPicked = picked === opt.key;
                        const canPick = unlocked && !picked;
                        return (
                          <button
                            key={opt.key}
                            disabled={!canPick || isClaiming}
                            onClick={() => handleClaim(entry.level, opt.key)}
                            className={`text-left p-3 rounded-lg border transition ${
                              isPicked
                                ? "border-emerald-500/40 bg-emerald-500/10"
                                : canPick
                                ? "border-amber-500/30 hover:bg-amber-500/5 hover:border-amber-500/50"
                                : "border-border bg-muted/30 cursor-not-allowed"
                            }`}
                          >
                            <p className="text-sm font-medium">{opt.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{opt.desc}</p>
                            {isPicked && <Badge variant="secondary" className="mt-2 text-[10px]">Đã chọn</Badge>}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="p-4 bg-muted/30 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Mastery hoạt động thế nào?</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Mọi XP từ Daily Quest, Pet, Treasure, Boss Raid, Lantern, Riddles, Forge… đều cộng vào Mastery.</li>
                <li>Mỗi 5 level mở 1 perk cộng dồn vĩnh viễn (multiplier vẫn nằm trong cap mềm ×2.5 toàn hệ).</li>
                <li>XP cần: <code>500 × L^1.35</code>. Tổng ~1.2M XP tới Lv 50.</li>
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
