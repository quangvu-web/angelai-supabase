import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMintCycle } from "@/hooks/useMintCycle";
import { useFUNMoneyContract } from "@/hooks/useFUNMoneyContract";
import { useSavedWalletAddress } from "@/hooks/useSavedWalletAddress";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2, CheckCircle2, Clock, ArrowRight, Wallet, AlertTriangle, Globe } from "lucide-react";
import { toast } from "sonner";
import { MintDestinationSelector, type MintDestination } from "./MintDestinationSelector";

export function ClaimFUNButton() {
  const { user } = useAuth();
  const { myAllocation } = useMintCycle();
  const { savedAddress } = useSavedWalletAddress();
  const {
    isConnected,
    connect,
    hasWallet,
    requestPPLPLock,
    mintStatus,
  } = useFUNMoneyContract();
  const [isClaiming, setIsClaiming] = useState(false);
  const [mintRequestId, setMintRequestId] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [mintDestination, setMintDestination] = useState<MintDestination>("angel_ai");

  if (!user || !myAllocation) return null;

  const funAmount = myAllocation.fun_allocated || 0;
  if (funAmount <= 0) return null;

  const hasValidWallet = savedAddress && savedAddress !== '0x0000000000000000000000000000000000000000' && /^0x[a-fA-F0-9]{40}$/.test(savedAddress);

  const status = myAllocation.status || "pending";
  const isAlreadyClaimed = status === "minted" || status === "claimed";
  const isPending = status === "pending" || status === "approved";
  const isSigned = status === "signed";

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Vui lòng đăng nhập để claim FUN");
        return;
      }

      const res = await supabase.functions.invoke("pplp-claim-fun", {
        body: { user_id: user.id, mint_destination: mintDestination },
      });

      if (res.error) throw res.error;
      const result = res.data;

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      if (result?.status === "already_claimed") {
        setMintRequestId(result.mint_request_id);
        setClaimStatus("queued");
        toast.info("Yêu cầu claim đã được tạo trước đó, đang chờ ký duyệt.");
      } else if (result?.status === "synced_to_fun_profile") {
        setMintRequestId(result.mint_request_id);
        setClaimStatus("synced_fun_profile");
        toast.success(`🌐 Đã gửi ${funAmount.toLocaleString()} FUN sang FUN Profile! Điểm sẽ được gộp vào epoch tiếp theo.`);
      } else if (result?.status === "queued") {
        setMintRequestId(result.mint_request_id);
        setClaimStatus("queued");
        toast.success(`🎉 Yêu cầu claim ${funAmount.toLocaleString()} FUN đã được gửi! Chờ GOV Attesters ký duyệt.`);
      } else if (result?.status === "no_allocation") {
        toast.info(result.error || "Không có phân bổ FUN đủ điều kiện.");
      } else {
        toast.success("Yêu cầu claim FUN đã được ghi nhận!");
      }
    } catch (err: any) {
      console.error("Claim FUN error:", err);
      toast.error(`Claim thất bại: ${err.message || "Vui lòng thử lại sau"}`);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleMintOnChain = async () => {
    if (!isConnected) {
      if (hasWallet) {
        await connect();
        return;
      }
      toast.error("Vui lòng cài đặt MetaMask");
      return;
    }

    const actionId = mintRequestId || `epoch_claim_${user.id}`;
    const result = await requestPPLPLock(actionId);
    if (result?.txHash) {
      toast.success("🎉 Mint on-chain thành công! Token đã được lock vào ví.");
      setClaimStatus("minted");
    }
  };

  const isDimmed = claimStatus === "queued" || claimStatus === "synced_fun_profile" || isSigned;

  return (
    <div className="space-y-3">
      {/* Destination selector - chỉ hiện khi chưa claim */}
      {isPending && !claimStatus && (
        <MintDestinationSelector
          value={mintDestination}
          onChange={setMintDestination}
          disabled={isClaiming}
        />
      )}

      {/* Wallet warning - chỉ hiện khi chọn Angel AI */}
      {!hasValidWallet && mintDestination === "angel_ai" && isPending && (
        <Card className="border-orange-300 dark:border-orange-700 bg-orange-50/80 dark:bg-orange-950/30">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
            <p className="text-xs text-orange-700 dark:text-orange-400">
              ⚠️ Bạn chưa kết nối ví MetaMask. Vui lòng kết nối ví trước khi yêu cầu claim FUN.
            </p>
            {hasWallet && (
              <Button size="sm" variant="outline" className="shrink-0 text-xs border-orange-300 text-orange-700" onClick={connect}>
                <Wallet className="h-3 w-3 mr-1" /> Kết nối ví
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Synced to FUN Profile status */}
      {claimStatus === "synced_fun_profile" && (
        <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 opacity-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {funAmount.toLocaleString()} FUN đã chuyển sang FUN Profile
              </p>
              <p className="text-xs text-muted-foreground">
                Điểm sẽ được gộp vào epoch tiếp theo của FUN Profile để mint on-chain.
              </p>
            </div>
            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Đã chuyển
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Angel AI mint flow - existing UI */}
      {claimStatus !== "synced_fun_profile" && (
        <Card className={`border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 transition-opacity duration-300 ${isDimmed ? "opacity-50" : ""}`}>
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-900/50">
                <Coins className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {funAmount.toLocaleString()} FUN đã được phân bổ cho bạn
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAlreadyClaimed || claimStatus === "minted"
                    ? "Đã mint on-chain thành công ✓"
                    : isSigned
                    ? "Đã ký duyệt 3/3 — sẵn sàng mint on-chain"
                    : claimStatus === "queued"
                    ? "Đang chờ GOV Attesters ký duyệt (0/3)"
                    : "Từ chu kỳ gần nhất"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isAlreadyClaimed || claimStatus === "minted" ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Đã mint
                </Badge>
              ) : isSigned ? (
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-1.5"
                  onClick={handleMintOnChain}
                  disabled={mintStatus.isLoading}
                >
                  {mintStatus.isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : !isConnected ? (
                    <>
                      <Wallet className="h-3.5 w-3.5" />
                      Kết nối ví & Mint
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-3.5 w-3.5" />
                      Mint On-chain
                    </>
                  )}
                </Button>
              ) : claimStatus === "queued" ? (
                <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                  <Clock className="h-3.5 w-3.5" /> Đang chờ ký duyệt
                </Badge>
              ) : isPending ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 dark:text-amber-400 gap-1.5"
                  onClick={() => {
                    if (mintDestination === "angel_ai" && !hasValidWallet) {
                      toast.warning("Vui lòng kết nối ví MetaMask trước khi claim FUN nhé! 🔗");
                      return;
                    }
                    handleClaim();
                  }}
                  disabled={isClaiming}
                >
                  {isClaiming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : mintDestination === "fun_profile" ? (
                    <Globe className="h-3.5 w-3.5" />
                  ) : (
                    <Coins className="h-3.5 w-3.5" />
                  )}
                  {mintDestination === "fun_profile" ? "Chuyển sang FUN Profile" : "Yêu cầu Claim FUN"}
                </Button>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <Clock className="h-3.5 w-3.5" /> Đang chờ duyệt
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
