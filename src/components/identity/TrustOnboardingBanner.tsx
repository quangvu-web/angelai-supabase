import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDID } from "@/hooks/useDID";
import { useTrustProfile } from "@/hooks/useTrustProfile";
import { useMyGuardians } from "@/hooks/useRecovery";

const DISMISS_KEY = "trust_onboarding_banner_dismissed_v1";

/**
 * Dismissible banner shown to users who haven't completed Trust onboarding.
 * Trigger conditions: no DID, OR T0 with no guardian, OR T0 with no attestation.
 * Dismissal persists 7 days in localStorage.
 */
export function TrustOnboardingBanner() {
  const { user } = useAuth();
  const { data: did } = useDID();
  const { data: trust } = useTrustProfile();
  const { data: guardians = [] } = useMyGuardians();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      setDismissed(false);
      return;
    }
    const ts = parseInt(raw, 10);
    if (Number.isFinite(ts) && Date.now() - ts < 7 * 86400_000) {
      setDismissed(true);
    } else {
      setDismissed(false);
    }
  }, []);

  if (!user || dismissed) return null;

  const activeGuardians = guardians.filter((g) => g.status === "active").length;
  const noDID = !did;
  const isT0 = trust?.trust_tier === "T0";
  const noGuardian = activeGuardians === 0;

  if (!noDID && !isT0) return null;

  let message: string;
  let cta = "Bắt đầu Onboarding";
  if (noDID) {
    message = "Tạo Định danh số để mở khoá Trust và nhận 100% phần thưởng mint.";
  } else if (noGuardian) {
    message = "Thêm Guardian để bảo vệ tài khoản và tiến lên Trust T1+.";
  } else {
    message = "Bạn đang ở Trust T0 (Mint cap 50%). Nhận thêm attestation để mở khoá full mint.";
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div className="relative rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 p-3 sm:p-4">
      <button
        onClick={handleDismiss}
        aria-label="Đóng"
        className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pr-6">
        <div className="flex items-start gap-2 flex-1">
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Hoàn tất Onboarding Trust</p>
            <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
          </div>
        </div>
        <Button asChild size="sm" className="bg-gradient-to-r from-amber-500 to-yellow-500 !text-black font-semibold whitespace-nowrap">
          <Link to="/identity/onboarding">
            {cta} <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
