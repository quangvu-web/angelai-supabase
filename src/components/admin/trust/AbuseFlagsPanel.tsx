import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface AbuseFlag {
  id: string;
  did_id: string;
  did_identifier: string | null;
  user_id: string;
  user_email: string | null;
  flag_type: "reciprocal_pair" | "loop3" | "burst" | "rate_limit_hit" | "self_attest_attempt";
  severity: number;
  details: any;
  related_attestation_id: string | null;
  is_resolved: boolean;
  created_at: string;
}

const FLAG_LABELS: Record<AbuseFlag["flag_type"], { label: string; cls: string }> = {
  loop3: { label: "Vòng lặp 3 (A→B→C→A)", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40" },
  reciprocal_pair: { label: "Đối ứng A→B→A", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40" },
  burst: { label: "Burst (≥4/giờ)", cls: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/40" },
  rate_limit_hit: { label: "Chạm giới hạn", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  self_attest_attempt: { label: "Tự attest", cls: "bg-muted text-muted-foreground border-border" },
};

export function AbuseFlagsPanel() {
  const qc = useQueryClient();
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["abuse-flags", unresolvedOnly],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_attestation_abuse_flags", {
        _only_unresolved: unresolvedOnly,
        _limit: 200,
      });
      if (error) throw error;
      return (data ?? []) as AbuseFlag[];
    },
    refetchInterval: 30_000,
  });

  const clear = useMutation({
    mutationFn: async (flagId: string) => {
      const { data, error } = await supabase.rpc("admin_clear_abuse_flag", { _flag_id: flagId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã đánh dấu giải quyết");
      qc.invalidateQueries({ queryKey: ["abuse-flags"] });
    },
    onError: (e: any) => toast.error(e?.message || "Lỗi"),
  });

  const flags = data ?? [];
  const counts = flags.reduce<Record<string, number>>((acc, f) => {
    if (!f.is_resolved) acc[f.flag_type] = (acc[f.flag_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(FLAG_LABELS) as AbuseFlag["flag_type"][]).map((k) => (
          <Card key={k}>
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground line-clamp-1">{FLAG_LABELS[k].label}</div>
              <div className="text-2xl font-bold mt-1">{counts[k] || 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Cảnh báo lạm dụng attestation
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="unresolved" checked={unresolvedOnly} onCheckedChange={setUnresolvedOnly} />
              <Label htmlFor="unresolved" className="text-xs">Chỉ chưa xử lý</Label>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : flags.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              Không có cảnh báo nào — hệ thống đang sạch.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-2">Loại</th>
                    <th className="px-2">Severity</th>
                    <th className="px-2">User</th>
                    <th className="px-2">DID</th>
                    <th className="px-2">Chi tiết</th>
                    <th className="px-2">Khi nào</th>
                    <th className="px-2">Trạng thái</th>
                    <th className="px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f) => {
                    const meta = FLAG_LABELS[f.flag_type];
                    return (
                      <tr key={f.id} className="border-b hover:bg-muted/40 align-top">
                        <td className="py-2 pr-2">
                          <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                        </td>
                        <td className="px-2 font-mono text-xs">{f.severity}/5</td>
                        <td className="px-2 text-xs truncate max-w-[180px]" title={f.user_email || ""}>{f.user_email || f.user_id.slice(0, 8)}</td>
                        <td className="px-2 font-mono text-[11px] truncate max-w-[140px]" title={f.did_identifier || ""}>{f.did_identifier?.slice(-12) || "—"}</td>
                        <td className="px-2 text-xs max-w-[280px]">
                          <code className="text-[10px] line-clamp-2 block">{JSON.stringify(f.details)}</code>
                        </td>
                        <td className="px-2 text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: vi })}
                        </td>
                        <td className="px-2">
                          {f.is_resolved ? (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/40">Đã xử lý</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Chờ</Badge>
                          )}
                        </td>
                        <td className="px-2">
                          {!f.is_resolved && (
                            <Button size="sm" variant="ghost" onClick={() => clear.mutate(f.id)} disabled={clear.isPending}>
                              Giải quyết
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">📋 Quy tắc anti-abuse hiện hành</p>
          <p>• Tối đa <b>5 attestation/ngày</b> toàn cục, <b>3/ngày</b> cho cùng một người nhận</p>
          <p>• Cooldown <b>30 ngày</b> cho cùng cặp + cùng loại attestation</p>
          <p>• Chặn <b>đối ứng A→B→A</b> trong 7 ngày (trước đây 24 giờ)</p>
          <p>• Phát hiện và chặn <b>vòng lặp 3 bước A→B→C→A</b> trong 14 ngày</p>
          <p>• Burst (≥4 attestation trong 1 giờ) → tự nâng <b>sybil_risk = high</b></p>
        </CardContent>
      </Card>
    </div>
  );
}
