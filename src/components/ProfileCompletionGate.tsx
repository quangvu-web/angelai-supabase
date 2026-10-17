import { ReactNode } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { useLightAgreement } from "@/hooks/useLightAgreement";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, LogIn, UserCircle, AlertCircle } from "lucide-react";

interface ProfileCompletionGateProps {
  children: ReactNode;
}

export function ProfileCompletionGate({ children }: ProfileCompletionGateProps) {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { hasAgreed, isChecking: isCheckingAgreement } = useLightAgreement();
  const { status, isChecking: isCheckingProfile } = useProfileCompletion();
  const { t } = useLanguage();

  // Loading state
  if (authLoading || isCheckingAgreement || isCheckingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">{t("loading") || "Đang tải..."}</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <LogIn className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">
            {t("loginRequired") || "Vui lòng đăng nhập"}
          </h1>
          <p className="text-muted-foreground">
            {t("loginRequiredDesc") || "Bạn cần đăng nhập để sử dụng tính năng này."}
          </p>
          <Button 
            onClick={() => navigate("/auth")} 
            className="gap-2"
          >
            <LogIn className="w-4 h-4" />
            {t("login") || "Đăng nhập"}
          </Button>
        </div>
      </div>
    );
  }

  // Logged in but hasn't agreed to Law of Light
  if (hasAgreed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold">
            {t("lightGateClosed") || "Cổng Ánh Sáng Đang Đóng"}
          </h1>
          <p className="text-muted-foreground">
            {t("lightGateDesc") || "Bạn cần đồng ý với Luật Ánh Sáng để sử dụng tính năng này. Đây là cam kết thiêng liêng để duy trì năng lượng tích cực trong cộng đồng."}
          </p>
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => navigate("/auth")} 
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t("agreeToLawOfLight") || "Đồng ý Luật Ánh Sáng"}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
            >
              {t("backToHome") || "Quay về Trang chủ"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Logged in, agreed, but profile not complete
  if (status && !status.isComplete) {
    const getMissingFieldsText = () => {
      const fieldNames: Record<string, string> = {
        display_name: "Tên hiển thị",
        avatar_url: "Ảnh đại diện",
        bio: "Giới thiệu bản thân",
      };
      
      return status.missingFields
        .filter(f => fieldNames[f])
        .map(f => fieldNames[f])
        .join(", ");
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <UserCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-divine-gold via-divine-light to-divine-gold bg-clip-text text-transparent">
            Hoàn Thiện Hồ Sơ Cá Nhân
          </h1>
          <p className="text-muted-foreground">
            Chào mừng bạn đến với Cổng Ánh Sáng! Để tiếp tục, vui lòng hoàn thiện hồ sơ cá nhân của bạn.
          </p>
          
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-left">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  Thông tin còn thiếu:
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                  {getMissingFieldsText()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>💡 <strong>Lưu ý:</strong> Địa chỉ ví Web3 không bắt buộc, bạn có thể thêm sau.</p>
          </div>

          <Button 
            onClick={() => navigate("/profile")} 
            className="gap-2 bg-gradient-to-r from-divine-gold to-divine-light hover:opacity-90"
          >
            <UserCircle className="w-4 h-4" />
            Hoàn thiện hồ sơ
          </Button>
        </div>
      </div>
    );
  }

  // User has agreed and profile is complete - render children
  return <>{children}</>;
}
