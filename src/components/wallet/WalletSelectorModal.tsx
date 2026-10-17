import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wallet, ExternalLink, Loader2, Smartphone } from "lucide-react";
import {
  detectWallets,
  subscribeWallets,
  requestProviders,
  initWalletDiscovery,
  setActiveProvider,
  getWalletDeepLink,
  getWalletDownloadUrl,
  isMobileDevice,
  WALLET_CATALOG,
  type DetectedWallet,
} from "@/lib/walletProviders";

interface WalletSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (provider: any) => void;
  isConnecting: boolean;
}

function WalletIcon({ icon }: { icon: string }) {
  if (icon?.startsWith("data:") || icon?.startsWith("http")) {
    return <img src={icon} alt="" className="w-7 h-7 rounded-md" loading="lazy" />;
  }
  return <span className="text-2xl leading-none">{icon}</span>;
}

export function WalletSelectorModal({
  open,
  onOpenChange,
  onSelect,
  isConnecting,
}: WalletSelectorModalProps) {
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const mobile = isMobileDevice();

  const refresh = useCallback(() => setDetectedWallets(detectWallets()), []);

  useEffect(() => {
    initWalletDiscovery();
    const unsub = subscribeWallets(refresh);
    return unsub;
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setConnectingId(null);
    requestProviders();
    refresh();
    // Late-injected extensions can announce after first paint.
    const t = setTimeout(() => {
      requestProviders();
      refresh();
    }, 350);
    return () => clearTimeout(t);
  }, [open, refresh]);

  const handleSelectWallet = (wallet: DetectedWallet) => {
    setConnectingId(wallet.id);
    setActiveProvider(wallet.provider, wallet);
    onSelect(wallet.provider);
  };

  const handleNotInstalled = (id: string) => {
    const deepLink = mobile ? getWalletDeepLink(id) : null;
    if (deepLink) {
      window.location.href = deepLink;
      return;
    }
    const url = getWalletDownloadUrl(id);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const detectedIds = new Set(detectedWallets.map((w) => w.id));
  const notInstalled = WALLET_CATALOG.filter((w) => !detectedIds.has(w.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" aria-hidden />
            Kết nối ví Web3
          </DialogTitle>
          <DialogDescription>
            Chọn ví bạn muốn sử dụng. Giao dịch hoàn toàn P2P, phi tập trung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2" role="list">
          {detectedWallets.length > 0 && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Đã phát hiện trên thiết bị
            </p>
          )}

          {detectedWallets.map((wallet) => (
            <button
              key={wallet.rdns || wallet.id}
              role="listitem"
              onClick={() => handleSelectWallet(wallet)}
              disabled={isConnecting}
              aria-label={`Kết nối ${wallet.name}`}
              className="w-full min-h-[56px] flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200 text-left disabled:opacity-50"
            >
              <WalletIcon icon={wallet.icon} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{wallet.name}</div>
                <div className="text-xs text-green-600 font-medium">
                  ✓ Đã cài đặt {wallet.source === "eip6963" ? "· EIP-6963" : ""}
                </div>
              </div>
              {connectingId === wallet.id && isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden />
              ) : (
                <span className="text-xs text-primary font-medium shrink-0">Kết nối →</span>
              )}
            </button>
          ))}

          {notInstalled.length > 0 && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-2">
              {mobile ? "Mở bằng ứng dụng ví" : "Ví khác (chưa cài đặt)"}
            </p>
          )}

          {notInstalled.map((wallet) => (
            <button
              key={wallet.id}
              role="listitem"
              onClick={() => handleNotInstalled(wallet.id)}
              aria-label={`${wallet.name} — ${mobile ? "mở ứng dụng" : "cài đặt"}`}
              className="w-full min-h-[52px] flex items-center gap-3 p-3 rounded-xl border border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-primary transition-all duration-200 text-left opacity-70 hover:opacity-100"
            >
              <span className="text-2xl grayscale leading-none">{wallet.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-muted-foreground truncate">
                  {wallet.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">{wallet.desc}</div>
              </div>
              {mobile && (wallet as any).deepLink ? (
                <Smartphone className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {detectedWallets.length === 0 && (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground">
              {mobile
                ? "Chọn một ví ở trên để mở angel.fun.rich trong trình duyệt của ví."
                : "Chưa phát hiện ví Web3 nào. Vui lòng cài đặt một ví ở trên."}
            </p>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Non-custodial · P2P · Angel không bao giờ hỏi seed phrase hay private key
        </p>
      </DialogContent>
    </Dialog>
  );
}
