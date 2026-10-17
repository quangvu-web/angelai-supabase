import { useState } from "react";
import { ChevronDown, Calendar, Coins, ChevronsDown } from "lucide-react";
import { MintActionRow } from "./MintActionRow";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

interface PPLPAction {
  id: string;
  action_type: string;
  platform_id: string;
  status: string;
  created_at: string;
  minted_at?: string;
  mint_request_hash?: string | null;
  pplp_scores?: any;
  pplp_mint_requests?: any;
}

function resolveOne<T>(data: T | T[] | undefined | null): T | undefined {
  if (!data) return undefined;
  return Array.isArray(data) ? data[0] : data;
}

interface Props {
  monthLabel: string;
  actions: PPLPAction[];
  defaultOpen?: boolean;
}

export function MonthlyActionsGroup({ monthLabel, actions, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const totalReward = actions.reduce((sum, a) => {
    const s = resolveOne(a.pplp_scores);
    return sum + (s?.final_reward || 0);
  }, 0);

  const passedCount = actions.filter((a) => {
    const s = resolveOne(a.pplp_scores);
    return (a.status === "scored" && s?.decision === "pass") || a.status === "minted";
  }).length;
  const failedCount = actions.filter((a) => {
    const s = resolveOne(a.pplp_scores);
    return (a.status === "scored" && s?.decision !== "pass") || a.status === "failed";
  }).length;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Month header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-amber-600" />
          <span className="font-semibold text-sm">{monthLabel}</span>
          <span className="text-xs text-muted-foreground">
            {actions.length} actions
          </span>
          {passedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {passedCount} đạt
            </span>
          )}
          {failedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {failedCount} chưa đạt
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalReward > 0 && (
            <div className="flex items-center gap-1 text-amber-600">
              <Coins className="h-3.5 w-3.5" />
              <span className="text-sm font-semibold">+{totalReward.toLocaleString()}</span>
            </div>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Action rows */}
      {open && (
        <div className="border-t">
          {/* Table header - desktop only */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider bg-muted/30 border-b">
            <span className="w-10">Ngày</span>
            <span className="w-24">Loại</span>
            <span className="w-16">Score</span>
            <span className="w-16 text-center">S T H C U</span>
            <span className="w-16 text-right">Reward</span>
            <span className="ml-1">Trạng thái</span>
          </div>
          {actions.slice(0, visibleCount).map((action) => (
            <MintActionRow key={action.id} action={action} />
          ))}
          {visibleCount < actions.length && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Hiển thị {visibleCount}/{actions.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  <ChevronsDown className="h-3 w-3 mr-1" />
                  Xem thêm {Math.min(PAGE_SIZE, actions.length - visibleCount)}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setVisibleCount(actions.length)}
                >
                  Tất cả ({actions.length})
                </Button>
              </div>
            </div>
          )}
          {visibleCount > PAGE_SIZE && visibleCount >= actions.length && (
            <div className="flex justify-end px-3 py-2 border-t bg-muted/20">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setVisibleCount(PAGE_SIZE)}
              >
                Thu gọn
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
