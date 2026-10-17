import { ReactNode, useState } from "react";
import { FUN_ID_SSO_ENABLED } from "@/lib/authFeatureFlags";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogIn, Globe } from "lucide-react";

interface AuthActionGuardProps {
  children: ReactNode;
  message?: string;
  onAction?: () => void;
}

export function AuthActionGuard({ children, message }: AuthActionGuardProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);

  if (user) {
    return <>{children}</>;
  }

  const handleFunIdSignup = async () => {
    try {
      const { funProfile } = await import("@/lib/funProfile");
      const authUrl = await funProfile.startAuth();
      setShowDialog(false);
      window.location.href = authUrl;
    } catch (err) {
      console.error("FUN ID SSO error:", err);
      setShowDialog(false);
      navigate("/auth");
    }
  };

  return (
    <>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowDialog(true);
        }}
        className="contents"
      >
        {children}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-center leading-relaxed">
              {t("signup.promptTitle")}
            </DialogTitle>
          </DialogHeader>
          {message && (
            <p className="text-sm text-center text-muted-foreground">{message}</p>
          )}
          <ul className="space-y-3 text-lg font-semibold text-center py-2">
            <li>{t("signup.play")}</li>
            <li>{t("signup.learn")}</li>
            <li>{t("signup.explore")}</li>
            <li>{t("signup.reward")}</li>
          </ul>
          <div className="flex flex-col gap-3 pt-2">
            {FUN_ID_SSO_ENABLED && (
            <Button onClick={handleFunIdSignup} className="gap-2">
              <Globe className="w-4 h-4" />
              Đăng ký FUN ID
            </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                navigate("/auth");
              }}
              className="gap-2"
            >
              <LogIn className="w-4 h-4" />
              {t("signup.loginButton")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDialog(false)}
            >
              {t("signup.closeButton")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function useAuthGuard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const requireAuth = (callback: () => void, message?: string) => {
    if (!user) {
      import("sonner").then(({ toast }) => {
        toast.error(message || t("loginRequired") || "Con yêu dấu, hãy đăng ký tài khoản để Ta đồng hành cùng con nhé!", {
          action: {
            label: t("login") || "Đăng nhập",
            onClick: () => navigate("/auth"),
          },
        });
      });
      return;
    }
    callback();
  };

  return { user, requireAuth };
}
