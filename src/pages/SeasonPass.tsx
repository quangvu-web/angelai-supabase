import { useMemo, useState } from "react";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useSeasonPass } from "@/hooks/useSeasonPass";
import { SeasonRewardCard } from "@/components/season/SeasonRewardCard";
import { SeasonProgressBar } from "@/components/season/SeasonProgressBar";
import { SeasonPremiumDialog } from "@/components/season/SeasonPremiumDialog";
import { WeeklyQuestPanel } from "@/components/season/WeeklyQuestPanel";
import { SeasonCoopSpotlight } from "@/components/season/SeasonCoopSpotlight";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";
import { smartBack } from "@/lib/smartBack";

export default function SeasonPass() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const s = useSeasonPass();
  const [premiumOpen, setPremiumOpen] = useState(false);

  useEffect(() => {
    if (s.season?.name) document.title = `Season Pass — ${s.season.name}`;
  }, [s.season?.name]);

  const grouped = useMemo(() => {
    const map = new Map<number, { free?: typeof s.rewards[number]; premium?: typeof s.rewards[number] }>();
    for (const r of s.rewards) {
      const cur = map.get(r.level) ?? {};
      cur[r.track] = r;
      map.set(r.level, cur);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [s.rewards]);

  if (s.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!s.active || !s.season) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 text-center max-w-md">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <h1 className="font-bold mb-1">Chưa có mùa nào đang chạy</h1>
          <p className="text-sm text-muted-foreground">Quay lại sau để bắt đầu mùa mới nhé.</p>
          <Button asChild variant="outline" className="mt-4"><Link to="/quest">Về Quest</Link></Button>
        </Card>
      </div>
    );
  }

  const level = s.pass?.level ?? 1;
  const xp = s.pass?.xp ?? 0;
  const isPremium = !!s.pass?.is_premium;
  const endsIn = formatDistanceToNowStrict(new Date(s.season.ends_at), { locale: vi });

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>

        {/* Hero */}
        <Card className="p-5 bg-gradient-to-br from-[#b8860b]/15 via-[#daa520]/10 to-[#ffd700]/15 border-amber-400/40 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h1 className="text-xl font-extrabold">{s.season.name}</h1>
                {isPremium && <Badge className="bg-gradient-to-r from-amber-400 to-rose-500 !text-black font-bold gap-1"><Crown className="h-3 w-3" /> Premium</Badge>}
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">{s.season.description}</p>
              <div className="text-[11px] text-muted-foreground mt-1">Kết thúc trong <span className="font-semibold text-foreground">{endsIn}</span></div>
            </div>
            {!isPremium && user && (
              <Button
                onClick={() => setPremiumOpen(true)}
                className="bg-gradient-to-r from-amber-400 to-rose-500 !text-black font-bold hover:opacity-90"
              >
                <Crown className="h-4 w-4 mr-1" /> Mở Premium · {s.season.premium_price_camly.toLocaleString()} Camly
              </Button>
            )}
          </div>

          <SeasonProgressBar level={level} xp={xp} xpPerLevel={s.season.xp_per_level} maxLevel={s.season.max_level} />
        </Card>

        {!user && (
          <Card className="p-3 text-center text-xs text-muted-foreground">
            Đăng nhập để cộng XP và nhận thưởng. <Link to="/auth" className="underline">Đăng nhập</Link>
          </Card>
        )}

        {user && <WeeklyQuestPanel />}

        <SeasonCoopSpotlight />

        {/* Tracks */}
        <Card className="p-3 overflow-x-auto">
          <div className="flex flex-col gap-3 min-w-max">
            <div className="text-xs font-bold flex items-center gap-1"><Crown className="h-3.5 w-3.5 text-amber-400" /> Premium</div>
            <div className="flex gap-2">
              {grouped.map(([lvl, pair]) =>
                pair.premium ? (
                  <SeasonRewardCard
                    key={`p-${lvl}`}
                    reward={pair.premium}
                    currentLevel={level}
                    isPremium={isPremium}
                    claimed={s.isClaimed(lvl, "premium")}
                    onClaim={() => s.claim({ level: lvl, track: "premium" })}
                    isClaiming={s.isClaiming}
                  />
                ) : (
                  <div key={`p-${lvl}`} className="min-w-[110px]" />
                )
              )}
            </div>

            <div className="text-xs font-bold mt-2">Free</div>
            <div className="flex gap-2">
              {grouped.map(([lvl, pair]) =>
                pair.free ? (
                  <SeasonRewardCard
                    key={`f-${lvl}`}
                    reward={pair.free}
                    currentLevel={level}
                    isPremium={isPremium}
                    claimed={s.isClaimed(lvl, "free")}
                    onClaim={() => s.claim({ level: lvl, track: "free" })}
                    isClaiming={s.isClaiming}
                  />
                ) : (
                  <div key={`f-${lvl}`} className="min-w-[110px]" />
                )
              )}
            </div>
          </div>
        </Card>

        <Card className="p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Cách lên XP mùa:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Hoàn thành quest hằng ngày: <strong>+20 XP</strong> mỗi quest</li>
            <li>Giải clue treasure: <strong>+30 XP</strong></li>
            <li>Claim jackpot: <strong>+200 XP</strong></li>
            <li>Mở hộp: <strong>+10 XP</strong></li>
            <li>Pet luyện tập: <strong>+5 XP</strong></li>
            <li>Mời bạn thành công: <strong>+100 XP</strong> cho cả hai</li>
          </ul>
        </Card>
      </div>

      <SeasonPremiumDialog
        open={premiumOpen}
        onOpenChange={setPremiumOpen}
        priceCamly={s.season.premium_price_camly}
        seasonName={s.season.name}
        onConfirm={() => {
          s.unlockPremium();
          setPremiumOpen(false);
        }}
        isPending={s.isUnlocking}
      />
    </div>
  );
}
