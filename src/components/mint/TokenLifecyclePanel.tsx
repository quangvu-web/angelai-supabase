import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lock,
  Zap,
  Coins,
  Loader2,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Wallet,
  AlertCircle,
  Repeat,
  Globe,
  Database,
} from "lucide-react";
import { useFUNMoneyContract } from "@/hooks/useFUNMoneyContract";
import { useWalletMismatch } from "@/hooks/useWalletMismatch";
import { useFUNMoneyStats } from "@/hooks/useFUNMoneyStats";
import { useAuth } from "@/hooks/useAuth";
import { useWeb3WalletContext } from "@/contexts/Web3WalletContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ethers } from "ethers";
import { toast } from "sonner";

export function TokenLifecyclePanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { switchToBSC } = useWeb3WalletContext();
  const dbStats = useFUNMoneyStats(user?.id);
  const {
    isConnected,
    connect,
    address,
    hasWallet,
    chainId,
    contractInfo,
    lockedGrants,
    fetchContractInfo,
    releaseLockedGrant,
    mintStatus,
    networkDiagnostics,
    contractDiagnostics,
    walletError,
    resetBSCNetwork,
  } = useFUNMoneyContract();

  const [isReleasing, setIsReleasing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Calculate totals from locked grants
  const totalLocked = lockedGrants
    .filter(g => !g.released)
    .reduce((sum, g) => sum + parseFloat(ethers.formatUnits(g.amount, 18)), 0);
  const releasableGrants = lockedGrants
    .map((g, i) => ({ ...g, index: i }))
    .filter(g => !g.released && BigInt(Math.floor(Date.now() / 1000)) >= g.releaseTime);
  const releasableTotal = releasableGrants.reduce(
    (sum, g) => sum + parseFloat(ethers.formatUnits(g.amount, 18)), 0
  );

  const { mismatch } = useWalletMismatch(address, isConnected && totalLocked === 0);

  const [isLoadingOnChain, setIsLoadingOnChain] = useState(false);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (!isConnected || !address) return;
    let cancelled = false;
    const fetchWithRetry = async () => {
      setIsLoadingOnChain(true);
      retryCountRef.current = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        retryCountRef.current = attempt + 1;
        const result = await fetchContractInfo();
        if (result || cancelled) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setIsLoadingOnChain(false);
    };
    fetchWithRetry();
    return () => { cancelled = true; };
  }, [isConnected, address, fetchContractInfo]);

  useEffect(() => {
    if (!isConnected || !address) return;
    const interval = setInterval(() => fetchContractInfo(), 30_000);
    return () => clearInterval(interval);
  }, [isConnected, address, fetchContractInfo]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchContractInfo();
    setIsRefreshing(false);
  };

  const handleReleaseAll = async () => {
    if (releasableGrants.length === 0) {
      toast.info(t("mint.tokenLifecycle.noLocked"));
      return;
    }
    setIsReleasing(true);
    for (const grant of releasableGrants) {
      await releaseLockedGrant(grant.index);
    }
    await fetchContractInfo();
    setIsReleasing(false);
  };

  const handleSwitchWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    setIsSwitching(true);
    try {
      await (window as any).ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      toast.success("Đã chuyển ví! Đang tải lại dữ liệu...");
      setTimeout(() => fetchContractInfo(), 1000);
    } catch (e: any) {
      if (!e?.message?.includes("rejected")) {
        toast.error("Không thể chuyển ví. Vui lòng đổi ví thủ công trong MetaMask.");
      }
    } finally {
      setIsSwitching(false);
    }
  };

  const hasNetworkIssue = networkDiagnostics && !networkDiagnostics.isValidChain;
  const hasContractIssue = contractDiagnostics && !contractDiagnostics.isContractValid;

  if (!isConnected) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            {t("mint.tokenLifecycle.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              {t("mint.tokenLifecycle.connectPrompt")}
            </p>
            <Button
              onClick={connect}
              className="bg-gradient-to-r from-amber-500 to-orange-500"
              disabled={!hasWallet}
            >
              <Wallet className="mr-2 h-4 w-4" />
              {hasWallet ? t("mint.tokenLifecycle.connectButton") : t("mint.tokenLifecycle.installButton")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasNetworkIssue || hasContractIssue) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium text-sm">{t("mint.tokenLifecycle.networkError")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {walletError || networkDiagnostics?.rpcError || contractDiagnostics?.error}
          </p>
          <Button size="sm" variant="outline" onClick={() => resetBSCNetwork()}>
            <RefreshCw className="mr-1 h-3 w-3" />
            {t("mint.tokenLifecycle.resetBSC")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isConnected && isLoadingOnChain && !contractInfo) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            {t("mint.tokenLifecycle.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Đang tải dữ liệu on-chain... (lần {retryCountRef.current}/3)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="text-center p-3 rounded-lg bg-muted/30">
                <Skeleton className="h-4 w-4 mx-auto mb-1 rounded-full" />
                <Skeleton className="h-3 w-12 mx-auto mb-1" />
                <Skeleton className="h-6 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const contractNotAvailable = isConnected && !contractInfo && !hasNetworkIssue && !hasContractIssue;
  if (contractNotAvailable) {
    return (
      <Card className="border-amber-300 dark:border-amber-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            {t("mint.tokenLifecycle.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Globe className="h-4 w-4" />
              <span className="font-medium text-sm">Không thể đọc dữ liệu on-chain</span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Ví đang kết nối mạng <strong>chainId: {chainId || "N/A"}</strong>. 
              FUN Money contract chỉ có trên <strong>BSC Testnet (chainId: 97)</strong>.
            </p>
            <Button
              size="sm"
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              onClick={async () => {
                const ok = await switchToBSC();
                if (ok) setTimeout(() => fetchContractInfo(), 1500);
              }}
            >
              <Globe className="h-3.5 w-3.5 mr-1" />
              Chuyển sang BSC Testnet
            </Button>
          </div>

          {!dbStats.isLoading && (dbStats.totalMinted > 0 || dbStats.totalScored > 0) && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Database className="h-3 w-3" />
                <span>Dữ liệu từ hệ thống (chưa phải on-chain)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded bg-green-50 dark:bg-green-900/20">
                  <div className="text-xs text-muted-foreground">Đã mint on-chain</div>
                  <div className="text-sm font-bold text-green-600">
                    {dbStats.totalMinted.toLocaleString("vi-VN")} FUN
                  </div>
                </div>
                <div className="text-center p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                  <div className="text-xs text-muted-foreground">Sẵn sàng claim</div>
                  <div className="text-sm font-bold text-blue-600">
                    {dbStats.totalScored.toLocaleString("vi-VN")} FUN
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            {t("mint.tokenLifecycle.title")}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address display */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="h-3 w-3" />
          <span>{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          {address && (
            <a
              href={`https://testnet.bscscan.com/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Locked Grants & Releasable */}
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <Lock className="h-4 w-4 mx-auto text-orange-600 mb-1" />
            <div className="text-xs text-muted-foreground">{t("mint.tokenLifecycle.locked")}</div>
            <div className="text-lg font-bold text-orange-600">
              {totalLocked.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}
            </div>
          </div>

          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <Coins className="h-4 w-4 mx-auto text-green-600 mb-1" />
            <div className="text-xs text-muted-foreground">Sẵn sàng release</div>
            <div className="text-lg font-bold text-green-600">
              {releasableTotal.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500"
            onClick={handleReleaseAll}
            disabled={isReleasing || releasableGrants.length === 0}
          >
            {isReleasing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Coins className="h-3.5 w-3.5 mr-1" />
            )}
            Release Grants
            {releasableGrants.length > 0 && <ArrowRight className="h-3 w-3 ml-1" />}
          </Button>
        </div>

        {/* Error display */}
        {mintStatus.error && (
          <p className="text-xs text-destructive text-center">{mintStatus.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
