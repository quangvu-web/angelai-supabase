import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertTriangle, Clock, ShieldCheck, TrendingUp, Users } from "lucide-react";

type ConnectorHealth = {
  total: number;
  confirmed: number;
  revoked: number;
  last_24h: number;
  last_7d: number;
  disputes_open: number;
  disputes_upheld: number;
  disputes_rejected: number;
  expired_7d: number;
  in_window: number;
  claim_rate_7d: number;
  top_connectors: Array<{ user_id: string; display_name: string | null; handle: string | null; connector_count: number }>;
  sybil_clusters: Array<{ wallet: string; count: number }>;
};

async function loadHealth(): Promise<ConnectorHealth> {
  const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
  const since24h = new Date(Date.now() - 86400_000).toISOString();
  const nowIso = new Date().toISOString();

  const [
    totalQ, confirmedQ, revokedQ,
    last24Q, last7Q,
    dOpen, dUp, dRej,
    expiredQ, inWindowQ,
    topQ, eligibleQ, allConfirmed7d
  ] = await Promise.all([
    supabase.from("connectors").select("id", { count: "exact", head: true }),
    supabase.from("connectors").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
    supabase.from("connectors").select("id", { count: "exact", head: true }).eq("status", "revoked"),
    supabase.from("connectors").select("id", { count: "exact", head: true }).gte("confirmed_at", since24h),
    supabase.from("connectors").select("id", { count: "exact", head: true }).gte("confirmed_at", since7d),
    supabase.from("connector_disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("connector_disputes").select("id", { count: "exact", head: true }).eq("status", "upheld"),
    supabase.from("connector_disputes").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    supabase.from("connector_events").select("id", { count: "exact", head: true }).eq("reason", "window_expired").gte("created_at", since7d),
    supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("has_connector", false).gt("connector_window_expires_at", nowIso),
    supabase.from("profiles").select("user_id, display_name, handle, connector_count").gt("connector_count", 0).order("connector_count", { ascending: false }).limit(10),
    // For claim rate: count profiles created in last 7d
    supabase.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", since7d),
    supabase.from("connectors").select("connector_wallet").gte("confirmed_at", since7d),
  ]);

  // Sybil clusters: wallets with >= 3 confirmed connectors in 7d
  const counts = new Map<string, number>();
  for (const row of (allConfirmed7d.data ?? [])) {
    const w = (row as any).connector_wallet?.toLowerCase();
    if (!w) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const sybil_clusters = Array.from(counts.entries())
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([wallet, count]) => ({ wallet, count }));

  const eligible7d = eligibleQ.count ?? 0;
  const claim7d = last7Q.count ?? 0;
  const claim_rate_7d = eligible7d > 0 ? (claim7d / eligible7d) * 100 : 0;

  return {
    total: totalQ.count ?? 0,
    confirmed: confirmedQ.count ?? 0,
    revoked: revokedQ.count ?? 0,
    last_24h: last24Q.count ?? 0,
    last_7d: claim7d,
    disputes_open: dOpen.count ?? 0,
    disputes_upheld: dUp.count ?? 0,
    disputes_rejected: dRej.count ?? 0,
    expired_7d: expiredQ.count ?? 0,
    in_window: inWindowQ.count ?? 0,
    claim_rate_7d,
    top_connectors: (topQ.data ?? []) as any,
    sybil_clusters,
  };
}

function StatCard({ icon: Icon, label, value, hint, tone = "default" }: any) {
  const toneClass =
    tone === "warn" ? "text-amber-500" :
    tone === "danger" ? "text-red-500" :
    tone === "good" ? "text-emerald-500" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Icon className="h-3.5 w-3.5" /> {label}
          </div>
        </div>
        <div className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function ConnectorHealthPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-connector-health"],
    queryFn: loadHealth,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Sparkles} label="Tổng Connector" value={data.total.toLocaleString()} hint={`Confirmed: ${data.confirmed} • Revoked: ${data.revoked}`} />
        <StatCard icon={TrendingUp} label="24h gần nhất" value={data.last_24h} />
        <StatCard icon={TrendingUp} label="7 ngày gần nhất" value={data.last_7d} hint={`Claim rate: ${data.claim_rate_7d.toFixed(1)}%`} tone={data.claim_rate_7d < 20 ? "warn" : "good"} />
        <StatCard icon={Clock} label="Đang trong window" value={data.in_window} hint="Chưa có Connector, còn 48h" />
        <StatCard icon={AlertTriangle} label="Window hết hạn (7d)" value={data.expired_7d} tone={data.expired_7d > 10 ? "warn" : "default"} />
        <StatCard icon={ShieldCheck} label="Disputes mở" value={data.disputes_open} tone={data.disputes_open > 0 ? "warn" : "good"} />
        <StatCard icon={ShieldCheck} label="Disputes upheld" value={data.disputes_upheld} tone={data.disputes_upheld > 0 ? "danger" : "default"} />
        <StatCard icon={ShieldCheck} label="Disputes rejected" value={data.disputes_rejected} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-[#daa520]" /> Top Connectors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_connectors.length === 0 ? (
              <p className="text-xs text-muted-foreground">Chưa có ai làm Connector.</p>
            ) : (
              <div className="space-y-2">
                {data.top_connectors.map((c, i) => (
                  <div key={c.user_id} className="flex items-center justify-between text-sm border-b border-border/40 pb-1 last:border-0">
                    <div className="truncate">
                      <span className="text-muted-foreground mr-2">#{i + 1}</span>
                      <span className="font-medium">{c.display_name || c.handle || c.user_id.slice(0, 8)}</span>
                      {c.handle && <span className="text-xs text-muted-foreground ml-1">@{c.handle}</span>}
                    </div>
                    <Badge variant="outline" className="font-mono">{c.connector_count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Sybil Cluster Watch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground mb-2">
              Ví đã làm Connector ≥3 user trong 7 ngày qua (cần review thủ công).
            </p>
            {data.sybil_clusters.length === 0 ? (
              <p className="text-xs text-emerald-500">Không phát hiện cluster đáng ngờ.</p>
            ) : (
              <div className="space-y-2">
                {data.sybil_clusters.map((s) => (
                  <div key={s.wallet} className="flex items-center justify-between text-sm">
                    <code className="text-xs font-mono truncate">{s.wallet.slice(0, 10)}…{s.wallet.slice(-6)}</code>
                    <Badge variant={s.count >= 5 ? "destructive" : "secondary"}>{s.count} user</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
