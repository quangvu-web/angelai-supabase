import { useNavigate } from "react-router-dom";
import { FUN_ID_SSO_ENABLED } from "@/lib/authFeatureFlags";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogIn, Globe } from "lucide-react";

interface SignupPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignupPromptDialog({ open, onOpenChange }: SignupPromptDialogProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleFunIdSignup = async () => {
    try {
      const { funProfile } = await import("@/lib/funProfile");
      const authUrl = await funProfile.startAuth();
      onOpenChange(false);
      window.location.href = authUrl;
    } catch (err) {
      console.error("FUN ID SSO error:", err);
      onOpenChange(false);
      navigate("/auth");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-center leading-relaxed">
            {t("signup.promptTitle")}
          </DialogTitle>
        </DialogHeader>
        <ul className="space-y-3 text-lg font-semibold text-center py-2">
          <li>{t("signup.play")}</li>
          <li>{t("signup.learn")}</li>
          <li>{t("signup.explore")}</li>
          <li>{t("signup.reward")}</li>
        </ul>
        <div className="flex flex-col gap-3 pt-2">
          {FUN_ID_SSO_ENABLED && (
          <Button
            onClick={handleFunIdSignup}
            className="gap-2"
          >
            <Globe className="w-4 h-4" />
            Đăng ký FUN ID
          </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              navigate("/auth");
            }}
            className="gap-2"
          >
            <LogIn className="w-4 h-4" />
            {t("signup.loginButton")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            {t("signup.closeButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
