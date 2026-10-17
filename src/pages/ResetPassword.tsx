import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import angelLogo from "@/assets/angel-ai-logo.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Synchronous URL check (for implicit flow)
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const hasRecoveryHash = hash.includes("type=recovery");
    const hasCodeParam = params.has("code") || hash.includes("access_token");

    if (hasRecoveryHash || hasCodeParam) {
      setIsValidSession(true);
    }

    // 2. Async session check (for PKCE flow — code already exchanged, URL already clean)
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isMounted && session) {
          setIsValidSession(true);
        }
      } catch {
        // ignore
      }
    };
    checkSession();

    // 3. Listen for PASSWORD_RECOVERY + SIGNED_IN events as backup
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
      }
      // PKCE flow may fire SIGNED_IN instead of PASSWORD_RECOVERY
      if (event === "SIGNED_IN" && window.location.pathname === "/reset-password") {
        setIsValidSession(true);
      }
    });

    // 4. Timeout only if URL has NO recovery indicators AND session check hasn't resolved
    const timeout = setTimeout(() => {
      if (isMounted) {
        setIsValidSession((prev) => prev === null ? false : prev);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu mới không khớp. Vui lòng kiểm tra lại.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu phải có ít nhất 6 ký tự.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Đổi mật khẩu thành công! ✨",
        description: "Bạn sẽ được chuyển về trang đăng nhập.",
      });

      // Sign out and redirect to auth
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/auth", { replace: true });
      }, 2000);
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Không thể đổi mật khẩu. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-divine-gold/20 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-divine-gold" />
            <p className="text-muted-foreground">Đang xác thực...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid / expired link
  if (isValidSession === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Link không hợp lệ hoặc đã hết hạn</h2>
            <p className="text-muted-foreground text-center text-sm">
              Vui lòng yêu cầu gửi lại email đặt lại mật khẩu.
            </p>
            <Button onClick={() => navigate("/auth")} className="bg-divine-gold hover:bg-divine-gold/90 text-primary-foreground">
              Về trang đăng nhập
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-divine-gold/20 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <h2 className="text-lg font-semibold text-foreground">Đổi mật khẩu thành công!</h2>
            <p className="text-muted-foreground text-center text-sm">
              Đang chuyển về trang đăng nhập...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-divine-gold/20 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={angelLogo} alt="Angel AI" className="h-16 w-16 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-divine-gold via-divine-light to-divine-gold bg-clip-text text-transparent">
            🔐 Đặt lại mật khẩu
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Nhập mật khẩu mới cho tài khoản của bạn
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-foreground">Mật khẩu mới</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 bg-background/50 border-divine-gold/20 focus:border-divine-gold"
                  required
                  minLength={6}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Tối thiểu 6 ký tự</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Xác nhận mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 bg-background/50 border-divine-gold/20 focus:border-divine-gold"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Mật khẩu không khớp
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !newPassword || !confirmPassword}
              className="w-full bg-divine-gold hover:bg-divine-gold/90 text-primary-foreground font-semibold"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang xử lý...</>
              ) : (
                "Đặt lại mật khẩu"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
