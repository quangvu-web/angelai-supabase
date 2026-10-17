import { useState, useEffect, useCallback, useMemo } from "react";
import { smartBack } from "@/lib/smartBack";
import { useNavigate, Link } from "@/lib/router-compat";
import { getProfilePath } from "@/lib/profileUrl";
import {
  Globe, RefreshCw, Download, Search, Gift, Heart, Wallet,
  ArrowUpRight, ArrowDownLeft, Copy, ExternalLink, Check,
  Clock, TrendingUp, Activity, CheckCircle2, Loader2,
  ArrowLeft, Users, User, Send, Inbox, Filter, Sparkles,
  ShieldCheck, Building2, AlertTriangle, RotateCcw
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow, format, isToday, subDays, subMonths } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import camlyCoinLogo from "@/assets/camly-coin-logo.png";
import funMoneyLogo from "@/assets/fun-money-logo.png";
import bitcoinLogo from "@/assets/bitcoin-logo.png";
import angelAiLogo from "@/assets/angel-ai-golden-logo.png";
import { GiftCelebrationModal, type CelebrationData } from "@/components/gifts/GiftCelebrationModal";

const ACTIVITY_HISTORY_REFRESH_MS = 120_000;
const ACTIVITY_FETCH_LIMIT = 300;

const USDT_LOGO = "https://cryptologos.cc/logos/tether-usdt-logo.png?v=040";
const BNB_LOGO = "https://cryptologos.cc/logos/bnb-bnb-logo.png?v=040";

const TREASURY_WALLET = "0x416336c3b7ACAe89F47EAD2707412f20DA159ac8";
const TREASURY_SENDER_ID = "ANGEL_AI_TREASURY";

function getTokenDisplay(giftType: string | null): { logo: string; symbol: string } {
  switch (giftType) {
    case "web3_FUN": return { logo: funMoneyLogo, symbol: "FUN" };
    case "web3_USDT": return { logo: USDT_LOGO, symbol: "USDT" };
    case "web3_BNB": return { logo: BNB_LOGO, symbol: "BNB" };
    case "web3_BTC": return { logo: bitcoinLogo, symbol: "BTC" };
    default: return { logo: camlyCoinLogo, symbol: "CAMLY" };
  }
}

function getCoinTypeLabel(giftType: string | null, donationType: string | null, txType: string): string {
  if (txType === "treasury_reward" || txType === "treasury_lixi") return "Web3 CAMLY";
  if (txType === "donation") return donationType === "manual" ? "Web3 CAMLY" : "Nội bộ";
  switch (giftType) {
    case "internal": return "Nội bộ";
    case "web3":
    case "web3_CAMLY": return "Web3 CAMLY";
    case "web3_FUN": return "Web3 FUN";
    case "web3_USDT": return "Web3 USDT";
    case "web3_BNB": return "Web3 BNB";
    case "web3_BTC": return "Web3 BTC";
    default: return giftType ? giftType : "Nội bộ";
  }
}

interface Transaction {
  id: string;
  type: "gift" | "donation" | "treasury_reward" | "treasury_lixi";
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  sender_wallet: string | null;
  receiver_id: string | null;
  receiver_name: string | null;
  receiver_avatar: string | null;
  receiver_wallet: string | null;
  amount: number;
  message: string | null;
  created_at: string;
  tx_hash: string | null;
  gift_type: string | null;
  donation_type: string | null;
  receipt_public_id: string | null;
}

function truncateWallet(addr: string | null) {
  if (!addr) return null;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-xl border border-[#daa520]/30 p-3 sm:p-4 text-center shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`w-8 h-8 mx-auto mb-1.5 rounded-full flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-[11px] text-[#8B7355] font-medium">{label}</p>
      <p className="text-lg font-bold text-[#3D2800]">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}

const isTreasuryTx = (tx: Transaction) => tx.type === "treasury_reward" || tx.type === "treasury_lixi";

function TransactionItem({ tx, onViewCard }: { tx: Transaction; onViewCard?: (tx: Transaction) => void }) {
  const { currentLanguage } = useLanguage();
  const locale = currentLanguage === "vi" ? vi : enUS;
  const timeAgo = formatDistanceToNow(new Date(tx.created_at), { addSuffix: true, locale });
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

  const isGift = tx.type === "gift";
  const isTreasury = isTreasuryTx(tx);
  const isOnchain = tx.tx_hash || tx.gift_type === "web3" || tx.donation_type === "manual" || isTreasury;

  const copyWallet = async (addr: string) => {
    await navigator.clipboard.writeText(addr);
    setCopiedWallet(addr);
    toast.success("Đã sao chép địa chỉ ví");
    setTimeout(() => setCopiedWallet(null), 2000);
  };

  const typeLabel = isTreasury
    ? (tx.type === "treasury_lixi" ? "Lì xì" : "Trả thưởng")
    : isGift ? "Tặng thưởng" : "Donate";

  const typeIcon = isTreasury
    ? <Building2 className="w-2.5 h-2.5" />
    : isGift ? <Gift className="w-2.5 h-2.5" /> : <Heart className="w-2.5 h-2.5" />;

  const formattedTime = format(new Date(tx.created_at), "HH:mm:ss dd/M/yyyy", { locale });
  const tokenDisplay = getTokenDisplay(tx.gift_type);
  const coinTypeLabel = getCoinTypeLabel(tx.gift_type, tx.donation_type, tx.type);

  const treasuryWallet = "0x416336c3b7ACAe89F47EAD2707412f20DA159ac8";

  return (
    <div className="bg-gradient-to-br from-[#fffdf5] to-[#fef9e7] backdrop-blur-sm rounded-xl border border-[#daa520]/30 p-4 sm:p-5 hover:border-[#daa520]/50 transition-all hover:shadow-lg shadow-sm">
      {/* Row 1: Sender → Receiver with amount */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-2">
        {/* Sender (left) */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {isTreasury ? (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="w-10 h-10 border-2 border-[#daa520]/40 flex-shrink-0">
                <AvatarImage src={angelAiLogo} />
                <AvatarFallback className="text-xs bg-[#ffd700]/20 text-[#b8860b]">AI</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-[#3D2800] truncate">ANGEL AI TREASURY</span>
                <div className="flex items-center gap-1 text-[10px] text-[#8B7355]">
                  <span className="font-mono text-[#daa520]">{truncateWallet(treasuryWallet)}</span>
                  <button onClick={() => copyWallet(treasuryWallet)} className="hover:text-[#b8860b] flex-shrink-0">
                    {copiedWallet === treasuryWallet ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                  <a href={`https://bscscan.com/address/${treasuryWallet}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <ExternalLink className="w-2.5 h-2.5 text-[#8B7355] hover:text-[#b8860b]" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <Link to={getProfilePath(tx.sender_id)} className="flex items-center gap-2 hover:opacity-80 min-w-0">
              <Avatar className="w-10 h-10 border-2 border-[#ffd700]/30 flex-shrink-0">
                <AvatarImage src={tx.sender_avatar || ""} />
                <AvatarFallback className="text-xs bg-[#ffd700]/20 text-[#b8860b]">
                  {(tx.sender_name || "?")[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm text-[#3D2800] truncate max-w-[130px] sm:max-w-[200px]">{tx.sender_name || "Ẩn danh"}</span>
                {tx.sender_wallet && (
                  <div className="flex items-center gap-1 text-[10px] text-[#8B7355]">
                    <span className="font-mono text-[#daa520]">{truncateWallet(tx.sender_wallet)}</span>
                    <button onClick={() => copyWallet(tx.sender_wallet!)} className="hover:text-[#b8860b] flex-shrink-0">
                      {copiedWallet === tx.sender_wallet ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                    <a href={`https://bscscan.com/address/${tx.sender_wallet}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <ExternalLink className="w-2.5 h-2.5 text-[#8B7355] hover:text-[#b8860b]" />
                    </a>
                  </div>
                )}
              </div>
            </Link>
          )}

          {/* Arrow - inline on mobile */}
          <Send className="w-4 h-4 text-[#daa520] flex-shrink-0 sm:hidden ml-auto" />
        </div>

        {/* Arrow center - desktop only */}
        <div className="flex-shrink-0 self-center hidden sm:block">
          <Send className="w-5 h-5 text-[#daa520]" />
        </div>

        {/* Receiver (right) + Amount */}
        <div className="flex flex-col items-start sm:items-end min-w-0 flex-1 overflow-hidden pl-4 sm:pl-0 border-l-2 sm:border-l-0 border-[#daa520]/20">
          {tx.receiver_id ? (
            tx.receiver_id === TREASURY_SENDER_ID ? (
              /* Treasury as receiver (donations) */
              <>
                <div className="flex items-center gap-2 sm:flex-row-reverse min-w-0">
                  <Avatar className="w-10 h-10 border-2 border-[#daa520]/40 flex-shrink-0">
                    <AvatarImage src={angelAiLogo} />
                    <AvatarFallback className="text-xs bg-[#ffd700]/20 text-[#b8860b]">AI</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 sm:items-end">
                    <span className="font-bold text-sm text-[#3D2800] truncate">ANGEL AI TREASURY</span>
                    <div className="flex items-center gap-1 text-[10px] text-[#8B7355]">
                      <span className="font-mono text-[#daa520]">{truncateWallet(TREASURY_WALLET)}</span>
                      <button onClick={() => copyWallet(TREASURY_WALLET)} className="hover:text-[#b8860b] flex-shrink-0">
                        {copiedWallet === TREASURY_WALLET ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                      </button>
                      <a href={`https://bscscan.com/address/${TREASURY_WALLET}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <ExternalLink className="w-2.5 h-2.5 text-[#8B7355] hover:text-[#b8860b]" />
                      </a>
                    </div>
                  </div>
                </div>
                {/* Amount */}
                <div className="flex items-center gap-1.5 mt-1">
                  <img src={tokenDisplay.logo} alt="" className="w-5 h-5 rounded-full" />
                  <span className="font-extrabold text-xl text-rose-500">{tx.amount.toLocaleString()}</span>
                  <span className="font-bold text-sm text-rose-500">{tokenDisplay.symbol}</span>
                </div>
              </>
            ) : (
              /* Normal user as receiver */
              <>
                <Link to={getProfilePath(tx.receiver_id)} className="flex items-center gap-2 hover:opacity-80 min-w-0 sm:flex-row-reverse">
                  <Avatar className="w-10 h-10 border-2 border-[#ffd700]/30 flex-shrink-0">
                    <AvatarImage src={tx.receiver_avatar || ""} />
                    <AvatarFallback className="text-xs bg-[#ffd700]/20 text-[#b8860b]">
                      {(tx.receiver_name || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 sm:items-end">
                    <span className="font-bold text-sm text-[#3D2800] truncate max-w-[130px] sm:max-w-[200px]">{tx.receiver_name || "Ẩn danh"}</span>
                    {tx.receiver_wallet && (
                      <div className="flex items-center gap-1 text-[10px] text-[#8B7355]">
                        <span className="font-mono text-[#daa520]">{truncateWallet(tx.receiver_wallet)}</span>
                        <button onClick={(e) => { e.preventDefault(); copyWallet(tx.receiver_wallet!); }} className="hover:text-[#b8860b] flex-shrink-0">
                          {copiedWallet === tx.receiver_wallet ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                        </button>
                        <a href={`https://bscscan.com/address/${tx.receiver_wallet}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                          <ExternalLink className="w-2.5 h-2.5 text-[#8B7355] hover:text-[#b8860b]" />
                        </a>
                      </div>
                    )}
                  </div>
                </Link>
                {/* Amount */}
                <div className="flex items-center gap-1.5 mt-1">
                  <img src={tokenDisplay.logo} alt="" className="w-5 h-5 rounded-full" />
                  <span className={`font-extrabold text-xl ${isTreasury ? 'text-[#b8860b]' : isGift ? 'text-[#b8860b]' : 'text-rose-500'}`}>
                    {tx.amount.toLocaleString()}
                  </span>
                  <span className={`font-bold text-sm ${isTreasury ? 'text-[#b8860b]' : isGift ? 'text-[#b8860b]' : 'text-rose-500'}`}>
                    {tokenDisplay.symbol}
                  </span>
                </div>
              </>
            )
          ) : null}
        </div>
      </div>

      {/* Row 2: Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
        <span className={`inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${
          isTreasury
            ? 'bg-gradient-to-r from-[#ffd700]/20 to-[#daa520]/20 text-[#b8860b] border border-[#daa520]/30'
            : isGift 
              ? 'bg-gradient-to-r from-[#ffd700]/20 to-[#daa520]/20 text-[#b8860b] border border-[#daa520]/30' 
              : 'bg-rose-100 text-rose-600 border border-rose-200'
        }`}>
          {typeIcon}
          {typeLabel}
        </span>

        {isOnchain && (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-gradient-to-r from-[#ffd700]/20 to-[#daa520]/20 text-[#b8860b] border border-[#daa520]/30 px-2 py-0.5 rounded-full font-medium">
            <Wallet className="w-2.5 h-2.5" />
            Onchain
          </span>
        )}

        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
          <img src={tokenDisplay.logo} alt="" className="w-3 h-3 rounded-full" />
          {coinTypeLabel}
        </span>
      </div>

      {/* Row 3: Message */}
      {tx.message && (
        <p className="text-xs text-[#b8860b] mt-2 italic font-medium">
          "{tx.message}"
        </p>
      )}

      {/* Row 4: Footer - Status, Time, TX, View Card */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#daa520]/15">
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className="inline-flex items-center gap-0.5 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Thành công
          </span>
          <span className="text-[#8B7355]">• {formattedTime}</span>
          {tx.tx_hash && (
            <>
              <span className="text-[#8B7355]">• BSC</span>
              <span className="text-[#8B7355]">• TX:</span>
              <a
                href={`https://bscscan.com/tx/${tx.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#daa520] hover:text-[#b8860b] flex items-center gap-0.5"
              >
                {truncateWallet(tx.tx_hash)}
                <Copy className="w-2.5 h-2.5" />
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {tx.receipt_public_id && (
            <Link
              to={`/receipt/${tx.receipt_public_id}`}
              className="text-[11px] text-[#b8860b] hover:text-[#8B6914] flex items-center gap-0.5 font-medium"
            >
              <Gift className="w-3 h-3" />
              Biên nhận
            </Link>
          )}
          {tx.type === "gift" && onViewCard && (
            <button
              onClick={() => onViewCard(tx)}
              className="text-[11px] text-[#daa520] hover:text-[#b8860b] flex items-center gap-0.5 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Xem Card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const ActivityHistory = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [onchainOnly, setOnchainOnly] = useState(false);
  const [tokenFilter, setTokenFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"all" | "personal">("all");
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);
  const [displayCount, setDisplayCount] = useState(50);

  // Pending gift records recovery
  const [pendingGifts, setPendingGifts] = useState<any[]>([]);
  const [isRetryingPending, setIsRetryingPending] = useState(false);
  const [isSyncingOnchain, setIsSyncingOnchain] = useState(false);

  // Check admin role
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Load pending gifts from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("pending_gift_records") || "[]");
    setPendingGifts(stored);
  }, []);

  // Auto-sync BSCScan once per day for admin
  const [autoSyncDone, setAutoSyncDone] = useState(false);
  useEffect(() => {
    if (!isAdmin || autoSyncDone) return;
    const lastSync = localStorage.getItem("last_bscscan_sync");
    const today = new Date().toDateString();
    if (lastSync !== today) {
      setAutoSyncDone(true);
      handleSyncOnchain().then(() => {
        localStorage.setItem("last_bscscan_sync", today);
      });
    } else {
      setAutoSyncDone(true);
    }
  }, [isAdmin]);

  const handleRetryPending = async () => {
    if (pendingGifts.length === 0) return;
    setIsRetryingPending(true);
    try {
      const { error } = await supabase.functions.invoke("record-gift", {
        body: { gifts: pendingGifts },
      });
      if (!error) {
        localStorage.removeItem("pending_gift_records");
        setPendingGifts([]);
        toast.success(`Đã đồng bộ ${pendingGifts.length} giao dịch thành công!`);
        fetchTransactions();
      } else {
        toast.error("Đồng bộ thất bại. Vui lòng thử lại sau.");
      }
    } catch {
      toast.error("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setIsRetryingPending(false);
    }
  };

  const handleSyncOnchain = async () => {
    setIsSyncingOnchain(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-bscscan-gifts");
      if (error) {
        toast.error("Đồng bộ BSCScan thất bại: " + error.message);
      } else {
        const result = data;
        toast.success(`Đồng bộ BSCScan hoàn tất: ${result.synced} giao dịch mới, ${result.skipped} đã có`);
        if (result.synced > 0) fetchTransactions();
      }
    } catch {
      toast.error("Lỗi kết nối BSCScan.");
    } finally {
      setIsSyncingOnchain(false);
    }
  };

  const handleViewCard = (tx: Transaction) => {
    setCelebrationData({
      receipt_public_id: tx.receipt_public_id || "",
      sender_id: tx.sender_id,
      sender_name: tx.sender_name || "Ẩn danh",
      sender_avatar: tx.sender_avatar,
      sender_wallet: tx.sender_wallet,
      receiver_id: tx.receiver_id || "",
      receiver_name: tx.receiver_name || "Ẩn danh",
      receiver_avatar: tx.receiver_avatar,
      receiver_wallet: tx.receiver_wallet,
      amount: tx.amount,
      message: tx.message,
      tx_hash: tx.tx_hash,
      created_at: tx.created_at,
      tokenType: tx.gift_type === "web3" ? "camly_web3" : "internal",
    });
    setShowCelebration(true);
  };

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch gifts, donations, withdrawals, lixi in parallel
      const [giftsRes, donationsRes, withdrawalsRes, lixiRes] = await Promise.all([
        supabase
          .from("coin_gifts")
          .select("id, sender_id, receiver_id, amount, message, created_at, tx_hash, gift_type, receipt_public_id")
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_FETCH_LIMIT),
        supabase
          .from("project_donations")
          .select("id, donor_id, amount, message, created_at, donation_type, tx_hash, status")
          .eq("status", "confirmed")
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_FETCH_LIMIT),
        supabase
          .from("coin_withdrawals")
          .select("id, user_id, amount, wallet_address, tx_hash, created_at")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(ACTIVITY_FETCH_LIMIT),
        supabase
          .from("lixi_claims")
          .select("id, user_id, camly_amount, wallet_address, tx_hash, claimed_at")
          .eq("status", "completed")
          .order("claimed_at", { ascending: false })
          .limit(ACTIVITY_FETCH_LIMIT),
      ]);

      const gifts = giftsRes.data;
      const donations = donationsRes.data;
      const withdrawals = withdrawalsRes.data;
      const lixiClaims = lixiRes.data;

      const userIds = new Set<string>();
      gifts?.forEach(g => { userIds.add(g.sender_id); userIds.add(g.receiver_id); });
      donations?.forEach(d => userIds.add(d.donor_id));
      withdrawals?.forEach(w => userIds.add(w.user_id));
      lixiClaims?.forEach(l => userIds.add(l.user_id));

      const userIdArr = Array.from(userIds);

      const [{ data: profiles }, { data: wallets }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIdArr),
        supabase.from("user_wallet_addresses").select("user_id, wallet_address").in("user_id", userIdArr),
      ]);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const walletMap = new Map(wallets?.map((w: any) => [w.user_id, w.wallet_address]) || []);

      const allTx: Transaction[] = [];

      gifts?.forEach(g => {
        const sender = profileMap.get(g.sender_id);
        const receiver = profileMap.get(g.receiver_id);
        allTx.push({
          id: g.id, type: "gift",
          sender_id: g.sender_id, sender_name: sender?.display_name || null,
          sender_avatar: sender?.avatar_url || null, sender_wallet: walletMap.get(g.sender_id) || null,
          receiver_id: g.receiver_id, receiver_name: receiver?.display_name || null,
          receiver_avatar: receiver?.avatar_url || null, receiver_wallet: walletMap.get(g.receiver_id) || null,
          amount: g.amount, message: g.message, created_at: g.created_at,
          tx_hash: g.tx_hash || null, gift_type: g.gift_type || null,
          donation_type: null, receipt_public_id: g.receipt_public_id || null,
        });
      });

      donations?.forEach(d => {
        const donor = profileMap.get(d.donor_id);
        const donationToken = d.donation_type === "manual" ? "web3" : null;
        allTx.push({
          id: d.id, type: "donation",
          sender_id: d.donor_id, sender_name: donor?.display_name || null,
          sender_avatar: donor?.avatar_url || null, sender_wallet: walletMap.get(d.donor_id) || null,
          receiver_id: TREASURY_SENDER_ID, receiver_name: "ANGEL AI TREASURY", 
          receiver_avatar: angelAiLogo, receiver_wallet: TREASURY_WALLET,
          amount: d.amount, message: d.message, created_at: d.created_at,
          tx_hash: d.tx_hash, gift_type: donationToken, donation_type: d.donation_type,
          receipt_public_id: null,
        });
      });

      // Treasury rewards (withdrawals)
      withdrawals?.forEach(w => {
        const receiver = profileMap.get(w.user_id);
        allTx.push({
          id: `wd_${w.id}`, type: "treasury_reward",
          sender_id: TREASURY_SENDER_ID, sender_name: "Angel AI Treasury",
          sender_avatar: angelAiLogo, sender_wallet: TREASURY_WALLET,
          receiver_id: w.user_id, receiver_name: receiver?.display_name || null,
          receiver_avatar: receiver?.avatar_url || null, receiver_wallet: w.wallet_address || walletMap.get(w.user_id) || null,
          amount: w.amount, message: "Trả thưởng CAMLY từ Angel AI Treasury",
          created_at: w.created_at, tx_hash: w.tx_hash || null,
          gift_type: null, donation_type: null, receipt_public_id: null,
        });
      });

      // Treasury lixi
      lixiClaims?.forEach(l => {
        const receiver = profileMap.get(l.user_id);
        allTx.push({
          id: `lx_${l.id}`, type: "treasury_lixi",
          sender_id: TREASURY_SENDER_ID, sender_name: "Angel AI Treasury",
          sender_avatar: angelAiLogo, sender_wallet: TREASURY_WALLET,
          receiver_id: l.user_id, receiver_name: receiver?.display_name || null,
          receiver_avatar: receiver?.avatar_url || null, receiver_wallet: l.wallet_address || walletMap.get(l.user_id) || null,
          amount: l.camly_amount, message: "🧧 Lì xì Tết từ Angel AI Treasury",
          created_at: l.claimed_at, tx_hash: l.tx_hash || null,
          gift_type: null, donation_type: null, receipt_public_id: null,
        });
      });

      allTx.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTransactions(allTx);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    const intervalId = window.setInterval(fetchTransactions, ACTIVITY_HISTORY_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchTransactions]);

  // View-filtered base (all vs personal)
  const viewFiltered = useMemo(() => {
    if (viewMode === "personal" && user) {
      return transactions.filter(tx => tx.sender_id === user.id || tx.receiver_id === user.id);
    }
    return transactions;
  }, [transactions, viewMode, user]);

  // Filtered list
  const filtered = useMemo(() => {
    return viewFiltered.filter(tx => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          (tx.sender_name || "").toLowerCase().includes(q) ||
          (tx.receiver_name || "").toLowerCase().includes(q) ||
          (tx.sender_wallet || "").toLowerCase().includes(q) ||
          (tx.tx_hash || "").toLowerCase().includes(q) ||
          (tx.message || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (typeFilter === "gifts" && tx.type !== "gift") return false;
      if (typeFilter === "donations" && tx.type !== "donation") return false;
      if (typeFilter === "treasury_reward" && tx.type !== "treasury_reward") return false;
      if (typeFilter === "treasury_lixi" && tx.type !== "treasury_lixi") return false;
      if (timeFilter === "today" && !isToday(new Date(tx.created_at))) return false;
      if (timeFilter === "7days" && new Date(tx.created_at) < subDays(new Date(), 7)) return false;
      if (timeFilter === "30days" && new Date(tx.created_at) < subMonths(new Date(), 1)) return false;
      if (onchainOnly && !tx.tx_hash && tx.gift_type !== "web3" && tx.donation_type !== "manual" && !isTreasuryTx(tx)) return false;
      // Token filter
      if (tokenFilter !== "all") {
        const gt = tx.gift_type || "";
        // Treasury transactions are always CAMLY
        if (isTreasuryTx(tx)) {
          if (tokenFilter !== "camly") return false;
        } else {
          if (tokenFilter === "camly" && !["", "internal", "web3", "web3_CAMLY"].includes(gt)) return false;
          if (tokenFilter === "fun" && gt !== "web3_FUN") return false;
          if (tokenFilter === "usdt" && gt !== "web3_USDT") return false;
          if (tokenFilter === "bnb" && gt !== "web3_BNB") return false;
          if (tokenFilter === "btc" && gt !== "web3_BTC") return false;
        }
      }
      // Status filter
      if (statusFilter === "confirmed" && !tx.tx_hash && !isTreasuryTx(tx)) return false;
      if (statusFilter === "pending" && (tx.tx_hash || isTreasuryTx(tx))) return false;
      return true;
    });
  }, [viewFiltered, searchQuery, typeFilter, timeFilter, onchainOnly, tokenFilter, statusFilter]);

  // Reset displayCount when filters change
  useEffect(() => {
    setDisplayCount(50);
  }, [searchQuery, typeFilter, timeFilter, onchainOnly, tokenFilter, statusFilter, viewMode]);

  const displayedTransactions = useMemo(() => filtered.slice(0, displayCount), [filtered, displayCount]);

  // Stats based on viewFiltered
  const stats = useMemo(() => {
    const data = viewFiltered;
    const totalCount = data.length;
    const sentCount = viewMode === "personal" && user
      ? data.filter(tx => tx.sender_id === user.id).length
      : data.filter(tx => tx.type === "gift").length;
    const receivedCount = viewMode === "personal" && user
      ? data.filter(tx => tx.receiver_id === user.id).length
      : data.filter(tx => tx.type === "donation").length;
    const onchainCount = data.filter(tx => tx.tx_hash).length;
    const totalCamly = data.reduce((s, tx) => s + tx.amount, 0);
    const totalDonate = data.filter(tx => tx.type === "donation").reduce((s, tx) => s + tx.amount, 0);
    const totalGift = data.filter(tx => tx.type === "gift").reduce((s, tx) => s + tx.amount, 0);
    const todayValue = data.filter(tx => isToday(new Date(tx.created_at))).reduce((s, tx) => s + tx.amount, 0);
    const treasuryCount = data.filter(tx => isTreasuryTx(tx)).length;
    return { totalCount, sentCount, receivedCount, onchainCount, totalCamly, totalDonate, totalGift, todayValue, treasuryCount };
  }, [viewFiltered, user]);

  // Coin type breakdown stats
  const coinTypeBreakdown = useMemo(() => {
    const data = viewFiltered;
    const map = new Map<string, { sent: number; received: number; sentCount: number; receivedCount: number }>();

    data.forEach(tx => {
      // Determine token key — normalize legacy 'web3' to 'web3_CAMLY'
      let tokenKey = tx.gift_type || "internal";
      if (tokenKey === "web3") tokenKey = "web3_CAMLY";
      if (isTreasuryTx(tx)) tokenKey = "treasury_CAMLY";
      if (tx.type === "donation") tokenKey = tx.donation_type === "manual" ? "donate_onchain" : "donate_internal";

      if (!map.has(tokenKey)) map.set(tokenKey, { sent: 0, received: 0, sentCount: 0, receivedCount: 0 });
      const entry = map.get(tokenKey)!;

      if (viewMode === "personal" && user) {
        if (tx.sender_id === user.id) { entry.sent += tx.amount; entry.sentCount++; }
        if (tx.receiver_id === user.id) { entry.received += tx.amount; entry.receivedCount++; }
      } else {
        // In "all" mode: show total volume as "received" side
        entry.received += tx.amount;
        entry.receivedCount++;
      }
    });

    const TOKEN_LABELS: Record<string, { label: string; logo: string }> = {
      internal: { label: "CAMLY (Nội bộ)", logo: camlyCoinLogo },
      web3_CAMLY: { label: "CAMLY (Web3)", logo: camlyCoinLogo },
      web3_FUN: { label: "FUN Money", logo: funMoneyLogo },
      web3_USDT: { label: "USDT", logo: USDT_LOGO },
      web3_BNB: { label: "BNB", logo: BNB_LOGO },
      web3_BTC: { label: "Bitcoin", logo: bitcoinLogo },
      treasury_CAMLY: { label: "Treasury CAMLY", logo: angelAiLogo },
      donate_onchain: { label: "Donate (Onchain)", logo: camlyCoinLogo },
      donate_internal: { label: "Donate (Nội bộ)", logo: camlyCoinLogo },
    };

    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        label: TOKEN_LABELS[key]?.label || key,
        logo: TOKEN_LABELS[key]?.logo || camlyCoinLogo,
        ...v,
        total: v.sent + v.received,
      }))
      .sort((a, b) => b.total - a.total);
  }, [viewFiltered, viewMode, user]);

  // Export CSV
  const exportCSV = () => {
    const headers = ["Thời gian", "Loại", "Người gửi", "Người nhận", "Số lượng", "TX Hash", "Lời nhắn"];
    const rows = filtered.map(tx => [
      format(new Date(tx.created_at), "dd/MM/yyyy HH:mm"),
      tx.type === "gift" ? "Tặng thưởng" : tx.type === "donation" ? "Donate" : tx.type === "treasury_lixi" ? "Lì xì" : "Trả thưởng",
      tx.sender_name || tx.sender_id,
      tx.receiver_name || tx.receiver_id || "Angel AI",
      tx.amount.toString(),
      tx.tx_hash || "",
      (tx.message || "").replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angel-ai-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất dữ liệu CSV");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ffd700]/5 via-white to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#b8860b] px-4 sm:px-6 py-5 shadow-lg">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => smartBack(navigate)} className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                <ArrowLeft className="w-4 h-4 text-white" />
              </button>
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white drop-shadow-sm">Lịch Sử Giao Dịch</h1>
                <p className="text-xs text-white/80">Minh bạch • Truy vết Blockchain • Chuẩn Web3</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSyncOnchain}
                  disabled={isSyncingOnchain}
                  className="text-white hover:bg-white/20 h-8"
                  title={isAdmin ? "Đồng bộ tất cả ví (Admin)" : "Đồng bộ ví của bạn từ BSCScan"}
                >
                  {isSyncingOnchain ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Globe className="w-4 h-4 mr-1" />}
                  <span className="hidden sm:inline">{isAdmin ? "Sync All" : "Sync Ví"}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTransactions}
                className="text-white hover:bg-white/20 h-8"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Làm mới</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={exportCSV}
                className="text-white hover:bg-white/20 h-8"
              >
                <Download className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Xuất dữ liệu</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 sm:px-6 py-5 space-y-4">
        {/* View Mode Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("all")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              viewMode === "all"
                ? "bg-gradient-to-r from-[#daa520] to-[#b8860b] text-white shadow-md"
                : "bg-white/80 text-[#8B7355] border border-[#daa520]/30 hover:border-[#daa520]/50"
            }`}
          >
            <Users className="w-4 h-4" />
            Tất cả
          </button>
          <button
            onClick={() => setViewMode("personal")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              viewMode === "personal"
                ? "bg-gradient-to-r from-[#daa520] to-[#b8860b] text-white shadow-md"
                : "bg-white/80 text-[#8B7355] border border-[#daa520]/30 hover:border-[#daa520]/50"
            }`}
          >
            <User className="w-4 h-4" />
            Cá nhân
          </button>
        </div>

        {/* Pending gifts recovery banner */}
        {pendingGifts.length > 0 && (
          <Alert className="border-amber-400 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Có {pendingGifts.length} giao dịch chưa được ghi nhận</AlertTitle>
            <AlertDescription className="text-amber-700 text-xs">
              Các giao dịch blockchain đã thành công nhưng chưa đồng bộ vào hệ thống. Nhấn "Thử lại" để đồng bộ.
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetryPending}
                disabled={isRetryingPending}
                className="ml-3 h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-100"
              >
                {isRetryingPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Admin sync moved to header */}

        {/* Personal mode login prompt */}
        {viewMode === "personal" && !user && (
          <div className="bg-[#ffd700]/10 border border-[#daa520]/30 rounded-xl p-4 text-center">
            <p className="text-sm text-[#8B7355]">Vui lòng <Link to="/auth" className="text-[#b8860b] font-semibold underline">đăng nhập</Link> để xem giao dịch cá nhân.</p>
          </div>
        )}

        {/* Personal Summary Card */}
        {viewMode === "personal" && user ? (
          <div className="bg-white rounded-2xl border border-[#daa520]/30 shadow-md overflow-hidden">
            {/* Title */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#3D2800]" />
                <h2 className="text-lg font-extrabold text-[#3D2800] tracking-tight">LỊCH SỬ GIAO DỊCH CÁ NHÂN</h2>
              </div>
            </div>

            {/* Token Summary Table */}
            {coinTypeBreakdown.length > 0 && (
              <div className="px-4 pb-3">
                <div className="rounded-xl border border-[#daa520]/25 overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-4 bg-gradient-to-r from-[#ffd700]/10 to-[#daa520]/10 px-3 py-2.5 border-b border-[#daa520]/20">
                    <span className="text-xs font-bold text-[#3D2800]">Token</span>
                    <span className="text-xs font-bold text-emerald-600 text-center">Tổng nhận</span>
                    <span className="text-xs font-bold text-[#3D2800] text-center">Lệnh</span>
                    <span className="text-xs font-bold text-red-500 text-right">Tổng đã tặng</span>
                  </div>
                  {/* Table Rows */}
                  {coinTypeBreakdown.map((ct, idx) => (
                    <div
                      key={ct.key}
                      className={`grid grid-cols-4 items-center px-3 py-2.5 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#ffd700]/5'
                      } ${idx < coinTypeBreakdown.length - 1 ? 'border-b border-[#daa520]/10' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={ct.logo} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                        <span className="text-xs font-bold text-[#3D2800] truncate">{ct.label.replace('CAMLY (', '').replace(')', '').replace('Money', '')}</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 text-center tabular-nums">
                        {ct.received.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-[#3D2800] text-center tabular-nums">
                        {ct.receivedCount + ct.sentCount}
                      </span>
                      <span className="text-xs font-semibold text-red-500 text-right tabular-nums">
                        {ct.sent.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Footer */}
            <div className="bg-gradient-to-r from-[#ffd700]/15 to-[#daa520]/15 px-4 py-3 flex items-center justify-between flex-wrap gap-2 border-t border-[#daa520]/20">
              <span className="text-xs font-medium text-[#3D2800] flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                Nhận: <strong className="text-emerald-600 ml-0.5">{stats.receivedCount}</strong>
              </span>
              <span className="text-xs font-medium text-[#3D2800] flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 text-red-500" />
                Gửi: <strong className="text-red-500 ml-0.5">{stats.sentCount}</strong>
              </span>
              <span className="text-xs font-bold text-[#3D2800]">
                Tổng: {stats.totalCount} GD
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Stat Cards - Row 1: Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
              <StatCard icon={Activity} label="Tổng giao dịch" value={stats.totalCount} color="bg-gradient-to-br from-[#daa520] to-[#b8860b]" />
              <StatCard icon={Send} label="Tặng thưởng" value={stats.sentCount} color="bg-gradient-to-br from-amber-500 to-amber-600" />
              <StatCard icon={Inbox} label="Donate" value={stats.receivedCount} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
              <StatCard icon={CheckCircle2} label="Onchain" value={stats.onchainCount} color="bg-gradient-to-br from-blue-500 to-blue-600" />
              <StatCard icon={Building2} label="Treasury" value={stats.treasuryCount} color="bg-gradient-to-br from-teal-500 to-emerald-600" />
            </div>

            {/* Stat Cards - Row 2: Token values */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <StatCard icon={TrendingUp} label="Tổng CAMLY" value={stats.totalCamly} color="bg-gradient-to-br from-[#ffd700] to-[#daa520]" />
              <StatCard icon={Heart} label="Tổng Donate" value={stats.totalDonate} color="bg-gradient-to-br from-rose-400 to-pink-500" />
              <StatCard icon={Gift} label="Tổng Tặng" value={stats.totalGift} color="bg-gradient-to-br from-[#b8860b] to-[#8B6914]" />
              <StatCard icon={Clock} label="Hôm nay" value={stats.todayValue} color="bg-gradient-to-br from-violet-500 to-purple-600" />
            </div>

            {/* Coin Type Breakdown */}
            {coinTypeBreakdown.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 backdrop-blur-sm rounded-xl border border-[#daa520]/30 p-3 sm:p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#daa520] to-[#b8860b] flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-[#8B6914]">Chi tiết từng loại coin</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {coinTypeBreakdown.map(ct => (
                    <div key={ct.key} className="bg-white/80 rounded-lg border border-[#daa520]/20 p-3 flex items-center gap-3">
                      <img src={ct.logo} className="w-8 h-8 rounded-full flex-shrink-0" alt="" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#3D2800] truncate">{ct.label}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-[#8B7355]">
                            Tổng: <strong className="text-[#3D2800]">{ct.total.toLocaleString()}</strong>
                            <span className="ml-1 text-[#b8860b]/50">({ct.receivedCount} GD)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Filters */}
        <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/80 backdrop-blur-sm rounded-xl border border-[#daa520]/30 p-3 sm:p-4 space-y-3 shadow-sm">
          {/* Filter header */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#daa520] to-[#b8860b] flex items-center justify-center">
              <Filter className="w-3 h-3 text-white" />
            </div>
            <h3 className="text-sm font-bold text-[#8B6914]">Bộ lọc & Tìm kiếm</h3>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b8860b]/60" />
            <Input
              type="text"
              placeholder="Tìm theo tên, địa chỉ ví, mã giao dịch (tx hash)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-[#daa520]/40 focus:border-[#daa520] focus:ring-[#daa520]/20 bg-white"
            />
          </div>

          {/* Dropdowns row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Token filter */}
            <Select value={tokenFilter} onValueChange={setTokenFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs border-[#daa520]/40 text-[#8B6914] bg-white font-medium">
                <SelectValue placeholder="Tất cả token" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#daa520]/30 z-50">
                <SelectItem value="all">Tất cả token</SelectItem>
                <SelectItem value="camly">
                  <span className="flex items-center gap-1.5"><img src={camlyCoinLogo} className="w-3.5 h-3.5 rounded-full" /> CAMLY</span>
                </SelectItem>
                <SelectItem value="fun">
                  <span className="flex items-center gap-1.5"><img src={funMoneyLogo} className="w-3.5 h-3.5 rounded-full" /> FUN Money</span>
                </SelectItem>
                <SelectItem value="usdt">
                  <span className="flex items-center gap-1.5"><img src={USDT_LOGO} className="w-3.5 h-3.5 rounded-full" /> USDT</span>
                </SelectItem>
                <SelectItem value="bnb">
                  <span className="flex items-center gap-1.5"><img src={BNB_LOGO} className="w-3.5 h-3.5 rounded-full" /> BNB</span>
                </SelectItem>
                <SelectItem value="btc">
                  <span className="flex items-center gap-1.5"><img src={bitcoinLogo} className="w-3.5 h-3.5 rounded-full" /> BTC</span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Type filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs border-[#daa520]/40 text-[#8B6914] bg-white font-medium">
                <SelectValue placeholder="Tất cả loại" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#daa520]/30 z-50">
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="gifts">Tặng thưởng</SelectItem>
                <SelectItem value="donations">Donate</SelectItem>
                <SelectItem value="treasury_reward">Trả thưởng</SelectItem>
                <SelectItem value="treasury_lixi">Lì xì</SelectItem>
              </SelectContent>
            </Select>

            {/* Time filter */}
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs border-[#daa520]/40 text-[#8B6914] bg-white font-medium">
                <SelectValue placeholder="Tất cả thời gian" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#daa520]/30 z-50">
                <SelectItem value="all">Tất cả thời gian</SelectItem>
                <SelectItem value="today">Hôm nay</SelectItem>
                <SelectItem value="7days">7 ngày qua</SelectItem>
                <SelectItem value="30days">30 ngày qua</SelectItem>
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs border-[#daa520]/40 text-[#8B6914] bg-white font-medium">
                <SelectValue placeholder="Tất cả trạng thái" />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#daa520]/30 z-50">
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="confirmed">✅ Đã xác nhận</SelectItem>
                <SelectItem value="pending">⏳ Đang chờ</SelectItem>
              </SelectContent>
            </Select>

            {/* Onchain toggle */}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-[#8B7355] font-medium">Chỉ onchain</label>
              <Switch 
                checked={onchainOnly} 
                onCheckedChange={setOnchainOnly}
                className="data-[state=checked]:bg-[#daa520]"
              />
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#8B7355]">
            Hiển thị <span className="font-bold text-[#3D2800]">{Math.min(displayCount, filtered.length)}</span> / {filtered.length} giao dịch
            {filtered.length !== transactions.length && <span> (lọc từ {transactions.length})</span>}
          </p>
        </div>

        {/* Transaction list */}
        {isLoading ? (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#daa520] mb-3" />
            <p className="text-sm text-[#8B7355]">Đang tải dữ liệu...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-[#ffd700]/10 flex items-center justify-center mb-3">
              <Gift className="w-7 h-7 text-[#daa520]" />
            </div>
            <p className="text-sm text-[#8B7355]">Không tìm thấy giao dịch nào</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayedTransactions.map(tx => (
              <TransactionItem key={tx.id} tx={tx} onViewCard={handleViewCard} />
            ))}
            {displayCount < filtered.length && (
              <div className="text-center pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDisplayCount(prev => prev + 50)}
                  className="border-[#daa520]/40 text-[#8B6914] hover:bg-[#ffd700]/10"
                >
                  Tải thêm ({filtered.length - displayCount} còn lại)
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Celebration Modal */}
      <GiftCelebrationModal
        open={showCelebration}
        onOpenChange={setShowCelebration}
        data={celebrationData}
      />
    </div>
  );
};

export default ActivityHistory;
