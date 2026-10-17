import { useMintCycle } from "@/hooks/useMintCycle";
import { useEpochPreview } from "@/hooks/useEpochPreview";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, Coins, Shield, AlertTriangle, Sparkles, Users, Target } from "lucide-react";

export function MintCycleStatus() {
  const { currentCycle, myAllocation, daysRemaining, hoursRemaining, isLoading: cycleLoading } = useMintCycle();
  const { preview, isLoading: previewLoading } = useEpochPreview();
  const { currentLanguage: language } = useLanguage();

  const isLoading = cycleLoading || previewLoading;
  const isVi = language === "vi";

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  // Progress calculation
  const totalDays = currentCycle
    ? Math.ceil((new Date(currentCycle.end_date).getTime() - new Date(currentCycle.start_date).getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  const elapsed = totalDays - daysRemaining;
  const progressPercent = Math.max(5, Math.min(100, (elapsed / totalDays) * 100));

  const eligibilityLabel = (reason: string) => {
    const map: Record<string, { vi: string; en: string; color: string }> = {
      ELIGIBLE: { vi: "Đủ điều kiện", en: "Eligible", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
      SUSPENDED: { vi: "Tài khoản bị đình chỉ", en: "Account suspended", color: "bg-destructive/10 text-destructive" },
      INSUFFICIENT_CONTRIBUTION: { vi: "Light Score < 10", en: "Light Score < 10", color: "bg-yellow-500/10 text-yellow-700" },
      PPLP_NOT_ACCEPTED: { vi: "Chưa chấp nhận PPLP", en: "PPLP not accepted", color: "bg-orange-500/10 text-orange-700" },
      FRAUD_FLAG: { vi: "Đang xem xét gian lận", en: "Fraud review pending", color: "bg-destructive/10 text-destructive" },
      NO_ACTIVE_CYCLE: { vi: "Chưa có chu kỳ", en: "No active cycle", color: "bg-muted text-muted-foreground" },
    };
    const info = map[reason] || { vi: reason, en: reason, color: "bg-muted text-muted-foreground" };
    return { label: isVi ? info.vi : info.en, color: info.color };
  };

  const epochMonth = currentCycle
    ? new Date(currentCycle.start_date).toLocaleDateString(isVi ? "vi-VN" : "en-US", { month: "long", year: "numeric" })
    : "";

  return (
    <Card className="border-0 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-sm">
              {isVi ? "Epoch Mint" : "Epoch Mint"}
              {epochMonth && <span className="text-muted-foreground font-normal ml-1">— {epochMonth}</span>}
            </h3>
          </div>
          {currentCycle && (
            <Badge variant="outline" className="text-xs font-mono">
              #{currentCycle.cycle_number}
            </Badge>
          )}
        </div>

        {currentCycle ? (
          <div className="space-y-3">
            {/* Time remaining + progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {isVi ? "Thời gian còn lại" : "Time remaining"}
                </span>
                <span className="font-mono text-orange-600 font-medium">
                  {daysRemaining > 0
                    ? `${daysRemaining} ${isVi ? "ngày" : "days"}`
                    : `${hoursRemaining}h`}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{isVi ? `Ngày ${elapsed}` : `Day ${elapsed}`}</span>
                <span>{isVi ? `${totalDays} ngày` : `${totalDays} days`}</span>
              </div>
            </div>

            {/* Epoch preview data */}
            {preview && (
              <div className="space-y-2.5 pt-3 border-t border-border/50">
                {/* Eligibility */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {isVi ? "Trạng thái" : "Status"}
                  </span>
                  <Badge className={`text-xs ${eligibilityLabel(preview.ineligibility_reason).color}`}>
                    {eligibilityLabel(preview.ineligibility_reason).label}
                  </Badge>
                </div>

                {/* My Light Score */}
                <div className="bg-background/60 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {isVi ? "Light Score của bạn" : "Your Light Score"}
                    </span>
                    <span className="font-bold text-lg text-foreground">
                      {preview.my_light_score.toLocaleString()}
                    </span>
                  </div>

                  {/* Total community light */}
                  {preview.total_light > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {isVi ? "Tổng Light cộng đồng" : "Community total"}
                      </span>
                      <span className="font-mono">{preview.total_light.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Contribution ratio */}
                  {preview.my_ratio > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        {isVi ? "Tỷ lệ đóng góp" : "Your share"}
                      </span>
                      <span className="font-mono font-medium">
                        {(preview.my_ratio * 100).toFixed(2)}%
                        {preview.my_ratio >= 0.03 && (
                          <span className="text-amber-600 ml-1">(cap 3%)</span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Estimated FUN — highlight */}
                {preview.is_eligible && preview.estimated_allocation > 0 && (
                  <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <Coins className="h-4 w-4 text-amber-600" />
                      {isVi ? "Dự kiến nhận" : "Est. allocation"}
                    </span>
                    <span className="font-bold text-lg text-amber-700 dark:text-amber-400">
                      ~{preview.estimated_allocation.toLocaleString()} FUN
                    </span>
                  </div>
                )}

                {/* Mint pool info */}
                {preview.mint_pool > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{isVi ? "Mint Pool tháng này" : "Monthly Mint Pool"}</span>
                    <span className="font-mono">{preview.mint_pool.toLocaleString()} FUN</span>
                  </div>
                )}

                {/* Warning for ineligible */}
                {!preview.is_eligible && preview.ineligibility_reason !== 'NO_ACTIVE_CYCLE' && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      {isVi
                        ? "Bạn chưa đủ điều kiện nhận FUN trong chu kỳ này. Hãy tiếp tục đóng góp để đạt Light Score ≥ 10."
                        : "You're not yet eligible for FUN this cycle. Keep contributing to reach Light Score ≥ 10."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Philosophy note */}
            <p className="text-xs text-muted-foreground italic pt-1">
              {isVi
                ? "💡 FUN được phân bổ cuối tháng dựa trên tổng Light Score — không thưởng tức thì."
                : "💡 FUN is allocated monthly based on total Light Score — no instant rewards."}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {isVi ? "Chưa có chu kỳ mint nào đang mở." : "No active mint cycle."}
          </p>
        )}

        {/* Last epoch allocation */}
        {myAllocation && (
          <div className="pt-2 border-t border-border/50 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4 text-amber-600" />
              <span className="text-muted-foreground">
                {isVi ? "Phân bổ gần nhất:" : "Latest allocation:"}
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                {myAllocation.fun_allocated.toLocaleString()} FUN
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
