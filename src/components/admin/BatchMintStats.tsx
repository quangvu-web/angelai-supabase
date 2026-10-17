import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  TrendingUp,
  Activity,
  Timer,
  Layers,
  Filter,
} from "lucide-react";
import { format, subDays, startOfDay, differenceInMinutes } from "date-fns";
import { vi } from "date-fns/locale";

type GroupFilter = "all" | "epoch_only" | "action_only" | "will" | "wisdom" | "love";

const VALID_FILTERS: GroupFilter[] = ["all", "epoch_only", "action_only", "will", "wisdom", "love"];
const STORAGE_KEY = "batch-mint-stats:group-filter";
const URL_PARAM = "msg"; // multisig group
const STATS_ROW_LIMIT = 2000;

function readInitialFilter(): GroupFilter {
  if (typeof window === "undefined") return "all";
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get(URL_PARAM);
    if (fromUrl && VALID_FILTERS.includes(fromUrl as GroupFilter)) {
      return fromUrl as GroupFilter;
    }
    const fromLs = window.localStorage.getItem(STORAGE_KEY);
    if (fromLs && VALID_FILTERS.includes(fromLs as GroupFilter)) {
      return fromLs as GroupFilter;
    }
  } catch {}
  return "all";
}

interface MintRow {
  id: string;
  status: string;
  amount: number | null;
  amount_wei: string | null;
  created_at: string;
  minted_at: string | null;
  multisig_required_groups: string[] | null;
}

const FINAL_OK = new Set(["minted", "confirmed"]);
const FINAL_FAIL = new Set(["failed", "rejected", "expired"]);
const PENDING = new Set(["pending", "pending_sig", "signing", "signed", "submitted"]);

function fmtNum(n: number) {
  return n.toLocaleString("vi-VN");
}
function fmtFun(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return fmtNum(Math.round(n));
}

export function BatchMintStats() {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(() => readInitialFilter());

  // Persist filter to localStorage + URL (?msg=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, groupFilter);
      const url = new URL(window.location.href);
      if (groupFilter === "all") {
        url.searchParams.delete(URL_PARAM);
      } else {
        url.searchParams.set(URL_PARAM, groupFilter);
      }
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, [groupFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["batch-mint-stats-30d"],
    queryFn: async (): Promise<MintRow[]> => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from("pplp_mint_requests")
        .select(
          "id,status,amount,amount_wei,created_at,minted_at,multisig_required_groups"
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .range(0, STATS_ROW_LIMIT - 1);
      if (error) throw error;
      return (data || []) as MintRow[];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const filteredRows = useMemo(() => {
    const rows = data || [];
    if (groupFilter === "all") return rows;
    return rows.filter((r) => {
      const groups = (r.multisig_required_groups || []).map((g) =>
        String(g).toLowerCase()
      );
      const isEpoch = groups.length > 0;
      if (groupFilter === "epoch_only") return isEpoch;
      if (groupFilter === "action_only") return !isEpoch;
      // specific group: will / wisdom / love
      return groups.includes(groupFilter);
    });
  }, [data, groupFilter]);

  const stats = useMemo(() => {
    const rows = filteredRows;
    const now = new Date();
    const startToday = startOfDay(now);
    const start7d = subDays(startToday, 6);
    const start30d = subDays(startToday, 29);

    let funToday = 0,
      fun7d = 0,
      fun30d = 0;
    let okToday = 0,
      failToday = 0,
      ok7d = 0,
      fail7d = 0,
      ok30d = 0,
      fail30d = 0;
    let pendingSig = 0,
      signed = 0,
      submitted = 0,
      failedNow = 0;
    let totalProcMin = 0,
      procCount = 0;
    let totalFunOk = 0,
      totalCountOk = 0;
    let epochClaims = 0,
      validatedActions = 0;

    // Heatmap: 7 days × 24 hours, indexed by [dayIdx][hour]
    // dayIdx 0 = 6 days ago, 6 = today
    const heatOk: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0)
    );
    const heatFail: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0)
    );
    const heatFun: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0)
    );

    for (const r of rows) {
      const created = new Date(r.created_at);
      const minted = r.minted_at ? new Date(r.minted_at) : null;
      const amt = Number(r.amount || 0);
      const isOk = FINAL_OK.has(r.status);
      const isFail = FINAL_FAIL.has(r.status);
      const isEpoch =
        Array.isArray(r.multisig_required_groups) &&
        r.multisig_required_groups.length > 0;

      if (isEpoch) epochClaims++;
      else validatedActions++;

      // Snapshot pending state (real-time)
      if (r.status === "pending_sig" || r.status === "pending") pendingSig++;
      else if (r.status === "signed" || r.status === "signing") signed++;
      else if (r.status === "submitted") submitted++;
      else if (r.status === "failed") failedNow++;

      // Use minted_at when finalized (ok), else created_at for fail bucket
      const eventTime = minted || created;
      if (eventTime >= start30d) {
        if (isOk) {
          fun30d += amt;
          ok30d++;
          totalFunOk += amt;
          totalCountOk++;
          if (minted) {
            totalProcMin += differenceInMinutes(minted, created);
            procCount++;
          }
        } else if (isFail) {
          fail30d++;
        }
      }
      if (eventTime >= start7d) {
        if (isOk) {
          fun7d += amt;
          ok7d++;
        } else if (isFail) fail7d++;
      }
      if (eventTime >= startToday) {
        if (isOk) {
          funToday += amt;
          okToday++;
        } else if (isFail) failToday++;
      }

      // Heatmap (last 7 days, by minted_at OR created_at fallback)
      if (eventTime >= start7d && eventTime <= now) {
        const dayIdx =
          6 -
          Math.floor(
            (startToday.getTime() - startOfDay(eventTime).getTime()) /
              (24 * 60 * 60 * 1000)
          );
        const hour = eventTime.getHours();
        if (dayIdx >= 0 && dayIdx < 7) {
          if (isOk) {
            heatOk[dayIdx][hour]++;
            heatFun[dayIdx][hour] += amt;
          } else if (isFail) {
            heatFail[dayIdx][hour]++;
          }
        }
      }
    }

    const totalToday = okToday + failToday;
    const total7d = ok7d + fail7d;
    const total30d = ok30d + fail30d;

    return {
      funToday,
      fun7d,
      fun30d,
      okToday,
      failToday,
      ok7d,
      fail7d,
      ok30d,
      fail30d,
      successRateToday: totalToday ? (okToday / totalToday) * 100 : 0,
      successRate7d: total7d ? (ok7d / total7d) * 100 : 0,
      successRate30d: total30d ? (ok30d / total30d) * 100 : 0,
      pendingSig,
      signed,
      submitted,
      failedNow,
      avgFun: totalCountOk ? totalFunOk / totalCountOk : 0,
      avgProcMin: procCount ? totalProcMin / procCount : 0,
      epochClaims,
      validatedActions,
      heatOk,
      heatFail,
      heatFun,
    };
  }, [filteredRows]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Lọc theo nhóm multisig:
          </div>
          <ToggleGroup
            type="single"
            size="sm"
            value={groupFilter}
            onValueChange={(v) => v && setGroupFilter(v as GroupFilter)}
            className="flex-wrap justify-start"
          >
            <ToggleGroupItem value="all">Tất cả</ToggleGroupItem>
            <ToggleGroupItem value="epoch_only">⚡ Epoch only</ToggleGroupItem>
            <ToggleGroupItem value="action_only">🎯 Action only</ToggleGroupItem>
            <ToggleGroupItem value="will">💪 WILL</ToggleGroupItem>
            <ToggleGroupItem value="wisdom">🧠 WISDOM</ToggleGroupItem>
            <ToggleGroupItem value="love">❤️ LOVE</ToggleGroupItem>
          </ToggleGroup>
          <Badge variant="outline" className="ml-auto font-mono text-[10px]">
            {fmtNum(filteredRows.length)} requests
          </Badge>
        </CardContent>
      </Card>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Coins className="h-4 w-4 text-amber-500" />}
          label="FUN minted hôm nay"
          value={fmtFun(stats.funToday)}
          sub={`${fmtNum(stats.okToday)} TX thành công`}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          label="FUN minted 7 ngày"
          value={fmtFun(stats.fun7d)}
          sub={`${fmtNum(stats.ok7d)} TX`}
        />
        <KpiCard
          icon={<Layers className="h-4 w-4 text-blue-500" />}
          label="FUN minted 30 ngày"
          value={fmtFun(stats.fun30d)}
          sub={`${fmtNum(stats.ok30d)} TX`}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          label="Success rate (30d)"
          value={`${stats.successRate30d.toFixed(1)}%`}
          sub={`Hôm nay: ${stats.successRateToday.toFixed(1)}%`}
        />
      </div>

      {/* Real-time snapshot */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Snapshot trạng thái hiện tại (30
            ngày gần nhất)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SnapItem
              label="Pending sig"
              count={stats.pendingSig}
              color="bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <SnapItem
              label="Signed (chờ batch)"
              count={stats.signed}
              color="bg-blue-500/10 text-blue-700 dark:text-blue-300"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <SnapItem
              label="Submitted"
              count={stats.submitted}
              color="bg-purple-500/10 text-purple-700 dark:text-purple-300"
              icon={<Activity className="h-3.5 w-3.5" />}
            />
            <SnapItem
              label="Failed"
              count={stats.failedNow}
              color="bg-red-500/10 text-red-700 dark:text-red-300"
              icon={<XCircle className="h-3.5 w-3.5" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Avg + breakdown */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Coins className="h-3.5 w-3.5" /> Avg FUN / mint (30d)
            </div>
            <div className="text-xl font-bold">{fmtFun(stats.avgFun)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Timer className="h-3.5 w-3.5" /> Avg processing time
            </div>
            <div className="text-xl font-bold">
              {stats.avgProcMin < 60
                ? `${stats.avgProcMin.toFixed(1)} phút`
                : `${(stats.avgProcMin / 60).toFixed(1)} giờ`}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              created → minted
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Layers className="h-3.5 w-3.5" /> Loại request (30d)
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="font-mono">
                Epoch: {fmtNum(stats.epochClaims)}
              </Badge>
              <Badge variant="outline" className="font-mono">
                Action: {fmtNum(stats.validatedActions)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Heatmap 24h × 7 ngày — TX thành công theo giờ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap matrix={stats.heatOk} funMatrix={stats.heatFun} />
        </CardContent>
      </Card>

      {/* Failure heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            Heatmap thất bại 24h × 7 ngày
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap matrix={stats.heatFail} variant="fail" />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon} {label}
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {sub && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

function SnapItem({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg p-3 ${color}`}>
      <div className="flex items-center gap-1.5 text-xs mb-1">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold">{count.toLocaleString("vi-VN")}</div>
    </div>
  );
}

function Heatmap({
  matrix,
  funMatrix,
  variant = "ok",
}: {
  matrix: number[][];
  funMatrix?: number[][];
  variant?: "ok" | "fail";
}) {
  const max = Math.max(1, ...matrix.flat());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return format(d, "EEE dd/MM", { locale: vi });
  });

  const colorAt = (v: number) => {
    if (v === 0) return "bg-muted/40";
    const intensity = v / max;
    if (variant === "fail") {
      if (intensity > 0.75) return "bg-red-600";
      if (intensity > 0.5) return "bg-red-500";
      if (intensity > 0.25) return "bg-red-400";
      return "bg-red-300";
    }
    if (intensity > 0.75) return "bg-emerald-600";
    if (intensity > 0.5) return "bg-emerald-500";
    if (intensity > 0.25) return "bg-emerald-400";
    return "bg-emerald-300";
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Hour header */}
        <div className="flex items-center gap-1 mb-1 pl-20">
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              className="w-6 text-center text-[9px] text-muted-foreground font-mono"
            >
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {/* Rows */}
        {matrix.map((row, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-1 mb-1">
            <div className="w-20 text-[10px] text-muted-foreground pr-1 truncate">
              {days[dayIdx]}
            </div>
            {row.map((v, h) => {
              const fun = funMatrix?.[dayIdx]?.[h] ?? 0;
              const tip =
                variant === "fail"
                  ? `${days[dayIdx]} ${h}h — ${v} TX thất bại`
                  : `${days[dayIdx]} ${h}h — ${v} TX${
                      fun ? ` · ${fmtFun(fun)} FUN` : ""
                    }`;
              return (
                <div
                  key={h}
                  title={tip}
                  className={`w-6 h-6 rounded-sm ${colorAt(
                    v
                  )} hover:ring-2 hover:ring-primary cursor-pointer transition`}
                />
              );
            })}
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>Ít</span>
          <div className="w-3 h-3 rounded-sm bg-muted/40" />
          <div
            className={`w-3 h-3 rounded-sm ${
              variant === "fail" ? "bg-red-300" : "bg-emerald-300"
            }`}
          />
          <div
            className={`w-3 h-3 rounded-sm ${
              variant === "fail" ? "bg-red-400" : "bg-emerald-400"
            }`}
          />
          <div
            className={`w-3 h-3 rounded-sm ${
              variant === "fail" ? "bg-red-500" : "bg-emerald-500"
            }`}
          />
          <div
            className={`w-3 h-3 rounded-sm ${
              variant === "fail" ? "bg-red-600" : "bg-emerald-600"
            }`}
          />
          <span>Nhiều (max {max})</span>
        </div>
      </div>
    </div>
  );
}
