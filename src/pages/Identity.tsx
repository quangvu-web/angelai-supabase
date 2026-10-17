import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDID } from "@/hooks/useDID";
import { useTrustProfile } from "@/hooks/useTrustProfile";
import { useSBTs, type SBTType } from "@/hooks/useSBTs";
import { TrustTierBadge } from "@/components/identity/TrustTierBadge";
import { TCMeter } from "@/components/identity/TCMeter";
import { SBTCard } from "@/components/identity/SBTCard";
import { SbtMintHistoryCard } from "@/components/identity/SbtMintHistoryCard";
import { DIDCard } from "@/components/identity/DIDCard";
import { DIBVaultsCard } from "@/components/identity/DIBVaultsCard";
import { ConnectorMiniCard } from "@/components/identity/ConnectorMiniCard";
import { AttestationsTab } from "@/components/identity/AttestationsTab";
import { GuardianRecoveryTab } from "@/components/identity/GuardianRecoveryTab";
import { PrivateAttestationPanel } from "@/components/identity/PrivateAttestationPanel";
import { TrustTrendChart } from "@/components/identity/TrustTrendChart";
import { OrgRegisterCard } from "@/components/identity/OrgRegisterCard";
import { ArrowLeft, Mail, Wallet, ShieldAlert, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { smartBack } from "@/lib/smartBack";

const SBT_TYPES: { key: SBTType; label: string }[] = [
  { key: "identity", label: "Identity" },
  { key: "trust", label: "Trust" },
  { key: "contribution", label: "Contribution" },
  { key: "credential", label: "Credential" },
  { key: "milestone", label: "Milestone" },
  { key: "legacy", label: "Legacy" },
];

const PILLAR_BARS = [
  { key: "vs", label: "Verification", color: "from-blue-500 to-indigo-500" },
  { key: "bs", label: "Behavior", color: "from-emerald-500 to-teal-500" },
  { key: "ss", label: "Social", color: "from-amber-500 to-yellow-500" },
  { key: "os", label: "On-chain", color: "from-purple-500 to-violet-500" },
  { key: "hs", label: "History", color: "from-pink-500 to-rose-500" },
] as const;

export default function Identity() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: did, isLoading: didLoading, refetch: refetchDID } = useDID();
  const { data: trust, isLoading: trustLoading } = useTrustProfile();
  const { data: sbts, isLoading: sbtsLoading } = useSBTs();

  const createDID = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-did", {
        body: { wallet_address: null },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã tạo Định danh số (DID)");
      refetchDID();
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message}`),
  });

  return (
    <div className="container mx-auto max-w-5xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-400 bg-clip-text text-transparent">
          Định danh & Niềm tin
        </h1>
      </div>

      {!user && (
        <Card><CardContent className="p-6 text-center">Vui lòng đăng nhập.</CardContent></Card>
      )}

      {user && !did && !didLoading && (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
            <div>
              <h3 className="font-semibold text-lg">Bạn chưa có Định danh số</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tạo DID để mở khoá Trust Confidence, SBT collection và 100% phần thưởng mint.
              </p>
            </div>
            <Button
              onClick={() => createDID.mutate()}
              disabled={createDID.isPending}
              className="bg-gradient-to-r from-amber-500 to-yellow-500"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {createDID.isPending ? "Đang tạo..." : "Tạo Định danh ngay"}
            </Button>
          </CardContent>
        </Card>
      )}

      {user && did && (
        <Tabs defaultValue="overview">
          <div className="-mx-4 px-4 overflow-x-auto md:mx-0 md:px-0 md:overflow-visible">
            <TabsList className="inline-flex h-auto md:grid md:w-full md:grid-cols-6 whitespace-nowrap">
              <TabsTrigger value="overview" className="text-xs md:text-sm px-3">Tổng quan</TabsTrigger>
              <TabsTrigger value="sbt" className="text-xs md:text-sm px-3">SBT</TabsTrigger>
              <TabsTrigger value="attestations" className="text-xs md:text-sm px-3">Attestation</TabsTrigger>
              <TabsTrigger value="privacy" className="text-xs md:text-sm px-3">🔒 Privacy</TabsTrigger>
              <TabsTrigger value="dib" className="text-xs md:text-sm px-3">DIB</TabsTrigger>
              <TabsTrigger value="recovery" className="text-xs md:text-sm px-3">Recovery</TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <DIDCard did={did} />
              <Card>
                <CardContent className="p-5 space-y-4">
                  {trustLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : trust ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Trust Tier</span>
                        <TrustTierBadge tier={trust.trust_tier} size="lg" />
                      </div>
                      <TCMeter tc={Number(trust.tc)} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu trust.</p>
                  )}
                </CardContent>
              </Card>
              <ConnectorMiniCard />
            </div>


            {trust && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Phân tích 5 nhóm</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {PILLAR_BARS.map((p) => {
                    const v = Number((trust as any)[p.key] ?? 0);
                    return (
                      <div key={p.key} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{p.label}</span>
                          <span className="font-mono font-medium">{v.toFixed(2)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full bg-gradient-to-r ${p.color}`}
                            style={{ width: `${Math.min(100, v * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {trust && (
              <TrustTrendChart
                days={30}
                currentDecay={Number(trust.decay_factor ?? 1)}
                daysInactive={
                  trust.last_activity_at
                    ? Math.max(0, Math.floor((Date.now() - new Date(trust.last_activity_at).getTime()) / 86400000))
                    : 0
                }
              />
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Entity nâng cao</CardTitle></CardHeader>
              <CardContent>
                <OrgRegisterCard />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Mẹo nâng cấp</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2 text-muted-foreground">
                <p>• Liên kết ví Web3 để tăng <b>On-chain credibility</b></p>
                <p>• Đăng nhập đều đặn ≥ 30 ngày để kích hoạt SBT <b>Consistency</b></p>
                <p>• Hoàn thành ≥ 50 hành động trong 30 ngày để mở SBT <b>Active Contributor</b></p>
                <p>• Giữ tài khoản sạch (không có cảnh báo gian lận) để tăng <b>Historical cleanliness</b></p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: SBT */}
          <TabsContent value="sbt" className="space-y-4">
            <SbtMintHistoryCard />
            {sbtsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              SBT_TYPES.map((g) => {
                const items = (sbts || []).filter((s) => s.sbt_type === g.key);
                return (
                  <div key={g.key} className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label} <span className="text-xs">({items.length})</span>
                    </h3>
                    {items.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-sm text-muted-foreground">
                          Chưa có SBT trong nhóm này.
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((s) => <SBTCard key={s.id} sbt={s} />)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* TAB 3: ATTESTATIONS */}
          <TabsContent value="attestations" className="space-y-4">
            <AttestationsTab didId={did.id} trustTier={trust?.trust_tier} />
          </TabsContent>

          {/* TAB: PRIVACY (ZK) */}
          <TabsContent value="privacy" className="space-y-4">
            <PrivateAttestationPanel />
          </TabsContent>

          {/* TAB 4: DIB VAULTS */}
          <TabsContent value="dib" className="space-y-4">
            <DIBVaultsCard didId={did.id} />
          </TabsContent>

          {/* TAB 5: RECOVERY */}
          <TabsContent value="recovery" className="space-y-4">
            <GuardianRecoveryTab />

            <Card>
              <CardHeader><CardTitle className="text-base">Phương thức khôi phục cơ bản</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <RecoveryRow icon={<Mail className="h-4 w-4" />} title="Email recovery"
                  subtitle={user?.email || "Chưa cấu hình"} status={!!user?.email} />
                <RecoveryRow icon={<Wallet className="h-4 w-4" />} title="Wallet backup"
                  subtitle={did.wallet_address || "Chưa liên kết ví Web3"} status={!!did.wallet_address} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function RecoveryRow({
  icon, title, subtitle, status,
}: { icon: React.ReactNode; title: string; subtitle: string; status: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className={`rounded-lg p-2 ${status ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
      </div>
      <span className={`text-xs font-medium ${status ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
        {status ? "Active" : "Inactive"}
      </span>
    </div>
  );
}
