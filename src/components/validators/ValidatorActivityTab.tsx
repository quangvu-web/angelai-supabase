import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useValidatorDetailExtended } from "@/hooks/useValidatorMarketplace";
import { Activity, Coins, Users, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";

export function ValidatorActivityTab({ didId }: { didId: string }) {
  const { data, isLoading } = useValidatorDetailExtended(didId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!data) return null;

  const buckets: { day: string; count: number }[] = data.uptime_buckets || [];
  const totalAtt = buckets.reduce((s, b) => s + b.count, 0);
  const activeDays = buckets.filter((b) => b.count > 0).length;
  const trend7d = buckets.slice(-7).reduce((s, b) => s + b.count, 0);
  const trendPrev7d = buckets.slice(-14, -7).reduce((s, b) => s + b.count, 0);
  const trendDelta = trendPrev7d > 0 ? ((trend7d - trendPrev7d) / trendPrev7d) * 100 : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Beautiful sparkline */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Hoạt động 30 ngày
            </span>
            {trendPrev7d > 0 && (
              <span
                className={`text-xs flex items-center gap-1 font-mono ${
                  trendDelta >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                }`}
              >
                <TrendingUp className={`h-3 w-3 ${trendDelta < 0 ? "rotate-180" : ""}`} />
                {trendDelta >= 0 ? "+" : ""}
                {trendDelta.toFixed(0)}%
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 text-sm">
            <Mini label="Tổng attestation" value={totalAtt} />
            <Mini label="Ngày hoạt động" value={`${activeDays}/30`} />
            <Mini
              label="Reward 30d"
              value={`${Number(data.reward_30d || 0).toLocaleString()} CLY`}
            />
          </div>
          <Sparkline buckets={buckets} />
        </CardContent>
      </Card>

      {/* Top stakers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Top Stakers
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data.top_stakers || []).length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Chưa có staker"
              subtitle="Validator này chưa nhận được stake từ cộng đồng."
            />
          ) : (
            <div className="divide-y">
              {(data.top_stakers || []).map((s: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors animate-fade-in opacity-0"
                  style={{
                    animationDelay: `${idx * 40}ms`,
                    animationFillMode: "forwards",
                  }}
                >
                  <div
                    className={`w-6 text-center text-xs font-bold ${
                      idx === 0
                        ? "text-amber-500"
                        : idx === 1
                        ? "text-muted-foreground"
                        : idx === 2
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    #{idx + 1}
                  </div>
                  {s.avatar_url ? (
                    <img
                      src={s.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {(s.display_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 truncate text-sm">
                    {s.display_name || "Anonymous"}
                  </div>
                  <div className="font-mono font-semibold text-sm flex items-center gap-1">
                    <Coins className="h-3 w-3 text-amber-500" />
                    {Number(s.amount).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent attestations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attestations gần đây</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data.recent_attestations || []).length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="Chưa có attestation"
              subtitle="Validator chưa cấp chứng thực nào trong 30 ngày qua."
            />
          ) : (
            <div className="divide-y">
              {(data.recent_attestations || []).map((a: any) => (
                <div key={a.id} className="p-3 text-sm flex items-center gap-2 hover:bg-muted/40 transition-colors">
                  <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                    → {a.to_did}
                  </span>
                  <span className="text-xs">{a.attestation_type}</span>
                  <span className="text-xs font-mono">×{Number(a.weight).toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-md bg-muted/40 p-2 transition-colors hover:bg-muted/60">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm sm:text-base truncate">{value}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="p-8 text-center space-y-2 flex flex-col items-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted-foreground max-w-xs">{subtitle}</div>
    </div>
  );
}

function Sparkline({ buckets }: { buckets: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  // Build SVG polyline path with smooth curve
  const { path, areaPath, points } = useMemo(() => {
    if (buckets.length === 0) return { path: "", areaPath: "", points: [] };
    const W = 100;
    const H = 40;
    const step = W / Math.max(1, buckets.length - 1);
    const pts = buckets.map((b, i) => ({
      x: i * step,
      y: H - (b.count / maxCount) * H,
      count: b.count,
      day: b.day,
    }));
    let p = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cx = (prev.x + curr.x) / 2;
      p += ` Q ${cx},${prev.y} ${cx},${(prev.y + curr.y) / 2} T ${curr.x},${curr.y}`;
    }
    const area = `${p} L ${W},${H} L 0,${H} Z`;
    return { path: p, areaPath: area, points: pts };
  }, [buckets, maxCount]);

  if (buckets.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-md">
        Không có dữ liệu hoạt động
      </div>
    );
  }

  const hoverPoint = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="w-full h-24"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="sparkArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="sparkLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkArea)" />
        <path
          d={path}
          fill="none"
          stroke="url(#sparkLine)"
          strokeWidth="0.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Invisible hover targets */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - 50 / points.length}
            y={0}
            width={100 / points.length}
            height={40}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            className="cursor-pointer"
          />
        ))}
        {hoverPoint && (
          <>
            <line
              x1={hoverPoint.x}
              y1={0}
              x2={hoverPoint.x}
              y2={40}
              stroke="hsl(var(--primary))"
              strokeWidth="0.3"
              strokeDasharray="1,1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={hoverPoint.x}
              cy={hoverPoint.y}
              r="1.2"
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      {hoverPoint && (
        <div
          className="pointer-events-none absolute -top-1 px-2 py-1 rounded-md bg-popover border text-[10px] font-mono shadow-md whitespace-nowrap animate-fade-in"
          style={{
            left: `${hoverPoint.x}%`,
            transform: "translateX(-50%) translateY(-100%)",
          }}
        >
          <div className="font-semibold">{hoverPoint.count} attestations</div>
          <div className="text-muted-foreground">{hoverPoint.day}</div>
        </div>
      )}
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>30d trước</span>
        <span>Hôm nay</span>
      </div>
    </div>
  );
}
