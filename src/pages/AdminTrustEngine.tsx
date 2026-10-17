import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrustTierBadge } from "@/components/identity/TrustTierBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RefreshCw, Award, Camera, Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { TrustStatsCharts } from "@/components/admin/trust/TrustStatsCharts";
import { SBTAdminTable } from "@/components/admin/trust/SBTAdminTable";
import { RecoveryAdminPanel } from "@/components/admin/trust/RecoveryAdminPanel";
import { AdminProfileFilters, ProfileFilters } from "@/components/admin/trust/AdminProfileFilters";
import { LiveTelemetryPanel } from "@/components/admin/trust/LiveTelemetryPanel";
import { AbuseFlagsPanel } from "@/components/admin/trust/AbuseFlagsPanel";
import { SybilAnalyticsPanel } from "@/components/admin/trust/SybilAnalyticsPanel";
import { SlashAutomationPanel } from "@/components/admin/trust/SlashAutomationPanel";
import { SbtOnchainQueuePanel } from "@/components/admin/trust/SbtOnchainQueuePanel";
import { ConnectorDisputesPanel } from "@/components/admin/trust/ConnectorDisputesPanel";
import { smartBack } from "@/lib/smartBack";

const SBT_TYPES = ["identity", "trust", "contribution", "credential", "milestone", "legacy"] as const;

export default function AdminTrustEngine() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<ProfileFilters>({ search: "", tier: "", sybil: "", sortBy: "tc" });
  const [issueDidId, setIssueDidId] = useState("");
  const [issueType, setIssueType] = useState<typeof SBT_TYPES[number]>("contribution");
  const [issueSubtype, setIssueSubtype] = useState("");

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-trust-profiles", filters.sortBy],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trust_profile")
        .select("*, user_dids!inner(did, wallet_address, did_level, entity_type)")
        .order(filters.sortBy, { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-trust-stats-basic"],
    queryFn: async () => {
      const { data } = await supabase.from("trust_profile").select("trust_tier");
      const counts = { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0 };
      (data || []).forEach((r: any) => { counts[r.trust_tier as keyof typeof counts]++; });
      return { counts, total: data?.length || 0 };
    },
  });

  const recompute = useMutation({
    mutationFn: async (didId?: string) => {
      const { data, error } = await supabase.functions.invoke("compute-trust-engine", {
        body: didId ? { did_id: didId } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Đã cập nhật ${d?.updated || 0} hồ sơ`);
      qc.invalidateQueries({ queryKey: ["admin-trust-profiles"] });
      qc.invalidateQueries({ queryKey: ["trust-admin-stats"] });
    },
    onError: (e: any) => toast.error(e?.message),
  });

  const snapshot = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("identity-snapshot", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Snapshot ${d?.epoch}: ${d?.snapshotted || 0} DIDs`);
      qc.invalidateQueries({ queryKey: ["trust-cron-health"] });
    },
    onError: (e: any) => toast.error(e?.message),
  });

  const { data: cronHealth, isLoading: cronLoading } = useQuery({
    queryKey: ["trust-cron-health"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_trust_cron_health", { _limit: 10 });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const issueSBT = useMutation({
    mutationFn: async () => {
      if (!issueDidId || !issueSubtype) throw new Error("Cần DID ID và subtype");
      const { data, error } = await supabase.functions.invoke("issue-sbt", {
        body: { did_id: issueDidId, sbt_type: issueType, sbt_subtype: issueSubtype, issuer: "admin", trust_weight: 0.05 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("SBT đã được phát hành");
      setIssueDidId("");
      setIssueSubtype("");
    },
    onError: (e: any) => toast.error(e?.message),
  });

  const filtered = useMemo(() => {
    return (profiles || []).filter((p: any) => {
      if (filters.search && !p.user_dids?.did?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.tier && p.trust_tier !== filters.tier) return false;
      if (filters.sybil && p.sybil_risk !== filters.sybil) return false;
      return true;
    });
  }, [profiles, filters]);

  const exportCSV = () => {
    const rows = [
      ["did", "tier", "tc", "vs", "bs", "ss", "os", "hs", "sybil_risk"],
      ...filtered.map((p: any) => [
        p.user_dids?.did, p.trust_tier, p.tc, p.vs, p.bs, p.ss, p.os, p.hs, p.sybil_risk,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trust-profiles-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
          </Button>
          <h1 className="text-2xl font-bold">Trust Engine — Admin</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => snapshot.mutate()} disabled={snapshot.isPending} variant="outline" size="sm">
            <Camera className={`h-4 w-4 mr-2 ${snapshot.isPending ? "animate-pulse" : ""}`} />
            Snapshot
          </Button>
          <Button onClick={() => recompute.mutate(undefined)} disabled={recompute.isPending} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${recompute.isPending ? "animate-spin" : ""}`} />
            Recompute all
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="-mx-4 px-4 overflow-x-auto md:mx-0 md:px-0 md:overflow-visible">
          <TabsList className="inline-flex h-auto whitespace-nowrap">
            <TabsTrigger value="overview" className="text-xs md:text-sm">Tổng quan</TabsTrigger>
            <TabsTrigger value="live" className="text-xs md:text-sm">🔴 Live</TabsTrigger>
            <TabsTrigger value="abuse" className="text-xs md:text-sm">🚨 Abuse</TabsTrigger>
            <TabsTrigger value="sybil" className="text-xs md:text-sm">🕸️ Sybil</TabsTrigger>
            <TabsTrigger value="slash" className="text-xs md:text-sm">⚖️ Slash</TabsTrigger>
            <TabsTrigger value="onchain" className="text-xs md:text-sm">⛓️ On-chain</TabsTrigger>
            <TabsTrigger value="profiles" className="text-xs md:text-sm">Profiles</TabsTrigger>
            <TabsTrigger value="sbts" className="text-xs md:text-sm">SBTs</TabsTrigger>
            <TabsTrigger value="recovery" className="text-xs md:text-sm">Recovery</TabsTrigger>
            <TabsTrigger value="connector" className="text-xs md:text-sm">✨ Connector</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Stats counters */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Total DIDs</div>
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
              </CardContent>
            </Card>
            {(["T0","T1","T2","T3","T4"] as const).map((t) => (
              <Card key={t}>
                <CardContent className="p-3">
                  <TrustTierBadge tier={t} size="sm" showLabel={false} />
                  <div className="text-2xl font-bold mt-1">{stats?.counts?.[t] || 0}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <TrustStatsCharts />

          {/* Cron Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Lịch sử cron jobs (10 lần gần nhất)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cronLoading ? <Skeleton className="h-24 w-full" /> : (cronHealth || []).length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Chưa có lần chạy nào — cron sẽ kích hoạt theo lịch (Trust 02:00 VN, Snapshot CN 03:00 VN)
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 pr-2">Job</th>
                        <th className="px-2">Status</th>
                        <th className="px-2">Bắt đầu</th>
                        <th className="px-2">Thời lượng</th>
                        <th className="px-2">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cronHealth as any[]).map((r, i) => (
                        <tr key={i} className="border-b hover:bg-muted/40">
                          <td className="py-2 pr-2 font-mono text-xs">{r.jobname?.replace(/-(daily|weekly)$/, "")}</td>
                          <td className="px-2">
                            {r.status === "succeeded" ? (
                              <span className="inline-flex items-center gap-1 text-primary text-xs">
                                <CheckCircle2 className="h-3 w-3" /> {r.status}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-destructive text-xs">
                                <XCircle className="h-3 w-3" /> {r.status}
                              </span>
                            )}
                          </td>
                          <td className="px-2 text-xs whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {r.start_time ? formatDistanceToNow(new Date(r.start_time), { addSuffix: true, locale: vi }) : "—"}
                            </span>
                          </td>
                          <td className="px-2 font-mono text-xs">{r.duration_ms ? `${Math.round(Number(r.duration_ms))}ms` : "—"}</td>
                          <td className="px-2 text-xs truncate max-w-[300px]" title={r.return_message || ""}>{r.return_message || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issue SBT */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Phát hành SBT thủ công</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                <Input placeholder="DID ID (uuid)" value={issueDidId} onChange={(e) => setIssueDidId(e.target.value)} />
                <Select value={issueType} onValueChange={(v) => setIssueType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SBT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Subtype (vd: builder)" value={issueSubtype} onChange={(e) => setIssueSubtype(e.target.value)} />
                <Button onClick={() => issueSBT.mutate()} disabled={issueSBT.isPending}>Issue</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trust Profiles ({filtered.length})</CardTitle>
              <div className="mt-2"><AdminProfileFilters filters={filters} onChange={setFilters} onExportCSV={exportCSV} /></div>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 pr-2">DID</th>
                        <th className="px-2">Tier</th>
                        <th className="px-2">TC</th>
                        <th className="px-2">VS</th>
                        <th className="px-2">BS</th>
                        <th className="px-2">SS</th>
                        <th className="px-2">OS</th>
                        <th className="px-2">HS</th>
                        <th className="px-2">Sybil</th>
                        <th className="px-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p: any) => (
                        <tr key={p.id} className="border-b hover:bg-muted/40">
                          <td className="py-2 pr-2 font-mono text-xs truncate max-w-[200px]">{p.user_dids?.did}</td>
                          <td className="px-2"><TrustTierBadge tier={p.trust_tier} size="sm" showLabel={false} /></td>
                          <td className="px-2 font-mono">{Number(p.tc).toFixed(3)}</td>
                          <td className="px-2 font-mono">{Number(p.vs).toFixed(2)}</td>
                          <td className="px-2 font-mono">{Number(p.bs).toFixed(2)}</td>
                          <td className="px-2 font-mono">{Number(p.ss).toFixed(2)}</td>
                          <td className="px-2 font-mono">{Number(p.os).toFixed(2)}</td>
                          <td className="px-2 font-mono">{Number(p.hs).toFixed(2)}</td>
                          <td className="px-2 text-xs">{p.sybil_risk}</td>
                          <td className="px-2">
                            <Button size="sm" variant="ghost" onClick={() => recompute.mutate(p.did_id)}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Không có dữ liệu</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="mt-4"><LiveTelemetryPanel /></TabsContent>
        <TabsContent value="abuse" className="mt-4"><AbuseFlagsPanel /></TabsContent>
        <TabsContent value="sybil" className="mt-4"><SybilAnalyticsPanel /></TabsContent>
        <TabsContent value="slash" className="mt-4"><SlashAutomationPanel /></TabsContent>
        <TabsContent value="onchain" className="mt-4"><SbtOnchainQueuePanel /></TabsContent>
        <TabsContent value="sbts" className="mt-4"><SBTAdminTable /></TabsContent>
        <TabsContent value="recovery" className="mt-4"><RecoveryAdminPanel /></TabsContent>
        <TabsContent value="connector" className="mt-4"><ConnectorDisputesPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
