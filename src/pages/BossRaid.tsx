import { ChevronLeft, Lightbulb, Users2, Sparkles } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBossRaid } from "@/hooks/useBossRaid";
import { BossHpBar } from "@/components/raid/BossHpBar";
import { RaidLootGrid } from "@/components/raid/RaidLootGrid";
import { ClaimSummaryDialog } from "@/components/raid/ClaimSummaryDialog";
import { useAuth } from "@/hooks/useAuth";
import { smartBack } from "@/lib/smartBack";

function initials(name?: string | null) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function timeLeft(ends_at: string) {
  const ms = new Date(ends_at).getTime() - Date.now();
  if (ms <= 0) return "Đã hết hạn";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `Còn ${d} ngày ${h}h` : `Còn ${h}h`;
}

export default function BossRaid() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLoading, boss, me, top, loot, myPct, claim, isClaiming, payload, lastClaimed, clearLastClaimed } = useBossRaid();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>

        {isLoading && <p className="text-sm text-muted-foreground text-center">Đang thắp đèn…</p>}

        {!isLoading && !payload?.active && (
          <Card className="p-6 text-center space-y-2">
            <Lightbulb className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-bold">Chưa có ngọn đèn nào</p>
            <p className="text-xs text-muted-foreground">Mùa mới sẽ thắp lên ngọn đèn tiếp theo.</p>
          </Card>
        )}

        {boss && (
          <>
            {/* Hero */}
            <Card className="p-5 space-y-4 border-amber-400/40 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-amber-500/10">
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] flex items-center justify-center shrink-0">
                  <Lightbulb className="h-9 w-9 !text-black" />
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-extrabold leading-tight">{boss.name}</h1>
                  {boss.lore && <p className="text-xs text-muted-foreground mt-1 italic">"{boss.lore}"</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{timeLeft(boss.ends_at)}</p>
                </div>
              </div>
              <BossHpBar current={boss.current_hp} total={boss.total_hp} status={boss.status} />
              {user ? (
                <div className="rounded-lg border border-amber-400/30 bg-amber-50/30 dark:bg-amber-950/10 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Đóng góp của bạn
                  </div>
                  <p className="text-sm">
                    <span className="font-extrabold text-amber-600">{(me?.damage ?? 0).toLocaleString()}</span> ánh sáng ·{" "}
                    <span className="font-bold">{(me?.pct ?? 0).toFixed(3)}%</span> tổng độ sáng
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Mỗi quest, treasure, box, pet chat hay mời bạn đều tự động góp ánh sáng cho ngọn đèn.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-center text-muted-foreground italic">
                  Đăng nhập để cùng góp ánh sáng và nhận phần thưởng khi cộng đồng thắp sáng trọn vẹn.
                </p>
              )}
            </Card>

            {/* Top contributors (no rank — just names + pct) */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <Users2 className="h-4 w-4 text-amber-500" /> Cùng thắp sáng
                </div>
                {top.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {top.length} thành viên
                  </span>
                )}
              </div>
              {top.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  Hãy là người đầu tiên rọi sáng!
                </p>
              ) : (
                <div
                  className="grid gap-1.5 max-h-[320px] overflow-y-auto pr-1 -mr-1 scroll-smooth [scrollbar-gutter:stable]"
                  role="list"
                  aria-label="Danh sách thành viên cùng thắp sáng"
                >
                  {top.map((c, i) => (
                    <div key={c.user_id} role="listitem" className="flex items-center gap-2 text-xs py-0.5">
                      <span className="w-5 text-right tabular-nums text-muted-foreground text-[10px]">
                        {i + 1}
                      </span>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={c.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials(c.display_name)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate font-medium">{c.display_name}</span>
                      <span className="font-bold text-rose-500 tabular-nums w-14 text-right">
                        {c.pct.toFixed(3)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-center text-muted-foreground italic">
                Không cạnh tranh — chỉ ghi nhận ánh sáng đã rọi.
              </p>
            </Card>

            {/* Loot */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold">Phần thưởng ánh sáng</div>
                <span className="text-[10px] text-muted-foreground">
                  Mức đóng góp của bạn: <span className="font-bold text-foreground">{myPct.toFixed(3)}%</span>
                </span>
              </div>
              <RaidLootGrid
                loot={loot}
                myPct={myPct}
                bossStatus={boss.status}
                onClaim={(id) => claim(id)}
                isClaiming={isClaiming}
              />
            </Card>
          </>
        )}
      </div>
      <ClaimSummaryDialog entry={lastClaimed} onClose={clearLastClaimed} />
    </div>
  );
}
