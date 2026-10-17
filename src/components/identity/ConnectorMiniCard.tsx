import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useConnectorStats } from "@/hooks/useConnectorStats";
import { useEffect, useState } from "react";

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "Đã hết";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export function ConnectorMiniCard() {
  const { data, isLoading } = useConnectorStats();
  const expiresAt = data?.profile?.connector_window_expires_at ?? null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasConnector = !!data?.profile?.has_connector;
  const connecteeCount = data?.connectees?.length ?? 0;
  const remainingMs = expiresAt ? new Date(expiresAt).getTime() - now : 0;
  const inWindow = !hasConnector && remainingMs > 0;

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#b8860b]/10 via-[#daa520]/5 to-[#ffd700]/10" />
      <CardContent className="relative p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#daa520]" />
            <span className="text-sm font-semibold">Connector of Light</span>
          </div>
          {hasConnector && (
            <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">
              ✓ Đã có
            </span>
          )}
        </div>

        {hasConnector ? (
          <p className="text-xs text-muted-foreground">
            Bạn đã có Connector. Đã kết nối <span className="font-bold text-foreground">{connecteeCount}</span> người mới.
          </p>
        ) : inWindow ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Người gửi token on-chain đầu tiên cho bạn sẽ trở thành Connector.
            </p>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-[#daa520]" />
              <span className="font-mono font-semibold">Còn lại: {fmtCountdown(remainingMs)}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Cửa sổ Connector đã đóng. Bạn vẫn có thể là Connector cho người mới.
          </p>
        )}

        <Button asChild size="sm" variant="outline" className="w-full">
          <Link to="/connector" className="flex items-center justify-center gap-1">
            Mở trang Connector <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
