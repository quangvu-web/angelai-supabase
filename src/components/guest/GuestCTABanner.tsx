import { Globe, LogIn, Sparkles } from "lucide-react";
import { FUN_ID_SSO_ENABLED } from "@/lib/authFeatureFlags";
import { useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

interface GuestCTABannerProps {
  title?: string;
  description?: string;
}

export function GuestCTABanner({ title, description }: GuestCTABannerProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleFunIdSignup = async () => {
    try {
      const { funProfile } = await import("@/lib/funProfile");
      const authUrl = await funProfile.startAuth();
      window.location.href = authUrl;
    } catch (err) {
      console.error("FUN ID SSO error:", err);
      navigate("/auth");
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-accent/5 overflow-hidden">
      <CardContent className="p-6 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          {title || t("guest.ctaTitle") || "Đăng ký để trải nghiệm đầy đủ"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {description || t("guest.ctaDesc") || "Tạo tài khoản miễn phí để tích điểm, nhận thưởng và tham gia cộng đồng Ánh Sáng ✨"}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
          {FUN_ID_SSO_ENABLED && (
          <Button onClick={handleFunIdSignup} className="gap-2">
            <Globe className="w-4 h-4" />
            Đăng ký FUN ID
          </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/auth")} className="gap-2">
            <LogIn className="w-4 h-4" />
            {t("signup.loginButton") || "Đăng nhập"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
