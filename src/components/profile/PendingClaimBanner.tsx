import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

interface PendingClaim {
  total_fun: number;
  allocation_count: number;
  oldest_allocation_at: string | null;
  audit_group: "Aa" | "Ab" | "Ac" | null;
  notes: string | null;
}

export function PendingClaimBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["my-pending-claim", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_pending_claim");
      if (error) throw error;
      return data as unknown as PendingClaim;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Don't show for excluded users (Ac) or empty allocations
  if (!data || data.total_fun <= 0 || data.audit_group === "Ac") return null;

  return (
    <Card className="relative overflow-hidden border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 p-4 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent animate-pulse pointer-events-none" />
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="rounded-full bg-amber-500/20 p-2 shrink-0">
            <Coins className="w-5 h-5 text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base">
                Bạn có{" "}
                <span className="text-amber-500 text-lg">
                  {data.total_fun.toLocaleString()} FUN
                </span>{" "}
                chờ claim
              </h3>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.allocation_count} đợt phân bổ
              {data.oldest_allocation_at && (
                <>
                  {" "}
                  · Cũ nhất:{" "}
                  {formatDistanceToNow(new Date(data.oldest_allocation_at), {
                    addSuffix: true,
                    locale: vi,
                  })}
                </>
              )}
              {data.audit_group === "Ab" && (
                <span className="text-orange-500 ml-1">
                  · Lần claim trước thất bại — vui lòng thử lại
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate("/mint")}
          className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600 shrink-0"
          size="sm"
        >
          Claim ngay <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}
