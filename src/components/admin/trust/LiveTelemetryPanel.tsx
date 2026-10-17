import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, UserPlus, Handshake, TrendingUp, ShieldAlert, Radio } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { createRealtimeChannelId } from "@/lib/realtime";

interface TelemetryTotals {
  dids_24h: number;
  attestations_24h: number;
  tier_ups_24h: number;
  mint_blocked_24h: number;
  active_t1plus: number;
  total_dids: number;
  tier_up_rate: number;
}

interface HourPoint { hour: string; count: number }
interface ReasonRow { reason: string; count: number }
interface RecentEvent {
  event_type: string;
  created_at: string;
  did_id: string;
  event_data: any;
}

interface TelemetryPayload {
  generated_at: string;
  totals: TelemetryTotals;
  hourly_dids: HourPoint[];
  hourly_attestations: HourPoint[];
  top_block_reasons: ReasonRow[];
  recent_events: RecentEvent[];
}

function MiniBar({ data, label }: { data: HourPoint[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label} (24h)</div>
      <div className="flex items-end gap-[2px] h-16">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/70 rounded-sm min-h-[2px]"
            style={{ height: `${(d.count / max) * 100}%` }}
            title={`${new Date(d.hour).getHours()}h: ${d.count}`}
          />
        ))}
      </div>
    </div>
  );
}

export function LiveTelemetryPanel() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["trust-live-telemetry"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_trust_live_telemetry");
      if (error) throw error;
      return data as unknown as TelemetryPayload;
    },
    refetchInterval: 15_000,
  });

  // Realtime: invalidate on did_events / attestation_log inserts
  useEffect(() => {
    const channel = supabase
      .channel(createRealtimeChannelId("trust_live"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "did_events" }, () => {
        qc.invalidateQueries({ queryKey: ["trust-live-telemetry"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attestation_log" }, () => {
        qc.invalidateQueries({ queryKey: ["trust-live-telemetry"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_dids" }, () => {
        qc.invalidateQueries({ queryKey: ["trust-live-telemetry"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data || (data as any)?.error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {(data as any)?.error || "Không tải được dữ liệu telemetry"}
        </CardContent>
      </Card>
    );
  }

  const t = data.totals;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Radio className="h-3 w-3 text-primary animate-pulse" />
        Cập nhật: {formatDistanceToNow(new Date(data.generated_at), { addSuffix: true, locale: vi })} • Tự refresh 15s
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><UserPlus className="h-3 w-3" /> DIDs/24h</div>
            <div className="text-2xl font-bold">{t.dids_24h}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Handshake className="h-3 w-3" /> Attest/24h</div>
            <div className="text-2xl font-bold">{t.attestations_24h}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" /> Tier-up/24h</div>
            <div className="text-2xl font-bold">{t.tier_ups_24h}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldAlert className="h-3 w-3" /> Mint block/24h</div>
            <div className="text-2xl font-bold">{t.mint_blocked_24h}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Active ≥T1</div>
            <div className="text-2xl font-bold">{t.active_t1plus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Tier-up rate</div>
            <div className="text-2xl font-bold">{t.tier_up_rate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Sparklines */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <MiniBar data={data.hourly_dids || []} label="DIDs theo giờ" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <MiniBar data={data.hourly_attestations || []} label="Attestations theo giờ" />
          </CardContent>
        </Card>
      </div>

      {/* Top block reasons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Top lý do mint bị chặn (7 ngày)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data.top_block_reasons || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Không có mint nào bị chặn — hệ thống ổn định 🎉</div>
          ) : (
            <div className="space-y-2">
              {data.top_block_reasons.map((r, i) => (
                <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="text-sm font-mono truncate max-w-[70%]" title={r.reason}>{r.reason || "—"}</div>
                  <div className="text-sm font-bold">{r.count}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent events feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Sự kiện gần nhất
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(data.recent_events || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">Chưa có sự kiện</div>
          ) : (
            <div className="space-y-2">
              {data.recent_events.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b pb-1 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-semibold text-primary">{e.event_type}</span>
                    <span className="text-muted-foreground font-mono truncate">{e.did_id?.slice(0, 8)}…</span>
                  </div>
                  <div className="text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: vi })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
