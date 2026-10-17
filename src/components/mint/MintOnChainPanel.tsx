import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFUNMoneyContract } from "@/hooks/useFUNMoneyContract";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Wallet,
  ArrowRight,
  RefreshCw,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { ethers } from "ethers";

interface MintRequest {
  id: string;
  action_id: string;
  amount: number;
  status: string;
  tx_hash: string | null;
  created_at: string;
  recipient_address: string;
}

export function MintOnChainPanel() {
  const { user } = useAuth();
  const {
    isConnected,
    address,
    connect,
    hasWallet,
    contractInfo,
    lockedGrants,
    requestPPLPLock,
    releaseLockedGrant,
    fetchContractInfo,
    mintStatus,
  } = useFUNMoneyContract();

  const [requests, setRequests] = useState<MintRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("pplp_mint_requests")
        .select("id, action_id, amount, status, tx_hash, created_at, recipient_address")
        .eq("actor_id", user.id)
        .in("status", ["pending", "minted", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setRequests((data as MintRequest[]) || []);
    } catch (err) {
      console.error("Failed to fetch mint requests:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleMintOnChain = async (request: MintRequest) => {
    if (!isConnected) {
      if (hasWallet) {
        await connect();
      } else {
        toast.error("Vui lòng cài đặt MetaMask để mint on-chain");
        return;
      }
    }

    setActionLoading(request.id);
    try {
      const result = await requestPPLPLock(request.action_id);
      if (result?.txHash) {
        toast.success("Mint on-chain thành công!");
        await fetchRequests();
        await fetchContractInfo();
      }
    } catch (err: any) {
      toast.error(err.message || "Mint thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReleaseGrant = async (index: number) => {
    setActionLoading(`release-${index}`);
    try {
      await releaseLockedGrant(index);
      await fetchContractInfo();
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) return null;

  const pendingRequests = requests.filter(r => r.status === "pending");
  const mintedRequests = requests.filter(r => r.status === "minted" || r.status === "confirmed");

  // Locked grants that can be released
  const releasableGrants = lockedGrants
    .map((g, i) => ({ ...g, index: i }))
    .filter(g => !g.released && BigInt(Math.floor(Date.now() / 1000)) >= g.releaseTime);
  const pendingGrants = lockedGrants
    .map((g, i) => ({ ...g, index: i }))
    .filter(g => !g.released && BigInt(Math.floor(Date.now() / 1000)) < g.releaseTime);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Đang tải...</span>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0 && lockedGrants.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Mint FUN On-chain
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchRequests}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallet Connection */}
        {!isConnected && (pendingRequests.length > 0 || lockedGrants.length > 0) && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Kết nối ví để mint</p>
              <p className="text-xs text-muted-foreground">Cần MetaMask trên BSC Testnet</p>
            </div>
            <Button size="sm" onClick={connect} disabled={!hasWallet}>
              {hasWallet ? "Kết nối ví" : "Cài MetaMask"}
            </Button>
          </div>
        )}

        {/* Releasable Locked Grants */}
        {isConnected && releasableGrants.length > 0 && (
          <div className="space-y-2 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Lock className="h-4 w-4 text-emerald-600" />
              Grants sẵn sàng giải phóng
            </h4>
            {releasableGrants.map((g) => (
              <div key={g.index} className="flex items-center justify-between">
                <span className="text-sm">
                  {parseFloat(ethers.formatUnits(g.amount, 18)).toLocaleString()} FUN
                </span>
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleReleaseGrant(g.index)}
                  disabled={actionLoading === `release-${g.index}`}
                >
                  {actionLoading === `release-${g.index}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Coins className="h-3.5 w-3.5" />
                  )}
                  Release
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Pending Locked Grants */}
        {pendingGrants.length > 0 && (
          <div className="space-y-2 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-4 w-4 text-amber-600" />
              Grants đang khóa
            </h4>
            {pendingGrants.map((g) => {
              const releaseDate = new Date(Number(g.releaseTime) * 1000);
              return (
                <div key={g.index} className="flex items-center justify-between text-sm">
                  <span>{parseFloat(ethers.formatUnits(g.amount, 18)).toLocaleString()} FUN</span>
                  <span className="text-xs text-muted-foreground">
                    Mở khóa: {releaseDate.toLocaleDateString("vi-VN")}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pending Requests */}
        {pendingRequests.map((req) => (
          <div key={req.id} className="p-3 rounded-lg border space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{req.amount.toLocaleString()} FUN</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(req.created_at).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                <Clock className="h-3 w-3" />
                Chờ xử lý
              </Badge>
            </div>
          </div>
        ))}

        {/* Minted Requests */}
        {mintedRequests.slice(0, 3).map((req) => (
          <div key={req.id} className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium">{req.amount.toLocaleString()} FUN</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                  Đã mint
                </Badge>
                {req.tx_hash && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => window.open(`https://testnet.bscscan.com/tx/${req.tx_hash}`, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
