import { useEffect, useMemo, useState } from "react";
import { ExternalLink, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layouts/AppLayout";

interface MovedToFunRichProps {
  targetUrl: string;
  featureName?: string;
}

export function MovedToFunRich({ targetUrl, featureName = "Tính năng này" }: MovedToFunRichProps) {
  // Preserve query params + hash from current URL
  const finalUrl = useMemo(() => {
    try {
      const url = new URL(targetUrl);
      if (typeof window !== "undefined") {
        const cur = new URL(window.location.href);
        cur.searchParams.forEach((v, k) => {
          if (!url.searchParams.has(k)) url.searchParams.append(k, v);
        });
        if (!url.hash && cur.hash) url.hash = cur.hash;
      }
      return url.toString();
    } catch {
      return targetUrl;
    }
  }, [targetUrl]);

  const [count, setCount] = useState(5);
  const [stayed, setStayed] = useState(false);
  const [phase, setPhase] = useState<"counting" | "redirecting" | "failed">("counting");

  useEffect(() => {
    if (stayed || phase !== "counting") return;
    if (count <= 0) {
      setPhase("redirecting");
      try {
        window.location.replace(finalUrl);
      } catch {
        setPhase("failed");
      }
      // Fallback nếu trình duyệt không rời trang sau 4s
      const fail = setTimeout(() => {
        if (!document.hidden) setPhase("failed");
      }, 4000);
      return () => clearTimeout(fail);
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, stayed, phase, finalUrl]);

  return (
    <AppLayout showFooter={false}>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] rounded-2xl p-8 shadow-2xl text-center">
          <div className="bg-white/95 rounded-xl p-6 space-y-4">
            <h1 className="text-2xl font-extrabold !text-black">
              {featureName} đã chuyển sang Fun.Rich
            </h1>
            <p className="text-sm text-foreground-muted">
              Angel A.I. giờ là hạ tầng trí tuệ cho hệ sinh thái FUN. Game & cộng đồng đã chuyển sang
              <span className="font-semibold"> Fun.Rich</span>.
            </p>

            {phase === "counting" && !stayed && (
              <p className="text-xs text-foreground-muted">
                Tự chuyển hướng sau <span className="font-bold text-primary">{count}s</span>…
              </p>
            )}
            {phase === "redirecting" && (
              <p className="text-xs text-primary inline-flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Đang chuyển sang fun.rich…
              </p>
            )}
            {phase === "failed" && (
              <p className="text-xs text-amber-700 inline-flex items-center justify-center gap-2">
                <AlertTriangle className="w-3 h-3" /> Không tự mở được. Bấm nút bên dưới để đi thủ công.
              </p>
            )}
            {stayed && phase === "counting" && (
              <p className="text-xs text-amber-700">Đã huỷ chuyển hướng tự động.</p>
            )}

            <div className="flex gap-2 justify-center pt-2">
              <Button
                onClick={() => window.location.assign(finalUrl)}
                className="bg-gradient-to-r from-[#b8860b] to-[#daa520] !text-black font-extrabold hover:opacity-90"
              >
                Đi ngay <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              {phase === "counting" && (
                <Button variant="outline" onClick={() => setStayed(true)}>
                  Ở lại Angel
                </Button>
              )}
              {phase === "failed" && (
                <Button
                  variant="outline"
                  onClick={() => window.open(finalUrl, "_blank", "noopener,noreferrer")}
                >
                  Mở tab mới
                </Button>
              )}
            </div>

            <a
              href={finalUrl}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 pt-2 break-all"
            >
              {finalUrl} <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default MovedToFunRich;
