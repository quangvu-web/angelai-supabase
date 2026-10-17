import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { History, Coins, Sun, CheckCircle2, Clock, XCircle } from "lucide-react";

interface EpochRow {
  epoch_label: string;
  light_score: number;
  contribution_ratio: number;
  allocation_amount: number;
  mint_pool: number;
  status: string;
  eligible: boolean;
  onchain_tx_hash: string | null;
  onchain_count: number;
  onchain_total: number;
  period_start: string;
  period_end: string;
}

function statusBadge(row: EpochRow) {
  if (!row.eligible) {
    return (
      <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px] gap-1">
        <XCircle className="h-3 w-3" /> Không đủ ĐK
      </Badge>
    );
  }
  if (row.onchain_tx_hash) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 cursor-help">
            <CheckCircle2 className="h-3 w-3" /> On-chain
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">{row.onchain_count} request đã mint</p>
          <p className="text-muted-foreground">{row.onchain_total.toLocaleString()} FUN on-chain</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  if (row.status === "finalized" || row.allocation_amount > 0) {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1">
        <Coins className="h-3 w-3" /> Đã phân bổ
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
      <Clock className="h-3 w-3" /> Đang tích lũy
    </Badge>
  );
}

function formatMonth(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", { month: "short", year: "numeric" });
}

export function EpochAllocationHistory() {
  const { user } = useAuth();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["epoch-allocation-history", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch from all sources and merge
      const [pplpRes, mintRes, reqRes] = await Promise.all([
        (supabase as any)
          .from("pplp_mint_allocations")
          .select("cycle_id, user_light_contribution, allocation_ratio, fun_allocated, status, eligible, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("mint_allocations")
          .select("epoch_id, light_score, contribution_ratio, allocation_amount, eligible, onchain_tx_hash, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        // Get mint requests to show actual claimable amounts
        supabase
          .from("pplp_mint_requests")
          .select("amount, status, tx_hash, created_at")
          .eq("actor_id", user.id)
          .in("status", ["pending_sig", "signed", "pending", "approved", "minted", "confirmed"])
          .order("amount", { ascending: false }),
      ]);

      const allMintReqs = (reqRes.data || []) as any[];

      // Total active (not yet minted) mint request amount
      const activeReqTotal = allMintReqs
        .filter((r: any) => !r.tx_hash && r.status !== "minted" && r.status !== "confirmed")
        .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

      // Helper: check if a cycle period has on-chain minted requests
      const hasMintedInPeriod = (start: string, end: string) => {
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        return allMintReqs.some((r: any) => {
          if (!r.tx_hash && r.status !== "minted" && r.status !== "confirmed") return false;
          const t = new Date(r.created_at).getTime();
          return t >= s && t <= e;
        });
      };

      // Helper: get count and total of on-chain minted requests in a period
      const mintStatsInPeriod = (start: string, end: string) => {
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        const matched = allMintReqs.filter((r: any) => {
          if (!r.tx_hash && r.status !== "minted" && r.status !== "confirmed") return false;
          const t = new Date(r.created_at).getTime();
          return t >= s && t <= e;
        });
        return {
          count: matched.length,
          total: matched.reduce((sum: number, r: any) => sum + (r.amount || 0), 0),
        };
      };

      // Get cycles and epochs for labels
      const [cyclesRes, epochsRes] = await Promise.all([
        (supabase as any)
          .from("pplp_mint_cycles")
          .select("id, cycle_number, start_date, end_date, total_mint_pool, status")
          .order("cycle_number", { ascending: false }),
        (supabase as any)
          .from("mint_epochs")
          .select("id, epoch_label, period_start, period_end, mint_pool_amount, status")
          .order("period_start", { ascending: false }),
      ]);

      const cycles = (cyclesRes.data || []) as any[];
      const epochs = (epochsRes.data || []) as any[];
      const result: EpochRow[] = [];
      const seenLabels = new Set<string>();

      // Process mint_allocations (newer system)
      for (const ma of (mintRes.data || [])) {
        const epoch = epochs.find((e: any) => e.id === ma.epoch_id);
        const label = epoch?.epoch_label || "Unknown";
        if (seenLabels.has(label)) continue;
        seenLabels.add(label);
        const ps = epoch?.period_start || ma.created_at;
        const pe = epoch?.period_end || ma.created_at;
        const ms = mintStatsInPeriod(ps, pe);
        result.push({
          epoch_label: label,
          light_score: ma.light_score || 0,
          contribution_ratio: ma.contribution_ratio || 0,
          allocation_amount: ma.allocation_amount || 0,
          mint_pool: epoch?.mint_pool_amount || 0,
          status: epoch?.status || "unknown",
          eligible: ma.eligible ?? true,
          onchain_tx_hash: ma.onchain_tx_hash,
          onchain_count: ms.count,
          onchain_total: ms.total,
          period_start: ps,
          period_end: pe,
        });
      }

      // Process pplp_mint_allocations - check on-chain per cycle
      let isFirstPplp = true;
      for (const pa of (pplpRes.data || [])) {
        const cycle = cycles.find((c: any) => c.id === pa.cycle_id);
        const label = cycle
          ? `${new Date(cycle.start_date).getFullYear()}-${String(new Date(cycle.start_date).getMonth() + 1).padStart(2, "0")}`
          : "Unknown";
        if (seenLabels.has(label)) continue;
        seenLabels.add(label);

        // For the most recent allocation, use active (unminted) request total
        const displayAmount = (isFirstPplp && activeReqTotal > 0)
          ? activeReqTotal + allMintReqs
              .filter((r: any) => (r.tx_hash || r.status === "minted" || r.status === "confirmed"))
              .reduce((s: number, r: any) => s + (r.amount || 0), 0)
          : (pa.fun_allocated || 0);

        // Check if THIS cycle has on-chain minted requests
        const cycleStart = cycle?.start_date || pa.created_at;
        const cycleEnd = cycle?.end_date || pa.created_at;
        const onchainInCycle = hasMintedInPeriod(cycleStart, cycleEnd);
        const cycleStats = mintStatsInPeriod(cycleStart, cycleEnd);

        result.push({
          epoch_label: label,
          light_score: pa.user_light_contribution || 0,
          contribution_ratio: pa.allocation_ratio || 0,
          allocation_amount: displayAmount,
          mint_pool: cycle?.total_mint_pool || 0,
          status: cycle?.status || pa.status || "unknown",
          eligible: pa.eligible ?? true,
          onchain_tx_hash: onchainInCycle ? "yes" : null,
          onchain_count: cycleStats.count,
          onchain_total: cycleStats.total,
          period_start: cycleStart,
          period_end: cycleEnd,
        });
        isFirstPplp = false;
      }

      // Sort by period descending
      result.sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime());
      return result;
    },
    enabled: !!user?.id,
  });

  if (!user) return null;

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!rows || rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Chưa có dữ liệu phân bổ FUN Money nào. Hãy tích lũy Light Score trong chu kỳ hiện tại!
        </CardContent>
      </Card>
    );
  }

  const totalFun = rows.reduce((s, r) => s + (r.eligible ? r.allocation_amount : 0), 0);

  return (
    <Card id="epoch-allocation-history">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Lịch sử phân bổ FUN theo Epoch
          <Badge variant="secondary" className="ml-auto text-xs font-mono">
            Tổng: {totalFun.toLocaleString()} FUN
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs h-9">Chu kỳ</TableHead>
                <TableHead className="text-xs h-9 text-right">
                  <span className="inline-flex items-center gap-1"><Sun className="h-3 w-3" /> Light</span>
                </TableHead>
                <TableHead className="text-xs h-9 text-right hidden sm:table-cell">Tỷ lệ</TableHead>
                <TableHead className="text-xs h-9 text-right">
                  <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" /> FUN</span>
                </TableHead>
                <TableHead className="text-xs h-9 text-center">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.epoch_label}>
                  <TableCell className="text-xs py-2.5 font-medium">
                    {formatMonth(row.period_start)}
                    <span className="block text-[10px] text-muted-foreground font-mono">{row.epoch_label}</span>
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-right font-mono">
                    {row.light_score.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-right font-mono hidden sm:table-cell">
                    {(row.contribution_ratio * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-right font-mono font-semibold text-amber-700 dark:text-amber-400">
                    {row.eligible ? row.allocation_amount.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-center">
                    {statusBadge(row)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
