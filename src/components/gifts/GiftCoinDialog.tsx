import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Gift, Search, Loader2, Sparkles, User, Wallet, ArrowLeft, ArrowRight, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCoinGifts } from "@/hooks/useCoinGifts";
import { useCamlyCoin } from "@/hooks/useCamlyCoin";
import { useWeb3Transfer } from "@/hooks/useWeb3Transfer";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";
import { GiftCelebrationModal, type CelebrationData } from "./GiftCelebrationModal";
import { CryptoTransferTab } from "./CryptoTransferTab";
import { TokenSelector, type SelectedToken } from "./TokenSelector";
import camlyCoinLogo from "@/assets/camly-coin-logo.png";
import funMoneyLogo from "@/assets/fun-money-logo.png";
import { Link } from "react-router-dom";

interface GiftCoinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedUser?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  contextType?: string;
  contextId?: string;
}

interface UserSearchResult {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

const QUICK_AMOUNTS_MAP: Record<SelectedToken, number[]> = {
  internal: [10000, 50000, 100000, 500000, 1000000],
  camly_web3: [10000, 50000, 100000, 500000, 1000000],
  fun_money: [10, 50, 100, 500, 1000],
  bnb: [0.01, 0.05, 0.1, 0.5],
  usdt: [5, 10, 50, 100],
  bitcoin: [0.001, 0.005, 0.01, 0.05],
};

export function GiftCoinDialog({ open, onOpenChange, preselectedUser, contextType, contextId }: GiftCoinDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { sendGift, isLoading } = useCoinGifts();
  const { balance } = useCamlyCoin();
  const {
    isTransferring,
    camlyCoinBalance,
    funMoneyBalance,
    usdtBalance,
    usdcBalance,
    bnbBalance,
    fetchCamlyBalance,
    fetchFunMoneyBalance,
    fetchUsdtBalance,
    fetchUsdcBalance,
    fetchBnbBalance,
    transferCamly,
    transferFunMoney,
    transferUsdt,
    transferUsdc,
    transferBnb,
    isConnected,
    address,
    hasWallet,
    connect,
  } = useWeb3Transfer();

  const [selfGiftWarning, setSelfGiftWarning] = useState(false);
  const [activeTab, setActiveTab] = useState<SelectedToken>("internal");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);
  const [recipientSuspended, setRecipientSuspended] = useState<{ isSuspended: boolean; isPermanent: boolean } | null>(null);

  // Step flow for internal Camly Coin: 1 = input, 2 = confirm
  const [internalStep, setInternalStep] = useState<1 | 2>(1);

  // Sender profile info
  const [senderProfile, setSenderProfile] = useState<{ display_name: string | null; avatar_url: string | null; wallet_address: string | null }>({ display_name: null, avatar_url: null, wallet_address: null });

  useEffect(() => {
    if (user?.id) {
      supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) setSenderProfile(prev => ({ ...prev, display_name: data.display_name, avatar_url: data.avatar_url }));
      });
      supabase.from("user_wallet_addresses").select("wallet_address").eq("user_id", user.id).maybeSingle().then(({ data }) => {
        if (data) setSenderProfile(prev => ({ ...prev, wallet_address: data.wallet_address }));
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (preselectedUser) {
      setSelectedUser({
        user_id: preselectedUser.id,
        display_name: preselectedUser.display_name,
        avatar_url: preselectedUser.avatar_url,
      });
    }
  }, [preselectedUser]);

  useEffect(() => {
    if (!open) {
      if (!preselectedUser) {
        setSelectedUser(null);
      }
      setAmount("");
      setMessage("");
      setSearchQuery("");
      setSearchResults([]);
      setInternalStep(1);
      setRecipientSuspended(null);
    }
  }, [open, preselectedUser]);

  // Check if selected user is suspended
  useEffect(() => {
    const checkSuspension = async () => {
      if (!selectedUser) { setRecipientSuspended(null); return; }
      const { data } = await supabase
        .from("user_suspensions")
        .select("suspended_until")
        .eq("user_id", selectedUser.user_id)
        .is("lifted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        const isPermanent = !data.suspended_until || new Date(data.suspended_until) > new Date("2099-01-01");
        setRecipientSuspended({ isSuspended: true, isPermanent });
      } else {
        setRecipientSuspended(null);
      }
    };
    checkSuspension();
  }, [selectedUser?.user_id]);

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .ilike("display_name", `%${query}%`)
        .limit(5);

      if (!error && data) {
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Auto-send DM to receiver
  const autoSendDM = async (celData: CelebrationData) => {
    try {
      // Validate receiver_id is a valid UUID (not empty or wallet address)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!celData.receiver_id || !uuidRegex.test(celData.receiver_id)) {
        console.log("[AutoDM] Skipped: receiver_id is not a valid UUID:", celData.receiver_id);
        return;
      }
      if (!user?.id) {
        console.log("[AutoDM] Skipped: no authenticated user");
        return;
      }
      if (celData.receiver_id === user.id) {
        console.log("[AutoDM] Skipped: cannot DM yourself");
        return;
      }
      console.log("[AutoDM] Sending DM to:", celData.receiver_id);
      const tokenLabel = celData.tokenType === "fun_money" ? "FUN Money"
        : celData.tokenType === "camly_web3" ? "CAMLY"
        : celData.tokenType === "usdt" ? "USDT"
        : celData.tokenType === "bnb" ? "BNB"
        : celData.tokenType === "bitcoin" ? "BTC"
        : "Camly Coin";
      const receiptLink = celData.receipt_public_id
        ? `${window.location.origin}/receipt/${celData.receipt_public_id}`
        : "";
      const msgContent = `🎁 Chúc mừng ${celData.receiver_name}! Bạn nhận được ${celData.amount.toLocaleString()} ${tokenLabel} từ ${celData.sender_name}.${celData.message ? `\nLời nhắn: "${celData.message}"` : ""}${receiptLink ? `\nXem biên nhận: ${receiptLink}` : ""}`;

      const { error } = await supabase.from("direct_messages").insert({
        sender_id: user.id,
        receiver_id: celData.receiver_id,
        content: msgContent,
        message_type: "tip_receipt",
        metadata: {
          amount: celData.amount,
          token_type: celData.tokenType,
          token_symbol: tokenLabel,
          sender_name: celData.sender_name,
          receiver_name: celData.receiver_name,
          sender_avatar: celData.sender_avatar,
          receiver_avatar: celData.receiver_avatar,
          tx_hash: celData.tx_hash,
          receipt_public_id: celData.receipt_public_id,
          explorer_url: celData.explorerUrl,
          message: celData.message,
          created_at: new Date().toISOString(),
        },
      });
      if (error) {
        console.error("[AutoDM] Insert failed:", error);
      } else {
        console.log("[AutoDM] DM sent successfully to:", celData.receiver_id);
        toast.success("Đã tự động gửi tin nhắn cho người nhận! 💌");
      }
    } catch (err) {
      console.warn("[AutoDM] Error:", err);
    }
  };

  // Auto-post celebration to community newsfeed
  const autoPostCelebration = async (celData: CelebrationData, tokenSymbol: string) => {
    try {
      if (!user?.id) return;
      const tokenLabel = tokenSymbol === "FUN" ? "FUN Money"
        : tokenSymbol === "CAMLY" ? "CAMLY"
        : tokenSymbol === "USDT" ? "USDT"
        : tokenSymbol === "BNB" ? "BNB"
        : tokenSymbol === "BTC" ? "BTC"
        : "Token";
      const content = `🎁 ${celData.sender_name} đã tặng ${celData.amount.toLocaleString()} ${tokenLabel} cho ${celData.receiver_name}! ✨${celData.message ? `\n💬 "${celData.message}"` : ""}\n✨ ANGEL AI, LAN TOẢ YÊU THƯƠNG ✨`;

      const { error } = await supabase.from("community_posts").insert({
        user_id: user.id,
        content,
        post_type: "celebration",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          gift_type: "web3",
          token_type: celData.tokenType,
          token_symbol: tokenLabel,
          amount: celData.amount,
          sender_name: celData.sender_name,
          sender_avatar: celData.sender_avatar,
          receiver_id: celData.receiver_id,
          receiver_name: celData.receiver_name,
          receiver_avatar: celData.receiver_avatar,
          tx_hash: celData.tx_hash,
          receipt_public_id: celData.receipt_public_id,
          explorer_url: celData.explorerUrl,
          message: celData.message,
          created_at: new Date().toISOString(),
        },
        slug: `celebration-${Date.now()}`,
      } as any);
      if (error) {
        console.error("[AutoPost] Insert failed:", error);
      } else {
        console.log("[AutoPost] Celebration post created successfully");
      }
    } catch (err) {
      console.warn("[AutoPost] Error:", err);
    }
  };

  // Auto-send notification to receiver
  const autoSendNotification = async (celData: CelebrationData, tokenSymbol: string) => {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!celData.receiver_id || !uuidRegex.test(celData.receiver_id)) return;
      if (!user?.id || celData.receiver_id === user.id) return;

      const tokenLabel = tokenSymbol === "FUN" ? "FUN Money"
        : tokenSymbol === "CAMLY" ? "CAMLY"
        : tokenSymbol === "USDT" ? "USDT"
        : tokenSymbol === "BNB" ? "BNB"
        : tokenSymbol === "BTC" ? "BTC"
        : "Token";

      const { error } = await supabase.from("notifications").insert({
        user_id: celData.receiver_id,
        type: "gift_received",
        title: "🎁 Bạn nhận được quà!",
        content: `${celData.sender_name} đã tặng bạn ${celData.amount.toLocaleString()} ${tokenLabel} on-chain`,
        actor_id: user.id,
        reference_type: "gift",
        metadata: {
          amount: celData.amount,
          token_type: celData.tokenType,
          tx_hash: celData.tx_hash,
        },
      });
      if (error) {
        console.error("[AutoNotify] Insert failed:", error);
      } else {
        console.log("[AutoNotify] Notification sent to:", celData.receiver_id);
      }
    } catch (err) {
      console.warn("[AutoNotify] Error:", err);
    }
  };

  const handleSendGift = async () => {
    if (!selectedUser || !amount) return;

    if (user?.id === selectedUser.user_id) {
      setSelfGiftWarning(true);
      return;
    }

    const numAmount = Number(amount);
    if (numAmount < 10) {
      toast.error("Số lượng tối thiểu là 10 Camly Coin");
      return;
    }

    if (numAmount > balance) {
      toast.error(t("gift.insufficientBalance"));
      return;
    }

    try {
      const result = await sendGift(selectedUser.user_id, numAmount, message, contextType, contextId);

      if (result.success) {
        try {
          await supabase.rpc("update_popl_score", {
            _user_id: user!.id,
            _action_type: "donate",
            _is_positive: true,
          });
          await supabase.rpc("add_light_points", {
            _user_id: user!.id,
            _points: 5,
            _reason: `Tặng ${numAmount.toLocaleString()} Camly Coin`,
            _source_type: "internal_gift",
          });
        } catch (e) {
          console.warn("[GiftCoin] PoPL/Light update failed:", e);
        }

        setCelebrationData({
          receipt_public_id: result.data?.receipt_public_id || "",
          sender_id: user?.id || "",
          sender_name: result.data?.sender_name || senderProfile.display_name || "Bạn",
          sender_avatar: result.data?.sender_avatar || senderProfile.avatar_url,
          receiver_id: selectedUser.user_id,
          receiver_name: selectedUser.display_name || "Người nhận",
          receiver_avatar: selectedUser.avatar_url,
          amount: numAmount,
          message: message || null,
          tokenType: "internal",
        });
        onOpenChange(false);
        setShowCelebration(true);

        // Auto-send DM
        const celDataForDM: CelebrationData = {
          receipt_public_id: result.data?.receipt_public_id || "",
          sender_id: user?.id || "",
          sender_name: result.data?.sender_name || senderProfile.display_name || "Bạn",
          sender_avatar: result.data?.sender_avatar || senderProfile.avatar_url,
          receiver_id: selectedUser.user_id,
          receiver_name: selectedUser.display_name || "Người nhận",
          receiver_avatar: selectedUser.avatar_url,
          amount: numAmount,
          message: message || null,
          tokenType: "internal",
        };
        autoSendDM(celDataForDM);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error("[GiftCoin] Send gift error:", error);
      toast.error("Lỗi gửi thưởng. Vui lòng thử lại.");
    }
  };

  // Shared handler for crypto transfer success
  const handleCryptoSuccess = async (
    result: { txHash?: string },
    recipientUser: UserSearchResult | null,
    targetAddress: string,
    transferAmount: number,
    tokenSymbol: string,
    cryptoMessage?: string
  ) => {
    let senderName = senderProfile.display_name || "Bạn";
    let senderAvatar: string | null = senderProfile.avatar_url;
    if (!senderProfile.display_name) {
      try {
        const { data: sp } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (sp) {
          senderName = sp.display_name || "Bạn";
          senderAvatar = sp.avatar_url;
        }
      } catch (e) {
        console.warn("[Web3 Gift] Could not fetch sender profile:", e);
      }
    }

    const tokenTypeMap: Record<string, string> = {
      CAMLY: "camly_web3",
      FUN: "fun_money",
      USDT: "usdt",
      USDC: "usdc",
      BNB: "bnb",
      BTC: "bitcoin",
    };
    const resolvedTokenType = tokenTypeMap[tokenSymbol] || "camly_web3";
    const resolvedExplorer = tokenSymbol === "FUN" ? "https://testnet.bscscan.com" : "https://bscscan.com";

    try {
      await supabase.rpc("update_popl_score", {
        _user_id: user!.id,
        _action_type: "donate",
        _is_positive: true,
      });
    } catch (e) {
      console.warn("[Web3 Gift] PoPL score update failed:", e);
    }

    try {
      await supabase.rpc("add_light_points", {
        _user_id: user!.id,
        _points: 10,
        _reason: `Tặng thưởng ${transferAmount} ${tokenSymbol} on-chain`,
        _source_type: "web3_gift",
      });
    } catch (e) {
      console.warn("[Web3 Gift] Light points update failed:", e);
    }

    setCelebrationData({
      receipt_public_id: "",
      sender_id: user!.id,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      receiver_id: recipientUser?.user_id || "",
      receiver_name: recipientUser?.display_name || `${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`,
      receiver_avatar: recipientUser?.avatar_url || null,
      amount: transferAmount,
      message: cryptoMessage || null,
      tx_hash: result.txHash || null,
      tokenType: resolvedTokenType as any,
      explorerUrl: resolvedExplorer,
    });
    onOpenChange(false);
    setShowCelebration(true);

    const celDataFull: CelebrationData = {
      receipt_public_id: "",
      sender_id: user!.id,
      sender_name: senderName,
      sender_avatar: senderAvatar,
      receiver_id: recipientUser?.user_id || "",
      receiver_name: recipientUser?.display_name || `${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`,
      receiver_avatar: recipientUser?.avatar_url || null,
      amount: transferAmount,
      message: cryptoMessage || null,
      tx_hash: result.txHash || null,
      tokenType: resolvedTokenType as any,
      explorerUrl: resolvedExplorer,
    };

    // Auto-send DM
    autoSendDM(celDataFull);

    // Auto-post celebration to community newsfeed (expires after 24h)
    autoPostCelebration(celDataFull, tokenSymbol);

    // Auto-send notification to receiver
    autoSendNotification(celDataFull, tokenSymbol);
  };

  const numAmount = Number(amount);
  const canProceedToConfirm = selectedUser && numAmount >= 10 && numAmount <= balance;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã sao chép!");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto bg-gradient-to-b from-amber-50/30 via-background to-amber-50/20 border-amber-200/60 shadow-[0_0_30px_-5px_rgba(218,165,32,0.15)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-600" />
              <span className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] bg-clip-text text-transparent font-bold">{t("gift.title")}</span>
            </DialogTitle>
            <p className="text-xs text-amber-700/70 font-medium">Angel AI Gift System ✨</p>
          </DialogHeader>

          {/* Token Selector Dropdown */}
          <div className="space-y-4">
            <TokenSelector
              selected={activeTab}
              onSelect={(token) => { setActiveTab(token); setInternalStep(1); }}
              balanceLabel={
                activeTab === "internal" ? `Số dư: ${balance.toLocaleString()} CAMLY`
                : activeTab === "camly_web3" ? `Số dư: ${Number(camlyCoinBalance).toLocaleString()} CAMLY`
                : activeTab === "fun_money" ? `Số dư: ${Number(funMoneyBalance).toLocaleString()} FUN`
                : activeTab === "bnb" ? `Số dư: ${Number(bnbBalance).toLocaleString()} BNB`
                : activeTab === "usdt" ? `Số dư: ${Number(usdtBalance).toLocaleString()} USDT`
                : activeTab === "bitcoin" ? `Số dư: BTC`
                : undefined
              }
            />

            {/* ==================== INTERNAL CAMLY COIN - 2-STEP FLOW ==================== */}
            {activeTab === "internal" && (
              <AnimatePresence mode="wait">
                {/* ========== STEP 1: NHẬP THÔNG TIN ========== */}
                {internalStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Người gửi */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-amber-800">Người gửi</label>
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50/50 to-yellow-50/30 rounded-xl border border-amber-200/60">
                        <Avatar className="h-10 w-10 ring-2 ring-amber-400/40">
                          <AvatarImage src={senderProfile.avatar_url || ""} />
                          <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{senderProfile.display_name || "Bạn"}</p>
                          {senderProfile.wallet_address && (
                            <button onClick={() => copyText(senderProfile.wallet_address!)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                              {senderProfile.wallet_address.slice(0, 6)}...{senderProfile.wallet_address.slice(-4)}
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Người nhận */}
                    {!selectedUser ? (
                      <div className="space-y-2">
                      <label className="text-sm font-medium text-amber-800">Người nhận 💝</label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder={t("gift.searchPlaceholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                          {isSearching && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                          )}
                        </div>
                        {searchResults.length > 0 && (
                          <div className="border rounded-xl divide-y max-h-48 overflow-y-auto">
                            {searchResults.map((searchUser) => (
                              <button
                                key={searchUser.user_id}
                                className="w-full p-2.5 flex items-center gap-3 hover:bg-accent/50 text-left transition-colors"
                                onClick={() => {
                                  setSelfGiftWarning(false);
                                  setSelectedUser(searchUser);
                                  setSearchQuery("");
                                  setSearchResults([]);
                                }}
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={searchUser.avatar_url || ""} />
                                  <AvatarFallback><User className="w-4 h-4" /></AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">{searchUser.display_name || "Người dùng"}</span>
                                {searchUser.user_id === user?.id && (
                                  <span className="text-xs text-muted-foreground ml-auto">(Bạn)</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-amber-800">Người nhận 💝</label>
                        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50/50 to-yellow-50/30 rounded-xl border border-amber-200/60">
                          <Avatar className="h-10 w-10 ring-2 ring-amber-400/40">
                            <AvatarImage src={selectedUser.avatar_url || ""} />
                            <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{selectedUser.display_name || "Người dùng"}</p>
                          </div>
                          {!preselectedUser && (
                            <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>
                              {t("common.change")}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Suspended Recipient Warning */}
                    {recipientSuspended?.isSuspended && (
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
                        recipientSuspended.isPermanent
                          ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
                          : "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800"
                      }`}>
                        <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${recipientSuspended.isPermanent ? "text-red-500" : "text-orange-500"}`} />
                        <p className={`text-xs font-medium ${recipientSuspended.isPermanent ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"}`}>
                          {recipientSuspended.isPermanent
                            ? "🚫 Tài khoản này đã bị cấm vĩnh viễn. Phần thưởng sẽ không được chuyển đến."
                            : "⚠️ Tài khoản này đang bị đình chỉ. Phần thưởng có thể bị đóng băng."}
                        </p>
                      </div>
                    )}

                    {/* Self-Gift Warning */}
                    <AnimatePresence>
                      {selfGiftWarning && selectedUser?.user_id === user?.id && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-destructive/10 border border-destructive/20 rounded-xl p-4"
                        >
                          <div className="flex items-start gap-3">
                            <Heart className="w-5 h-5 text-destructive mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-destructive mb-1">Yêu thương bản thân là tuyệt vời! 💕</p>
                              <p className="text-sm text-destructive/80">Nhưng món quà sẽ ý nghĩa hơn khi chia sẻ với người khác.</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full border-destructive/20 text-destructive"
                            onClick={() => { setSelfGiftWarning(false); setSelectedUser(null); }}
                          >
                            Chọn người nhận khác
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Số tiền + Mức nhanh */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-amber-800">{t("gift.amount")} 💰</label>
                      <div className="flex gap-2 flex-wrap">
                        {QUICK_AMOUNTS_MAP[activeTab].map((qa) => (
                          <button
                            key={qa}
                            type="button"
                            onClick={() => setAmount(String(qa))}
                            className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                              Number(amount) === qa
                                ? "bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] text-black border-amber-500 shadow-[0_0_12px_-3px_rgba(218,165,32,0.4)]"
                                : "border-amber-200 hover:border-amber-400 text-foreground bg-amber-50/30"
                            }`}
                          >
                            {qa.toLocaleString()}
                          </button>
                        ))}
                      </div>
                      <Input
                        type="number"
                        placeholder="Hoặc nhập số tùy chỉnh"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        min={10}
                        max={balance}
                      />
                      <p className="text-xs text-muted-foreground">Tối thiểu 10 Camly Coin • Số dư: {balance.toLocaleString()}</p>
                    </div>

                    {/* Lời nhắn */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-amber-800">Lời nhắn yêu thương 💌</label>
                      <Textarea
                        placeholder={t("gift.messagePlaceholder")}
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, 200))}
                        rows={2}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground text-right">{message.length}/200</p>
                    </div>

                    {/* Nút Xem lại & Xác nhận */}
                    <Button
                      onClick={() => {
                        if (user?.id === selectedUser?.user_id) {
                          setSelfGiftWarning(true);
                          return;
                        }
                        setInternalStep(2);
                      }}
                      disabled={!canProceedToConfirm}
                      className="w-full btn-golden-3d !text-black font-bold"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Xem lại & Xác nhận
                    </Button>
                  </motion.div>
                )}

                {/* ========== STEP 2: XÁC NHẬN ========== */}
                {internalStep === 2 && selectedUser && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="text-center mb-2">
                      <h3 className="font-bold text-lg bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] bg-clip-text text-transparent">Xác nhận tặng thưởng</h3>
                      <p className="text-xs text-muted-foreground">Vui lòng kiểm tra thông tin trước khi gửi</p>
                    </div>

                    {/* Confirmation Card */}
                    <div className="bg-gradient-to-br from-amber-50/80 to-yellow-50/40 rounded-2xl p-4 space-y-4 border border-amber-200">
                      {/* Người gửi */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 ring-2 ring-amber-400/40">
                          <AvatarImage src={senderProfile.avatar_url || ""} />
                          <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Người gửi</p>
                          <p className="font-bold text-sm truncate">{senderProfile.display_name || "Bạn"}</p>
                        </div>
                      </div>

                      {/* Arrow + Amount */}
                      <div className="flex items-center justify-center gap-3 py-2">
                        <div className="h-px flex-1 bg-border" />
                        <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-full border shadow-sm">
                          <img src={camlyCoinLogo} alt="CAMLY" className="w-5 h-5 rounded-full" />
                          <span className="text-lg font-bold text-primary">{numAmount.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground font-medium">CAMLY</span>
                        </div>
                        <div className="h-px flex-1 bg-border" />
                      </div>

                      {/* Người nhận */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 ring-2 ring-amber-400/40">
                          <AvatarImage src={selectedUser.avatar_url || ""} />
                          <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Người nhận</p>
                          <p className="font-bold text-sm truncate">{selectedUser.display_name || "Người dùng"}</p>
                        </div>
                      </div>

                      {/* Lời nhắn */}
                      {message && (
                        <div className="bg-background/80 rounded-xl p-3 border border-border/50">
                          <p className="text-xs text-muted-foreground mb-1">Lời nhắn</p>
                          <p className="text-sm italic">"{message}"</p>
                        </div>
                      )}
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2 p-3 bg-destructive/5 rounded-xl border border-destructive/10">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive/80">
                        Giao dịch nội bộ sẽ được xử lý ngay lập tức và không thể hoàn tác.
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setInternalStep(1)}
                        className="flex-1"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Quay lại
                      </Button>
                      <Button
                        onClick={handleSendGift}
                        disabled={isLoading}
                        className="flex-1 btn-golden-3d !text-black font-bold"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
                        Xác nhận & Tặng
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            {/* ==================== WEB3 TABS ==================== */}
            {/* CAMLY Web3 */}
            {activeTab === "camly_web3" && (
              <CryptoTransferTab
                tokenType="camly" tokenSymbol="CAMLY" tokenBalance={camlyCoinBalance}
                isConnected={isConnected} isTransferring={isTransferring} address={address}
                hasWallet={hasWallet} explorerUrl="https://bscscan.com" accentColor="orange"
                preselectedUser={preselectedUser ? { user_id: preselectedUser.id, display_name: preselectedUser.display_name, avatar_url: preselectedUser.avatar_url } : null}
                onConnect={connect} onTransfer={transferCamly} onFetchBalance={fetchCamlyBalance}
                onSuccess={(r, u, a, amt, msg) => handleCryptoSuccess(r, u, a, amt, "CAMLY", msg)}
              />
            )}

            {/* FUN Money */}
            {activeTab === "fun_money" && (
              <CryptoTransferTab
                tokenType="fun" tokenSymbol="FUN" tokenBalance={funMoneyBalance}
                isConnected={isConnected} isTransferring={isTransferring} address={address}
                hasWallet={hasWallet} explorerUrl="https://testnet.bscscan.com" accentColor="violet"
                preselectedUser={preselectedUser ? { user_id: preselectedUser.id, display_name: preselectedUser.display_name, avatar_url: preselectedUser.avatar_url } : null}
                onConnect={connect} onTransfer={transferFunMoney} onFetchBalance={fetchFunMoneyBalance}
                onSuccess={(r, u, a, amt, msg) => handleCryptoSuccess(r, u, a, amt, "FUN", msg)}
              />
            )}

            {/* BNB */}
            {activeTab === "bnb" && (
              <CryptoTransferTab
                tokenType="bnb" tokenSymbol="BNB" tokenBalance={bnbBalance}
                isConnected={isConnected} isTransferring={isTransferring} address={address}
                hasWallet={hasWallet} explorerUrl="https://bscscan.com" accentColor="orange"
                preselectedUser={preselectedUser ? { user_id: preselectedUser.id, display_name: preselectedUser.display_name, avatar_url: preselectedUser.avatar_url } : null}
                onConnect={connect} onTransfer={transferBnb} onFetchBalance={fetchBnbBalance}
                onSuccess={(r, u, a, amt, msg) => handleCryptoSuccess(r, u, a, amt, "BNB", msg)}
              />
            )}

            {/* USDT */}
            {activeTab === "usdt" && (
              <CryptoTransferTab
                tokenType="usdt" tokenSymbol="USDT" tokenBalance={usdtBalance}
                isConnected={isConnected} isTransferring={isTransferring} address={address}
                hasWallet={hasWallet} explorerUrl="https://bscscan.com" accentColor="orange"
                preselectedUser={preselectedUser ? { user_id: preselectedUser.id, display_name: preselectedUser.display_name, avatar_url: preselectedUser.avatar_url } : null}
                onConnect={connect} onTransfer={transferUsdt} onFetchBalance={fetchUsdtBalance}
                onSuccess={(r, u, a, amt, msg) => handleCryptoSuccess(r, u, a, amt, "USDT", msg)}
              />
            )}

            {/* Bitcoin */}
            {activeTab === "bitcoin" && (
              <CryptoTransferTab
                tokenType="bnb" tokenSymbol="BTC" tokenBalance={bnbBalance}
                isConnected={isConnected} isTransferring={isTransferring} address={address}
                hasWallet={hasWallet} explorerUrl="https://bscscan.com" accentColor="orange"
                preselectedUser={preselectedUser ? { user_id: preselectedUser.id, display_name: preselectedUser.display_name, avatar_url: preselectedUser.avatar_url } : null}
                onConnect={connect} onTransfer={transferBnb} onFetchBalance={fetchBnbBalance}
                onSuccess={(r, u, a, amt, msg) => handleCryptoSuccess(r, u, a, amt, "BTC", msg)}
              />
            )}
          </div>

          {/* Confetti Effect */}
          <AnimatePresence>
            {showConfetti && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none overflow-hidden"
              >
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{
                      x: "50%",
                      y: "50%",
                      scale: 0,
                    }}
                    animate={{
                      x: `${Math.random() * 100}%`,
                      y: `${Math.random() * 100}%`,
                      scale: 1,
                      rotate: Math.random() * 360,
                    }}
                    transition={{
                      duration: 0.8,
                      ease: "easeOut",
                    }}
                    className="absolute"
                  >
                    <Sparkles className="w-4 h-4 text-primary" />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* Celebration Modal */}
      <GiftCelebrationModal
        open={showCelebration}
        onOpenChange={setShowCelebration}
        data={celebrationData}
        onPostToProfile={async (celData, themeId) => {
          try {
            const tokenLabel = celData.tokenType === "fun_money" ? "FUN Money"
              : celData.tokenType === "camly_web3" ? "CAMLY (Web3)"
              : celData.tokenType === "usdt" ? "USDT"
              : celData.tokenType === "bnb" ? "BNB"
              : celData.tokenType === "bitcoin" ? "BTC"
              : "Camly Coin";
            const displayTime = celData.created_at ? new Date(celData.created_at).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN");
            const postContent = `🎁 Biên nhận tặng thưởng\nNgười tặng: ${celData.sender_name}\nNgười nhận: ${celData.receiver_name}\nSố lượng: ${celData.amount.toLocaleString()} ${tokenLabel}${celData.message ? `\nLời nhắn: "${celData.message}"` : ""}\n⏰ ${displayTime}${celData.tx_hash ? `\n🔗 Tx: ${celData.tx_hash.slice(0, 10)}...${celData.tx_hash.slice(-8)}` : ""}\n#AngelAI #TặngThưởng #CamlyCoin #FUNMoney`;

            const { error: postErr } = await supabase.functions.invoke("process-community-post", {
              body: { action: "create_post", content: postContent },
            });
            if (postErr) throw postErr;
            toast.success("Đã đăng biên nhận lên Profile! 🎉");
          } catch (err: any) {
            console.error("[PostToProfile] Error:", err);
            toast.error("Không thể đăng bài. Vui lòng thử lại.");
          }
        }}
      />
    </>
  );
}
