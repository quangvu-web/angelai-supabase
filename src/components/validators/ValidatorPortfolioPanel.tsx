import { Link } from "@/lib/router-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyValidatorPortfolio } from "@/hooks/useValidatorMarketplace";
import { useUnstakeValidator } from "@/hooks/useOrgIdentity";
import { useClaimValidatorRewards } from "@/hooks/useValidatorRewards";
import { Coins, Lock, ShieldCheck, Award, Wallet } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export function ValidatorPortfolioPanel() {
  const { data: portfolio, isLoading } = useMyValidatorPortfolio();
  const unstake = useUnstakeValidator();
  const claim = useClaimValidatorRewards();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!portfolio) {
    return (
      <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">
        Vui lòng đăng nhập để xem danh mục
      </CardContent></Card>
    );
  }

  const stakes: any[] = portfolio.stakes || [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <SumCard icon={<Coins className="h-4 w-4" />} label="Đang stake" value={Number(portfolio.total_active).toLocaleString()} suffix="CLY" />
        <SumCard icon={<Lock className="h-4 w-4" />} label="Đang rút" value={Number(portfolio.total_unstaking).toLocaleString()} suffix="CLY" />
        <SumCard icon={<ShieldCheck className="h-4 w-4" />} label="Validators" value={String(portfolio.validator_count)} />
        <SumCard icon={<Award className="h-4 w-4" />} label="Đã claim" value={Number(portfolio.lifetime_claimed).toLocaleString()} suffix="CLY" />
      </div>

      {/* Claimable rewards */}
      {Number(portfolio.claimable_rewards) > 0 && (
        <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Bạn có thể claim</div>
              <div className="text-2xl font-bold flex items-center gap-1">
                <Wallet className="h-5 w-5 text-amber-500" />
                {Number(portfolio.claimable_rewards).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">CLY</span>
              </div>
            </div>
            <Button
              onClick={() => claim.mutate(undefined, {
                onSuccess: (r: any) => r?.success
                  ? toast.success(`Đã claim ${Number(r.amount).toLocaleString()} CLY`)
                  : toast.error(r?.error || "Lỗi"),
              })}
              disabled={claim.isPending}
            >
              {claim.isPending ? "Đang claim..." : "Claim ngay"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stakes list */}
      <Card>
        <CardHeader><CardTitle className="text-base">Stakes của bạn</CardTitle></CardHeader>
        <CardContent className="p-0">
          {stakes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Bạn chưa stake validator nào. Khám phá tab "Khám phá" để bắt đầu.
            </div>
          ) : (
            <div className="divide-y">
              {stakes.map((s) => (
                <div key={s.stake_id} className="p-4 flex items-center gap-3">
                  <Link to={`/org/${s.validator_slug || s.did_id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:text-primary">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center overflow-hidden shrink-0">
                      {s.validator_logo ? (
                        <img src={s.validator_logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShieldCheck className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.validator_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.status === "active"
                          ? `Khoá ${formatDistanceToNow(new Date(s.locked_until), { addSuffix: true })}`
                          : s.status === "unstaking"
                          ? "Đang rút (24h)"
                          : s.status}
                      </div>
                    </div>
                  </Link>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold flex items-center gap-1">
                      <Coins className="h-3 w-3 text-amber-500" />
                      {Number(s.amount).toLocaleString()}
                    </div>
                    <Badge variant={s.status === "active" ? "default" : "outline"} className="text-[10px] mt-1">
                      {s.status}
                    </Badge>
                  </div>
                  {s.is_unlockable && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unstake.mutate(s.stake_id, {
                        onSuccess: (r: any) => r?.success
                          ? toast.success("Đã yêu cầu unstake")
                          : toast.error(r?.error || "Lỗi"),
                      })}
                      disabled={unstake.isPending}
                    >
                      Unstake
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SumCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">{icon}{label}</div>
        <div className="text-lg font-bold">
          {value}{suffix && <span className="text-xs font-normal text-muted-foreground ml-1">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
