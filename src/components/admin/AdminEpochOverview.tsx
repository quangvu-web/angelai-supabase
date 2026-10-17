import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, Users, Sun, TrendingUp, Clock, Sparkles, RefreshCw, Loader2, Search, RotateCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AntiWhaleCapPanel } from "./AntiWhaleCapPanel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { createRealtimeChannelId } from "@/lib/realtime";

interface CycleData {
  id: string;
  cycle_number: number;
  start_date: string;
  end_date: string;
  total_mint_pool: number;
  total_light_contribution: number;
  status: string;
  max_share_per_user?: number;
}

interface TopAllocation {
  user_id: string;
  display_name: string | null;
  user_light_contribution: number;
  allocation_ratio: number;
  fun_allocated: number;
}

const QUERY_PAGE_SIZE = 1000;

async function fetchAllAllocationsForCycle(cycleId: string) {
  const allocations: any[] = [];
  let from = 0;

  while (true) {
    const to = from + QUERY_PAGE_SIZE - 1;
    const { data, error } = await (supabase as any)
      .from("pplp_mint_allocations")
      .select("user_id, user_light_contribution, allocation_ratio, fun_allocated")
      .eq("cycle_id", cycleId)
      .order("fun_allocated", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const batch = data || [];
    allocations.push(...batch);

    if (batch.length < QUERY_PAGE_SIZE) break;
    from += QUERY_PAGE_SIZE;
  }

  return allocations;
}

async function sumCommunityLightInRange(startDate: string, endDate: string) {
  let from = 0;
  let total = 0;

  while (true) {
    const to = from + QUERY_PAGE_SIZE - 1;
    const { data, error } = await (supabase as any)
      .from("features_user_day")
      .select("daily_light_score")
      .gte("date", startDate)
      .lte("date", endDate)
      .range(from, to);

    if (error) throw error;

    const batch = data || [];
    total += batch.reduce((sum: number, r: any) => sum + (r.daily_light_score || 0), 0);

    if (batch.length < QUERY_PAGE_SIZE) break;
    from += QUERY_PAGE_SIZE;
  }

  return total;
}

export function AdminEpochOverview() {
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [isReloading, setIsReloading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all cycles for dropdown
  const { data: allCycles, isLoading: cyclesLoading } = useQuery({
    queryKey: ["admin-epoch-all-cycles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pplp_mint_cycles")
        .select("*")
        .order("cycle_number", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as CycleData[];
    },
  });

  // Auto-select latest cycle when data loads
  useEffect(() => {
    if (allCycles && allCycles.length > 0 && !selectedCycleId) {
      setSelectedCycleId(allCycles[0].id);
    }
  }, [allCycles, selectedCycleId]);

  const cycle = allCycles?.find((c) => c.id === selectedCycleId) || null;
  const cycleLoading = cyclesLoading;

  const { data: eligibleCount } = useQuery({
    queryKey: ["admin-epoch-eligible-count", cycle?.id],
    queryFn: async () => {
      if (!cycle) return 0;
      const { count, error } = await (supabase as any)
        .from("pplp_mint_allocations")
        .select("*", { count: "exact", head: true })
        .eq("cycle_id", cycle.id);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!cycle?.id,
  });

  const { data: allocations } = useQuery({
    queryKey: ["admin-epoch-top-allocations", cycle?.id],
    queryFn: async () => {
      if (!cycle) return [];

      const data = await fetchAllAllocationsForCycle(cycle.id);

      const userIds = Array.from(new Set((data || []).map((d: any) => d.user_id)));
      if (userIds.length === 0) return [] as TopAllocation[];

      const profiles: { user_id: string; display_name: string | null }[] = [];
      let from = 0;

      while (true) {
        const to = from + QUERY_PAGE_SIZE - 1;
        const idsBatch = userIds.slice(from, to + 1);
        if (idsBatch.length === 0) break;

        const { data: profileBatch, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", idsBatch);

        if (profileError) throw profileError;
        profiles.push(...(profileBatch || []));

        if (idsBatch.length < QUERY_PAGE_SIZE) break;
        from += QUERY_PAGE_SIZE;
      }

      return (data || []).map((a: any) => ({
        ...a,
        display_name: profiles.find((p) => p.user_id === a.user_id)?.display_name || null,
      })) as TopAllocation[];
    },
    enabled: !!cycle?.id,
  });

  // Community light from features_user_day for current month
  const { data: communityLight } = useQuery({
    queryKey: ["admin-community-light", cycle?.start_date, cycle?.end_date],
    queryFn: async () => {
      if (!cycle) return 0;
      return sumCommunityLightInRange(cycle.start_date, cycle.end_date);
    },
    enabled: !!cycle,
  });

  useEffect(() => {
    const refreshEpochData = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-epoch-all-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-epoch-eligible-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-epoch-top-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-community-light"] });
    };

    const channel = supabase
      .channel(createRealtimeChannelId(`admin-epoch-overview-live-${cycle?.id ?? "global"}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pplp_mint_cycles" },
        refreshEpochData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pplp_mint_allocations" },
        refreshEpochData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "features_user_day" },
        refreshEpochData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        refreshEpochData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, cycle?.id]);

  const handleReloadData = async () => {
    setIsReloading(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-epoch-all-cycles"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-epoch-eligible-count", cycle?.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-epoch-top-allocations", cycle?.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-community-light", cycle?.start_date, cycle?.end_date] }),
      ]);
      toast.success("Đã reload dữ liệu Epoch thành công!");
    } catch (err: any) {
      toast.error("Reload thất bại: " + (err.message || "Unknown"));
    } finally {
      setIsReloading(false);
    }
  };

  const handleReprocessEpoch = async () => {
    if (!cycle) return;
    setIsReprocessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Chưa đăng nhập"); return; }

      const res = await supabase.functions.invoke("pplp-reprocess-epoch", {
        body: { cycle_id: cycle.id },
      });

      if (res.error) throw res.error;
      const result = res.data;
      if (result?.error) throw new Error(result.error);

      toast.success(
        `Reprocess thành công! ${result.allocation_result?.eligible_users || 0} eligible, ${result.allocation_result?.mint_requests_created || 0} mint requests tạo mới.`
      );
      queryClient.invalidateQueries({ queryKey: ["admin-epoch-all-cycles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-epoch-eligible-count"] });
      queryClient.invalidateQueries({ queryKey: ["admin-epoch-top-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-community-light"] });
    } catch (err: any) {
      toast.error(`Reprocess thất bại: ${err.message || "Unknown error"}`);
    } finally {
      setIsReprocessing(false);
    }
  };

  const daysRemaining = cycle
    ? Math.max(0, Math.ceil((new Date(cycle.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const totalDays = cycle
    ? Math.ceil((new Date(cycle.end_date).getTime() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24))
    : 30;

  if (cycleLoading) return <Skeleton className="h-64 w-full rounded-xl" />;

  if (!cycle) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Chưa có chu kỳ Epoch nào đang mở.
        </CardContent>
      </Card>
    );
  }

  const elapsed = totalDays - daysRemaining;
  const progressPercent = Math.max(5, Math.min(100, (elapsed / totalDays) * 100));
  const epochMonth = new Date(cycle.start_date).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          Epoch Overview
          {allCycles && allCycles.length > 0 && (
            <Select value={selectedCycleId || ""} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="Chọn Cycle..." />
              </SelectTrigger>
              <SelectContent>
                {allCycles.map((c) => {
                  const month = new Date(c.start_date).toLocaleDateString("vi-VN", { month: "short", year: "numeric" });
                  return (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      Cycle #{c.cycle_number} — {month} ({c.status})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  disabled={isReloading}
                >
                  {isReloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                  Reload
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Xác nhận Reload</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bạn có chắc muốn reload lại dữ liệu Epoch Overview không? Thao tác này sẽ tải lại toàn bộ dữ liệu cho Cycle đã chọn.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReloadData}>Reload</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleReprocessEpoch}
              disabled={isReprocessing || !cycle}
            >
              {isReprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reprocess Epoch
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Ngày {elapsed}/{totalDays}
            </span>
            <span className="font-mono">{daysRemaining} ngày còn lại</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Coins className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-[10px] text-muted-foreground uppercase">Mint Pool</span>
            </div>
            <p className="font-bold text-lg">{(cycle.total_mint_pool || 0).toLocaleString()}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] text-muted-foreground uppercase">Tổng Light</span>
            </div>
            <p className="font-bold text-lg">{(communityLight || 0).toLocaleString()}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[10px] text-muted-foreground uppercase">Eligible</span>
            </div>
            <p className="font-bold text-lg">{eligibleCount || 0}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[10px] text-muted-foreground uppercase">Trạng thái</span>
            </div>
            <Badge className="mt-0.5 bg-green-500/10 text-green-700 text-xs">{cycle.status}</Badge>
          </div>
        </div>

        {/* Anti-Whale Cap 3% Verification */}
        <AntiWhaleCapPanel
          totalMintPool={Number(cycle.total_mint_pool || 0)}
          configuredCapRatio={Number((cycle as any).max_share_per_user ?? 0.03)}
        />

        {/* Full allocations table with search */}
        {allocations && allocations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tất cả Allocations (Realtime) — {allocations.length} users
              </h4>
              <div className="relative w-48">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 h-8 text-xs"
                />
              </div>
            </div>
            <div className="rounded-lg border border-border/50 overflow-hidden max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-8">User</TableHead>
                    <TableHead className="text-xs h-8 text-right">Light</TableHead>
                    <TableHead className="text-xs h-8 text-right">Ratio</TableHead>
                    <TableHead className="text-xs h-8 text-right">FUN</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations
                    .filter((a) => {
                      const query = searchQuery.toLowerCase();
                      const name = (a.display_name || "").toLowerCase();
                      const id = a.user_id.toLowerCase();
                      return name.includes(query) || id.includes(query);
                    })
                    .map((a) => (
                      <TableRow key={a.user_id}>
                        <TableCell className="text-xs py-2">
                          {a.display_name || a.user_id.substring(0, 8) + "…"}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right font-mono">
                          {a.user_light_contribution.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right font-mono">
                          {(a.allocation_ratio * 100).toFixed(2)}%
                          {a.allocation_ratio >= 0.03 && (
                            <span className="text-amber-600 ml-1">(cap)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs py-2 text-right font-mono font-medium text-amber-700">
                          {a.fun_allocated.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
