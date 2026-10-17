import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Loader2, ShieldAlert, Sparkles, Wallet } from "lucide-react";
import { useEnqueueSbtMint, useMySbtQueue } from "@/hooks/useZkAndOnchain";
import { useDID } from "@/hooks/useDID";
import { OnChainStatusBadge } from "@/components/identity/OnChainStatusBadge";
import { useNavigate } from "@/lib/router-compat";
import type { SBT } from "@/hooks/useSBTs";

interface Props {
  sbt: SBT;
}

export function MintSBTOnchainButton({ sbt }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: did } = useDID();
  const { data: queue } = useMySbtQueue();
  const enqueue = useEnqueueSbtMint();

  // Find existing queue item for this SBT
  const existing = useMemo(
    () => (queue || []).find((q) => q.sbt_id === sbt.id),
    [queue, sbt.id]
  );

  const wallet = did?.wallet_address || null;
  const hasWallet = !!wallet;
  const alreadyQueued = !!existing && existing.status !== "failed" && existing.status !== "cancelled";

  // If already minted/processing, just show status badge
  if (alreadyQueued) {
    return <OnChainStatusBadge item={existing} />;
  }

  const handleMint = () => {
    if (!hasWallet || !wallet) return;
    enqueue.mutate(
      {
        sbt_id: sbt.id,
        wallet_address: wallet,
        network: "bsc-testnet",
      },
      {
        onSuccess: (res) => {
          if (res?.success) setOpen(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="default"
          className="h-9 min-h-[36px] text-xs px-3 w-full"
          aria-label="Mint SBT lên BSC Testnet"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          ⛓️ Mint on-chain
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Mint SBT lên BSC Testnet
          </DialogTitle>
          <DialogDescription>
            Đưa SBT này vào hàng đợi để được khắc on-chain. Pipeline tự động xử lý mỗi 5 phút.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* SBT info */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">SBT</div>
            <div className="font-semibold capitalize text-sm">
              {sbt.sbt_subtype.replace(/_/g, " ")}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              Token: {sbt.token_id}
            </div>
          </div>

          {/* Wallet check */}
          {!hasWallet ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-sm">Chưa liên kết ví Web3</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cần liên kết ví BSC để khắc SBT on-chain. Ví sẽ được khoá vĩnh viễn với DID này.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-9 min-h-[36px]"
                onClick={() => {
                  setOpen(false);
                  navigate("/wallet");
                }}
              >
                <LinkIcon className="h-3.5 w-3.5 mr-1" />
                Liên kết ví Web3
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                Ví đích (đã khoá với DID)
              </div>
              <div className="font-mono text-xs break-all">{wallet}</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Mạng</span>
                <Badge variant="outline" className="text-[10px]">BSC Testnet (97)</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Phí gas</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Miễn phí (sponsored)</span>
              </div>
            </div>
          )}

          {existing?.status === "failed" && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <div className="font-medium">Lần mint trước thất bại — sẽ thử lại</div>
              {existing.error_message && (
                <div className="text-muted-foreground mt-1 break-all">{existing.error_message}</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="h-11 min-h-[44px] sm:flex-1"
            onClick={() => setOpen(false)}
          >
            Huỷ
          </Button>
          <Button
            className="h-11 min-h-[44px] sm:flex-1"
            disabled={!hasWallet || enqueue.isPending}
            onClick={handleMint}
          >
            {enqueue.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang gửi...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-1" /> Xác nhận mint</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
