import { useAuth } from "@/hooks/useAuth";
import { usePPLPActions } from "@/hooks/usePPLPActions";
import { useEpochPreview } from "@/hooks/useEpochPreview";
import { MonthlyActionsGroup } from "./MonthlyActionsGroup";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Sparkles, Inbox, Coins, Filter, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

type EngineFilter = "all" | "v2.5" | "v2.0" | "v1.0" | "unknown";
type DecisionFilter = "all" | "pass" | "fail";

export function MintActionsList() {
  const { user } = useAuth();
  const { actions, isLoading, fetchActions } = usePPLPActions();
  const { preview } = useEpochPreview();
  const [engineFilter, setEngineFilter] = useState<EngineFilter>("all");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("all");

  useEffect(() => {
    if (user) {
      fetchActions();
    }
  }, [user, fetchActions]);

  const resolveScore = (a: any) => {
    const s = a?.pplp_scores;
    if (!s) return null;
    return Array.isArray(s) ? s[0] : s;
  };

  // Apply filters BEFORE grouping
  const filteredActions = useMemo(() => {
    if (!actions) return [];
    return actions.filter((a: any) => {
      const score = resolveScore(a);
      const ver = score?.scoring_engine_version || "unknown";
      if (engineFilter !== "all" && ver !== engineFilter) return false;
      if (decisionFilter !== "all") {
        const isPass = (a.status === "scored" && score?.decision === "pass") || a.status === "minted";
        const isFail = (a.status === "scored" && score?.decision !== "pass") || a.status === "failed" || a.status === "rejected";
        if (decisionFilter === "pass" && !isPass) return false;
        if (decisionFilter === "fail" && !isFail) return false;
      }
      return true;
    });
  }, [actions, engineFilter, decisionFilter]);

  // Group filtered actions by month
  const monthlyGroups = useMemo(() => {
    if (!filteredActions || filteredActions.length === 0) return [];

    const groups: Record<string, { label: string; sortKey: string; actions: any[] }> = {};

    for (const action of filteredActions) {
      const date = new Date(action.created_at);
      const sortKey = format(date, "yyyy-MM");
      const label = format(date, "MMMM yyyy", { locale: vi });
      // Capitalize first letter
      const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

      if (!groups[sortKey]) {
        groups[sortKey] = { label: capitalizedLabel, sortKey, actions: [] };
      }
      groups[sortKey].actions.push(action);
    }

    // Sort by month desc, actions within each month by date desc
    return Object.values(groups)
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
      .map((g) => ({
        ...g,
        actions: g.actions.sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }));
  }, [filteredActions]);

  const currentMonthKey = format(new Date(), "yyyy-MM");

  // Stats reflect FILTERED set so user sees the filtered totals
  const totalActions = filteredActions?.length || 0;
  const passedCount = filteredActions?.filter((a: any) => {
    const score = resolveScore(a);
    return (a.status === "scored" && score?.decision === "pass") || a.status === "minted";
  }).length || 0;
  const failedCount = filteredActions?.filter((a: any) => {
    const score = resolveScore(a);
    return (a.status === "scored" && score?.decision !== "pass") || a.status === "failed" || a.status === "rejected";
  }).length || 0;
  const totalLightScore = filteredActions?.reduce((sum: number, a: any) => {
    const score = resolveScore(a);
    return sum + (score?.light_score || 0);
  }, 0) || 0;

  // Engine version distribution (over UNFILTERED data) for chips
  const engineCounts = useMemo(() => {
    const counts: Record<string, number> = { "v2.5": 0, "v2.0": 0, "v1.0": 0, unknown: 0 };
    for (const a of actions || []) {
      const score = resolveScore(a);
      const ver = score?.scoring_engine_version || "unknown";
      counts[ver] = (counts[ver] || 0) + 1;
    }
    return counts;
  }, [actions]);

  const hasActiveFilter = engineFilter !== "all" || decisionFilter !== "all";

  if (!user) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Vui lòng đăng nhập để xem Light Actions
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Inbox className="h-8 w-8 text-amber-600" />
        </div>
        <div>
          <h3 className="font-medium">Chưa có Light Action nào</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Thực hiện các hành động yêu thương (chat, đăng bài, viết nhật ký) để tích lũy Light Actions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Epoch info banner - compact */}
      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 flex items-center gap-2 text-xs">
        <Coins className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-muted-foreground">
          💡 Mô hình Epoch — FUN được phân bổ cuối mỗi tháng dựa trên Light Score
          {preview && preview.is_eligible && preview.estimated_allocation > 0 && (
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {" "}· Dự kiến: ~{preview.estimated_allocation.toLocaleString()} FUN
            </span>
          )}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border bg-card p-2 text-center">
          <p className="text-lg font-bold">{totalActions}</p>
          <p className="text-[10px] text-muted-foreground">Tổng{hasActiveFilter ? " (lọc)" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-2 text-center">
          <p className="text-lg font-bold text-green-600">{passedCount}</p>
          <p className="text-[10px] text-muted-foreground">Đạt</p>
        </div>
        <div className="rounded-lg border bg-card p-2 text-center">
          <p className="text-lg font-bold text-red-500">{failedCount}</p>
          <p className="text-[10px] text-muted-foreground">Chưa đạt</p>
        </div>
        <div className="rounded-lg border bg-card p-2 text-center">
          <p className="text-lg font-bold text-amber-600">{Math.round(totalLightScore).toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Light Score</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Filter className="h-3.5 w-3.5" />
          <span>Lọc:</span>
        </div>

        <Select value={engineFilter} onValueChange={(v) => setEngineFilter(v as EngineFilter)}>
          <SelectTrigger className="h-8 w-auto min-w-[170px] text-xs">
            <SelectValue placeholder="Scoring Engine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả engine ({actions.length})</SelectItem>
            <SelectItem value="v2.5">v2.5 (T≥30 · LS≥15) ({engineCounts["v2.5"] || 0})</SelectItem>
            <SelectItem value="v2.0">v2.0 (legacy) ({engineCounts["v2.0"] || 0})</SelectItem>
            <SelectItem value="v1.0">v1.0 (legacy) ({engineCounts["v1.0"] || 0})</SelectItem>
            <SelectItem value="unknown">Chưa xác định ({engineCounts["unknown"] || 0})</SelectItem>
          </SelectContent>
        </Select>

        <Select value={decisionFilter} onValueChange={(v) => setDecisionFilter(v as DecisionFilter)}>
          <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="pass">✅ Pass / Minted</SelectItem>
            <SelectItem value="fail">❌ Fail / Rejected</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <>
            <Badge variant="secondary" className="h-6 text-[10px]">
              {filteredActions.length}/{actions.length} actions
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setEngineFilter("all");
                setDecisionFilter("all");
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Xoá lọc
            </Button>
          </>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-sm">Light Actions theo tháng</h3>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fetchActions()}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Làm mới
        </Button>
      </div>

      {/* Empty state when filter returns 0 */}
      {filteredActions.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg bg-card">
          Không có action nào khớp với bộ lọc hiện tại.
        </div>
      )}

      {/* Monthly groups */}
      <div className="space-y-3">
        {monthlyGroups.map((group) => (
          <MonthlyActionsGroup
            key={group.sortKey}
            monthLabel={group.label}
            actions={group.actions}
            defaultOpen={group.sortKey === currentMonthKey}
          />
        ))}
      </div>
    </div>
  );
}
