import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ArrowRight, Check, Sparkles, Fingerprint, Shield, UserPlus,
  ShieldCheck, PartyPopper,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDID } from "@/hooks/useDID";
import { useTrustProfile } from "@/hooks/useTrustProfile";
import { useMyGuardians } from "@/hooks/useRecovery";
import { useAttestations } from "@/hooks/useAttestations";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrustTierBadge } from "@/components/identity/TrustTierBadge";
import { TCMeter } from "@/components/identity/TCMeter";
import { AttestationDialog } from "@/components/identity/AttestationDialog";
import { AddGuardianInline } from "./AddGuardianInline";

type StepKey = "did" | "guardian" | "attestation" | "review";

const STEPS: { key: StepKey; label: string; icon: React.ReactNode }[] = [
  { key: "did", label: "Định danh", icon: <Fingerprint className="h-4 w-4" /> },
  { key: "guardian", label: "Guardian", icon: <Shield className="h-4 w-4" /> },
  { key: "attestation", label: "Attestation", icon: <UserPlus className="h-4 w-4" /> },
  { key: "review", label: "Hoàn tất", icon: <PartyPopper className="h-4 w-4" /> },
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: did, isLoading: didLoading, refetch: refetchDID } = useDID();
  const { data: trust } = useTrustProfile();
  const { data: guardians = [] } = useMyGuardians();
  const { data: attestations = [] } = useAttestations(did?.id);

  const activeGuardians = guardians.filter((g) => g.status === "active").length;
  const receivedAttestations = attestations.filter(
    (a) => a.direction === "received" && a.status === "active"
  ).length;

  const completed = useMemo(
    () => ({
      did: !!did,
      guardian: activeGuardians >= 1,
      attestation: receivedAttestations >= 1,
    }),
    [did, activeGuardians, receivedAttestations]
  );

  const initialStep: StepKey = !did
    ? "did"
    : activeGuardians === 0
    ? "guardian"
    : receivedAttestations === 0
    ? "attestation"
    : "review";

  const [step, setStep] = useState<StepKey>(initialStep);
  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const createDID = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-did", {
        body: { wallet_address: null },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("✨ Đã tạo Định danh số!");
      refetchDID();
      setStep("guardian");
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message ?? e}`),
  });

  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl p-4">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <p>Vui lòng đăng nhập để bắt đầu Onboarding.</p>
            <Button onClick={() => navigate("/auth")}>Đăng nhập</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const goNext = () => {
    const nextIdx = Math.min(STEPS.length - 1, stepIndex + 1);
    setStep(STEPS[nextIdx].key);
  };
  const goBack = () => {
    const prevIdx = Math.max(0, stepIndex - 1);
    setStep(STEPS[prevIdx].key);
  };

  return (
    <div className="container mx-auto max-w-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/identity")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Identity
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-400 bg-clip-text text-transparent">
          Onboarding Trust
        </h1>
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between gap-1">
            {STEPS.map((s, i) => {
              const done =
                (s.key === "did" && completed.did) ||
                (s.key === "guardian" && completed.guardian) ||
                (s.key === "attestation" && completed.attestation) ||
                (s.key === "review" && completed.did && completed.guardian && completed.attestation);
              const active = s.key === step;
              return (
                <button
                  key={s.key}
                  onClick={() => setStep(s.key)}
                  className={`flex flex-col items-center gap-1 flex-1 px-1 py-2 rounded-lg transition ${
                    active ? "bg-amber-500/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      done
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : active
                        ? "border-amber-500 text-amber-600"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : s.icon}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-medium text-center ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {i + 1}. {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      {step === "did" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-amber-500" /> Bước 1 — Tạo Định danh số (DID)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {didLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : did ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">Bạn đã có DID</span>
                </div>
                <div className="font-mono text-xs break-all text-muted-foreground">{did.did}</div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  DID là khoá định danh duy nhất của bạn trong hệ sinh thái FUN. Sau khi tạo,
                  bạn sẽ mở khoá Trust Confidence, SBT collection và nhận 100% phần thưởng mint.
                </p>
                <Button
                  onClick={() => createDID.mutate()}
                  disabled={createDID.isPending}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 !text-black font-semibold"
                  size="lg"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {createDID.isPending ? "Đang tạo..." : "Tạo Định danh ngay"}
                </Button>
              </>
            )}
            <NavRow onBack={null} onNext={did ? goNext : null} />
          </CardContent>
        </Card>
      )}

      {step === "guardian" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" /> Bước 2 — Thêm Guardian (khôi phục)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Guardian là người bạn tin cậy giúp khôi phục tài khoản nếu bạn mất quyền truy cập.
              Cần ≥3 guardian để bật khôi phục đầy đủ. Tối thiểu 1 để qua bước này.
            </p>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <span className="font-medium">Guardian active:</span>{" "}
              <Badge variant={activeGuardians >= 3 ? "default" : "secondary"}>
                {activeGuardians}/3
              </Badge>
              <span className="text-xs text-muted-foreground ml-2">
                ({activeGuardians >= 3 ? "Đủ để khôi phục" : "Khuyến nghị 3+"})
              </span>
            </div>

            <AddGuardianInline />

            <NavRow onBack={goBack} onNext={completed.guardian ? goNext : null} skipLabel="Bỏ qua tạm" onSkip={goNext} />
          </CardContent>
        </Card>
      )}

      {step === "attestation" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-500" /> Bước 3 — Nhận Attestation đầu tiên
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Attestation là xác thực P2P từ user khác (T1+). Mỗi attestation tăng Trust Confidence
              và đẩy bạn từ T0 → T1. Bạn có thể nhờ người quen vouch, hoặc gửi attestation cho họ trước.
            </p>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <span className="font-medium">Attestation đã nhận:</span>{" "}
              <Badge variant={receivedAttestations >= 1 ? "default" : "secondary"}>
                {receivedAttestations}
              </Badge>
            </div>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs space-y-1">
              <p className="font-semibold">💡 Cách nhận attestation:</p>
              <p>• Gửi link <code className="font-mono">/identity</code> cho bạn bè T1+ và nhờ họ vào tab Attestation gửi cho bạn</p>
              <p>• Hoặc gửi attestation cho họ trước → họ sẽ vouch lại</p>
            </div>

            {trust?.trust_tier && trust.trust_tier !== "T0" && (
              <AttestationDialog
                trigger={
                  <Button className="w-full" variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" /> Gửi attestation cho người khác
                  </Button>
                }
              />
            )}

            <NavRow onBack={goBack} onNext={goNext} skipLabel={completed.attestation ? undefined : "Tôi sẽ làm sau"} onSkip={!completed.attestation ? goNext : undefined} />
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-amber-500" /> Hoàn tất — Trạng thái Trust của bạn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {trust ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Trust Tier</div>
                    <TrustTierBadge tier={trust.trust_tier} size="lg" />
                  </div>
                  <div className="rounded-lg border p-3">
                    <TCMeter tc={Number(trust.tc)} />
                  </div>
                </div>

                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${completed.did ? "text-emerald-500" : "text-muted-foreground"}`} />
                    DID đã tạo
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${completed.guardian ? "text-emerald-500" : "text-muted-foreground"}`} />
                    {activeGuardians} Guardian active {activeGuardians < 3 && "(khuyến nghị thêm)"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`h-4 w-4 ${completed.attestation ? "text-emerald-500" : "text-muted-foreground"}`} />
                    {receivedAttestations} Attestation đã nhận
                  </li>
                </ul>

                {trust.trust_tier === "T0" ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    Bạn đang ở <b>T0 (Mint cap 50%)</b>. Nhận thêm attestation hoặc tăng hoạt động
                    để lên T1 và mở 100% mint.
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                    🎉 Bạn đã đạt <b>{trust.trust_tier}</b> — full mint đã mở khoá!
                  </div>
                )}
              </>
            ) : (
              <Skeleton className="h-32 w-full" />
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/identity")}>
                Vào trang Identity
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 !text-black font-semibold"
                onClick={() => navigate("/mint")}
              >
                Tới Mint <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function NavRow({
  onBack, onNext, onSkip, skipLabel,
}: {
  onBack: (() => void) | null;
  onNext: (() => void) | null;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-2 border-t">
      <Button variant="ghost" onClick={onBack ?? undefined} disabled={!onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Quay lại
      </Button>
      <div className="flex gap-2">
        {onSkip && skipLabel && (
          <Button variant="ghost" size="sm" onClick={onSkip}>
            {skipLabel}
          </Button>
        )}
        <Button onClick={onNext ?? undefined} disabled={!onNext} className="bg-gradient-to-r from-amber-500 to-yellow-500 !text-black font-semibold">
          Tiếp theo <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
