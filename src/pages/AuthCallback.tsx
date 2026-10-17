import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { funProfile } from "@/lib/funProfile";
import { Sparkles } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");

        if (!code || !state) {
          setStatus("error");
          setErrorMsg("Thiếu thông tin xác thực từ FUN Profile.");
          return;
        }

        // Exchange code for tokens via SDK
        const result = await funProfile.handleCallback(code, state);

        if (!result?.accessToken) {
          setStatus("error");
          setErrorMsg("Không nhận được token từ FUN Profile.");
          return;
        }

        // Send token to bridge-login edge function
        // SECURITY: never send hint_email — server must derive identity only from verified token
        const bridgeUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bridge-login`;
        const res = await fetch(bridgeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fun_access_token: result.accessToken,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setStatus("error");
          setErrorMsg(errData.error || "Lỗi xác thực với hệ thống Angel AI.");
          return;
        }

        const { session } = await res.json();

        if (!session?.access_token || !session?.refresh_token) {
          setStatus("error");
          setErrorMsg("Không nhận được phiên đăng nhập.");
          return;
        }

        // Set Supabase session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        if (sessionError) {
          setStatus("error");
          setErrorMsg("Không thể thiết lập phiên đăng nhập: " + sessionError.message);
          return;
        }

        // Success - redirect home
        navigate("/", { replace: true });
      } catch (err) {
        console.error("SSO callback error:", err);
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gradient-to-b from-divine-deep via-background to-background" />
      <div className="relative z-10 text-center space-y-4">
        {status === "processing" ? (
          <>
            <Sparkles className="w-12 h-12 text-divine-gold animate-spin mx-auto" />
            <p className="text-lg text-foreground-muted">Đang đăng nhập từ FUN Profile...</p>
            <p className="text-sm text-muted-foreground">Vui lòng chờ trong giây lát ✨</p>
          </>
        ) : (
          <>
            <p className="text-lg text-destructive font-medium">Đăng nhập thất bại</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate("/auth", { replace: true })}
              className="text-divine-gold hover:text-divine-light underline text-sm"
            >
              Quay lại trang đăng nhập
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
