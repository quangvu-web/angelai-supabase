import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useOrgByDid, useStakeValidator, useUnstakeValidator, useMyStakes } from "@/hooks/useOrgIdentity";
import { useAuth } from "@/hooks/useAuth";
import { useCoordinatorRole } from "@/hooks/useCoordinatorRole";
import { TrustTierBadge } from "@/components/identity/TrustTierBadge";
import { ValidatorRewardCard } from "@/components/identity/ValidatorRewardCard";
import { SlashValidatorDialog } from "@/components/identity/SlashValidatorDialog";
import { ValidatorActivityTab } from "@/components/validators/ValidatorActivityTab";
import { ArrowLeft, Globe, ShieldCheck, Coins, Users, Lock, ExternalLink, Building2, Award, Activity } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { smartBack } from "@/lib/smartBack";

export default function OrgProfile() {
  const { didOrSlug } = useParams<{ didOrSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useOrgByDid(didOrSlug);
  const { data: myStakes = [] } = useMyStakes();
  const stake = useStakeValidator();
  const unstake = useUnstakeValidator();
  const { hasAccess: isAdmin } = useCoordinatorRole();
  const [stakeAmount, setStakeAmount] = useState("10000");

  if (isLoading) return <div className="container mx-auto max-w-4xl p-4"><Skeleton className="h-64 w-full" /></div>;

  if (!data || data.error || !data.org) {
    return (
      <div className="container mx-auto max-w-4xl p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>
        <Card><CardContent className="p-12 text-center text-muted-foreground">Không tìm thấy tổ chức / validator</CardContent></Card>
      </div>
    );
  }

  const org = data.org;
  const did = data.did;
  const isValidator = did?.entity_type === "validator";
  const isOwner = user?.id === org.user_id;

  const handleStake = () => {
    const amount = Number(stakeAmount);
    if (!Number.isFinite(amount) || amount < 10000) {
      toast.error("Tối thiểu 10,000 Camly Coin");
      return;
    }
    stake.mutate(amount, {
      onSuccess: (res: any) => {
        if (res?.success) toast.success(`Đã stake ${amount.toLocaleString()} Camly Coin`);
        else toast.error(res?.error || "Stake thất bại");
      },
      onError: (e: any) => toast.error(e?.message),
    });
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
      </Button>

      {/* Hero card */}
      <Card className="overflow-hidden">
        {org.banner_url && (
          <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${org.banner_url})` }} />
        )}
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center overflow-hidden shrink-0">
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.display_name} className="h-full w-full object-cover" />
              ) : isValidator ? (
                <ShieldCheck className="h-10 w-10 text-white" />
              ) : (
                <Building2 className="h-10 w-10 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{org.display_name}</h1>
                {org.is_verified && (
                  <Badge className="bg-blue-500 text-white"><ShieldCheck className="h-3 w-3 mr-1" /> Verified</Badge>
                )}
                <Badge variant={isValidator ? "default" : "secondary"} className={isValidator ? "bg-purple-500" : ""}>
                  {isValidator ? "Validator" : "Organization"}
                </Badge>
                {data.trust_tier && <TrustTierBadge tier={data.trust_tier} size="sm" />}
              </div>
              <div className="text-xs font-mono text-muted-foreground break-all">{did?.did}</div>
              {org.description && <p className="text-sm text-muted-foreground">{org.description}</p>}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {org.category}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {org.member_count} members</span>
                {org.website && (
                  <a href={org.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary">
                    <Globe className="h-3 w-3" /> Website <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Coins className="h-4 w-4" />} label="Total Stake"
          value={Number(data.total_stake || 0).toLocaleString()} suffix="CLY" />
        <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Trust Confidence"
          value={Number(data.tc || 0).toFixed(2)} />
        <StatCard icon={<Award className="h-4 w-4" />} label="Trust Tier"
          value={data.trust_tier || "—"} />
      </div>

      {/* Tabs: Overview / Activity (validator only) */}
      <Tabs defaultValue="overview">
        <TabsList className={isValidator ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          {isValidator && (
            <TabsTrigger value="activity">
              <Activity className="h-3.5 w-3.5 mr-1" /> Hoạt động 30d
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Validator stake panel — only owner */}
          {isValidator && isOwner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Validator Stake
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="Amount (min 10,000)"
                    min={10000}
                  />
                  <Button onClick={handleStake} disabled={stake.isPending}>
                    {stake.isPending ? "Staking..." : "Stake"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tối thiểu 10,000 CLY. Khoá 30 ngày. Slash nếu xác thực sai.
                </p>

                {myStakes.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Lịch sử stake</div>
                    {myStakes.map((s) => {
                      const unlockable = s.status === "active" && new Date(s.locked_until) <= new Date();
                      return (
                        <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                          <div>
                            <div className="font-mono font-medium">{Number(s.amount).toLocaleString()} CLY</div>
                            <div className="text-xs text-muted-foreground">
                              {s.status === "active"
                                ? `Khoá đến ${formatDistanceToNow(new Date(s.locked_until), { addSuffix: true })}`
                                : s.status}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={s.status === "active" ? "default" : "outline"}>{s.status}</Badge>
                            {unlockable && (
                              <Button size="sm" variant="outline"
                                onClick={() => unstake.mutate(s.id, {
                                  onSuccess: (r: any) => r?.success
                                    ? toast.success("Unstake thành công")
                                    : toast.error(r?.error || "Lỗi"),
                                })}>
                                Unstake
                              </Button>
                            )}
                            {isAdmin && s.status === "active" && (
                              <SlashValidatorDialog stakeId={s.id} validatorName={org.display_name} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Validator rewards card — owner only */}
          {isValidator && isOwner && <ValidatorRewardCard />}
        </TabsContent>

        {isValidator && (
          <TabsContent value="activity" className="mt-4">
            <ValidatorActivityTab didId={did?.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{icon} {label}</div>
        <div className="text-2xl font-bold">
          {value} {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
