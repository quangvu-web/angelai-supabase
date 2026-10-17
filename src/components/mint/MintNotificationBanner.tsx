import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, Coins, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";

export function MintNotificationBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: notification } = useQuery({
    queryKey: ["mint-notification", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Use pplp_mint_requests as single source of truth
      const { data: latestReq } = await supabase
        .from("pplp_mint_requests")
        .select("amount, status, created_at, tx_hash")
        .eq("actor_id", user.id)
        .in("status", ["pending_sig", "signed", "pending", "approved", "minted", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestReq) return null;

      const amount = latestReq.amount || 0;
      if (amount <= 0) return null;

      // Check if it's within last 7 days (fresh notification)
      const createdAt = new Date(latestReq.created_at);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (createdAt < sevenDaysAgo) return null;

      const isOnchain = latestReq.status === "minted" || latestReq.status === "confirmed" || !!latestReq.tx_hash;

      return { amount, isOnchain, createdAt: latestReq.created_at };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (!notification) return null;

  return (
    <Alert className={`border-amber-300 dark:border-amber-700 ${
      notification.isOnchain
        ? "bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-300 dark:border-emerald-700"
        : "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30"
    }`}>
      {notification.isOnchain ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Bell className="h-4 w-4 text-amber-600" />
      )}
      <AlertTitle className={notification.isOnchain ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
        {notification.isOnchain
          ? `🎉 ${notification.amount.toLocaleString()} FUN đã được lock on-chain!`
          : `✨ ${notification.amount.toLocaleString()} FUN đã sẵn sàng cho bạn!`}
      </AlertTitle>
      <AlertDescription className="flex items-center justify-between mt-1">
        <span className={`text-sm ${notification.isOnchain ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
          {notification.isOnchain
            ? "FUN đã lock on-chain. Vào trang Mint để Activate & Claim về ví."
            : "FUN từ chu kỳ gần nhất đã được phân bổ. Xem chi tiết tại trang Mint."}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 shrink-0"
          onClick={() => {
            const scrollToHistory = () => {
              const el = document.getElementById("epoch-allocation-history");
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" });
                return true;
              }
              return false;
            };

            if (location.pathname === "/mint") {
              if (!scrollToHistory()) {
                // Element may not be rendered yet — retry after short delay
                setTimeout(() => scrollToHistory(), 300);
              }
              return;
            }
            navigate("/mint");
            // After navigation, scroll once DOM settles
            setTimeout(() => scrollToHistory(), 500);
          }}
        >
          Xem chi tiết <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
