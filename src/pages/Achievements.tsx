import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { ChevronLeft, Trophy, Lock, Check, Sparkles, Loader2, Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAchievements, type AchievementItem } from "@/hooks/useAchievements";
import { smartBack } from "@/lib/smartBack";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  ascension: "Thăng Sáng",
  pet: "Tinh linh",
  treasure: "Kho báu",
  referral: "Kết nối",
  mastery: "Mastery",
  nft: "Bộ sưu tập NFT",
  lamp: "Ngọn đèn",
  season: "Mùa giải",
};

function AchievementCard({
  item,
  active,
  onSetActive,
  busy,
}: {
  item: AchievementItem;
  active: boolean;
  onSetActive: () => void;
  busy: boolean;
}) {
  const locked = !item.unlocked;
  return (
    <Card
      className={cn(
        "p-4 flex flex-col gap-3 transition-all",
        locked && "opacity-60",
        active && "ring-2 ring-amber-400 shadow-lg shadow-amber-500/20"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0",
            locked
              ? "bg-muted"
              : "bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700]"
          )}
          aria-hidden
        >
          {locked ? <Lock className="h-5 w-5 text-muted-foreground" /> : <span>{item.icon}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-sm leading-tight">{item.name}</h3>
            {item.unlocked && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            {item.description}
          </p>
          {item.title_text && (
            <Badge variant="outline" className="mt-1.5 text-[10px] font-bold !text-amber-600 dark:!text-amber-400 border-amber-400/50">
              <Crown className="h-2.5 w-2.5 mr-1" /> {item.title_text}
            </Badge>
          )}
        </div>
      </div>
      {item.unlocked && item.title_text && (
        <Button
          size="sm"
          variant={active ? "secondary" : "default"}
          className={cn(
            "w-full min-h-9 text-xs",
            !active &&
              "bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black hover:opacity-90 font-bold"
          )}
          onClick={onSetActive}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : active ? (
            <>
              <X className="h-3.5 w-3.5 mr-1" /> Bỏ chọn
            </>
          ) : (
            <>
              <Crown className="h-3.5 w-3.5 mr-1" /> Chọn làm danh hiệu
            </>
          )}
        </Button>
      )}
    </Card>
  );
}

export default function Achievements() {
  const navigate = useNavigate();
  const { items, unlocked, total, activeCode, loading, setActiveTitle } = useAchievements();
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, AchievementItem[]>();
    for (const it of items) {
      const k = it.category;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries());
  }, [items]);

  const handleSetActive = async (code: string) => {
    setBusyCode(code);
    try {
      const next = activeCode === code ? null : code;
      const res: any = await setActiveTitle(next);
      if (res?.success === false) {
        toast.error(res.error ?? "Không thể đặt danh hiệu");
      } else {
        toast.success(next ? "Đã chọn danh hiệu ✨" : "Đã bỏ danh hiệu");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Lỗi không xác định");
    } finally {
      setBusyCode(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>

        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center rounded-full bg-amber-500/20 p-3">
            <Trophy className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-extrabold">Thành tựu &amp; Danh hiệu</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Mở khoá thành tựu qua các hoạt động trong ecosystem và chọn danh hiệu hiển thị trên hồ sơ của bạn.
          </p>
        </header>

        <Card className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border-amber-400/30">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-bold">
                Tiến độ: {unlocked.length} / {total}
              </div>
              <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700]"
                  style={{ width: total ? `${(unlocked.length / total) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([cat, list]) => (
              <section key={cat} className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABEL[cat] ?? cat}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {list.map((it) => (
                    <AchievementCard
                      key={it.code}
                      item={it}
                      active={activeCode === it.code}
                      busy={busyCode === it.code}
                      onSetActive={() => handleSetActive(it.code)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
