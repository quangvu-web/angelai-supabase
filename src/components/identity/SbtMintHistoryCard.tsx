import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMySbtQueue } from "@/hooks/useZkAndOnchain";
import { OnChainStatusBadge } from "@/components/identity/OnChainStatusBadge";
import { History } from "lucide-react";

export function SbtMintHistoryCard() {
  const { data, isLoading } = useMySbtQueue();
  const items = data || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Lịch sử mint on-chain
          <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Chưa có SBT nào được gửi lên on-chain. Bấm <b>⛓️ Mint on-chain</b> trên thẻ SBT để bắt đầu.
          </p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {new Date(item.enqueued_at).toLocaleString("vi-VN")}
                  </div>
                  <div className="text-xs font-mono truncate">
                    {item.tx_hash ? `${item.tx_hash.slice(0, 22)}…` : `SBT: ${item.sbt_id.slice(0, 16)}…`}
                  </div>
                </div>
                <OnChainStatusBadge item={item} />
              </div>
            ))}
            {items.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                Hiển thị 10 / {items.length} mục gần nhất
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
