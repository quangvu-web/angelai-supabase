import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@/lib/router-compat";
import { getProfilePath } from "@/lib/profileUrl";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AdminNavToolbar from "@/components/admin/AdminNavToolbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Wallet,
  Search,
  Copy,
  ExternalLink,
  Shield,
  ShieldOff,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Users,
  Ban,
  XCircle,
  DollarSign,
  Network,
  RefreshCw,
  ArrowRightLeft,
  Clock,
  AlertCircle,
  ThumbsUp,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface WalletEntry {
  wallet_address: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  handle: string | null;
  balance: number;
  lifetime_earned: number;
  total_withdrawn: number;
  suspension_type: string | null;
  suspended_until: string | null;
  suspension_reason: string | null;
  // Fraud & pending
  fraud_alert_count: number;
  max_alert_severity: string | null;
  fraud_alert_details: { alert_type: string; severity: string; matched_pattern: string | null }[];
  pending_withdrawal_amount: number;
  pending_withdrawal_ids: string[];
  withdrawal_wallet_count: number;
  withdrawal_wallet_addresses: string[]; // Danh sách địa chỉ ví đã dùng để rút
  // Shared wallet detection
  is_shared_wallet: boolean;
  shared_wallet_user_count: number;
  shared_wallet_users: { user_id: string; display_name: string | null; handle: string | null }[]; // Tài khoản dùng chung ví
}

interface PendingWithdrawal {
  id: string;
  user_id: string;
  wallet_address: string;
  amount: number;
  created_at: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  fraud_alert_count: number;
  max_alert_severity: string | null;
  is_suspended: boolean;
}

interface SharedWalletGroup {
  wallet_address: string;
  user_count: number;
  users: { user_id: string; display_name: string | null; handle: string | null; avatar_url: string | null }[];
  total_pending: number;
}

interface WalletRotationUser {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  wallet_count: number;
  total_withdrawn: number;
  pending_amount: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ─── Component ─────────────────────────────────────────────────────────────────

const AdminWalletManagement = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();

  // Tab 1 state
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [fraudFilter, setFraudFilter] = useState<"all" | "flagged">("all");
  const [page, setPage] = useState(1);

  // Tab 2 state
  const [sharedWalletGroups, setSharedWalletGroups] = useState<SharedWalletGroup[]>([]);
  const [walletRotationUsers, setWalletRotationUsers] = useState<WalletRotationUser[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Tab 3 state
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [selectedWithdrawalIds, setSelectedWithdrawalIds] = useState<string[]>([]);

  // Dialogs
  const [suspendTarget, setSuspendTarget] = useState<WalletEntry | null>(null);
  const [suspensionType, setSuspensionType] = useState<"temporary" | "permanent">("temporary");
  const [durationDays, setDurationDays] = useState("30");
  const [suspendReason, setSuspendReason] = useState("");
  const [healingMessage, setHealingMessage] = useState("");
  const [suspending, setSuspending] = useState(false);

  const [liftTarget, setLiftTarget] = useState<WalletEntry | null>(null);
  const [lifting, setLifting] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<PendingWithdrawal | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectNote, setBulkRejectNote] = useState("");

  // ─── Fetch: All wallets with fraud + pending info ──────────────────────────

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch ALL wallet addresses (to detect shared wallets across all users)
      const { data: allWalletAddressData, error: walletError } = await supabase
        .from("user_wallet_addresses")
        .select("wallet_address, user_id");

      if (walletError) throw walletError;
      if (!allWalletAddressData || allWalletAddressData.length === 0) {
        setWallets([]);
        return;
      }

      // ── Build shared wallet map: wallet_address → list of user_ids ──────────
      const walletAddressCount: Record<string, number> = {};
      const walletAddressUsers: Record<string, string[]> = {}; // wallet_address → [user_ids]
      allWalletAddressData.forEach((w) => {
        walletAddressCount[w.wallet_address] = (walletAddressCount[w.wallet_address] || 0) + 1;
        if (!walletAddressUsers[w.wallet_address]) walletAddressUsers[w.wallet_address] = [];
        walletAddressUsers[w.wallet_address].push(w.user_id);
      });

      const walletData = allWalletAddressData;
      const userIds = walletData.map((w) => w.user_id);

      const [
        { data: profiles },
        { data: balances },
        { data: completedWds },
        { data: suspensions },
        { data: fraudAlerts },
        { data: pendingWds },
        { data: allWds },
      ] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url, handle").in("user_id", userIds),
        supabase.from("camly_coin_balances").select("user_id, balance, lifetime_earned").in("user_id", userIds),
        supabase.from("coin_withdrawals").select("user_id, amount").in("user_id", userIds).eq("status", "completed"),
        supabase.from("user_suspensions").select("user_id, suspension_type, suspended_until, reason").in("user_id", userIds).is("lifted_at", null),
        supabase.from("fraud_alerts").select("user_id, severity, alert_type, matched_pattern, is_reviewed").in("user_id", userIds).eq("is_reviewed", false),
        supabase.from("coin_withdrawals").select("user_id, amount, id").in("user_id", userIds).eq("status", "pending"),
        supabase.from("coin_withdrawals").select("user_id, wallet_address").in("user_id", userIds).eq("status", "completed"),
      ]);

      // Build maps
      const profileMap: Record<string, { user_id: string; display_name: string | null; avatar_url: string | null; handle: string | null }> = {};
      profiles?.forEach((p) => (profileMap[p.user_id] = p));

      const balanceMap: Record<string, { user_id: string; balance: number; lifetime_earned: number }> = {};
      balances?.forEach((b) => (balanceMap[b.user_id] = b));

      const withdrawalMap: Record<string, number> = {};
      completedWds?.forEach((w) => { withdrawalMap[w.user_id] = (withdrawalMap[w.user_id] || 0) + w.amount; });

      const suspensionMap: Record<string, { user_id: string; suspension_type: string | null; suspended_until: string | null; reason: string | null }> = {};
      suspensions?.forEach((s) => (suspensionMap[s.user_id] = s));

      // Fraud: count + max severity + detail per user
      const fraudCountMap: Record<string, number> = {};
      const fraudSeverityMap: Record<string, string> = {};
      const fraudDetailMap: Record<string, { alert_type: string; severity: string; matched_pattern: string | null }[]> = {};
      const severityOrder = ["critical", "high", "medium", "low"];
      fraudAlerts?.forEach((fa) => {
        fraudCountMap[fa.user_id] = (fraudCountMap[fa.user_id] || 0) + 1;
        const existing = fraudSeverityMap[fa.user_id];
        if (!existing || severityOrder.indexOf(fa.severity) < severityOrder.indexOf(existing)) {
          fraudSeverityMap[fa.user_id] = fa.severity;
        }
        if (!fraudDetailMap[fa.user_id]) fraudDetailMap[fa.user_id] = [];
        fraudDetailMap[fa.user_id].push({
          alert_type: fa.alert_type,
          severity: fa.severity,
          matched_pattern: fa.matched_pattern ?? null,
        });
      });

      // Pending withdrawal
      const pendingAmtMap: Record<string, number> = {};
      const pendingIdsMap: Record<string, string[]> = {};
      pendingWds?.forEach((w) => {
        pendingAmtMap[w.user_id] = (pendingAmtMap[w.user_id] || 0) + w.amount;
        pendingIdsMap[w.user_id] = [...(pendingIdsMap[w.user_id] || []), w.id];
      });

      // Wallet rotation: distinct wallet addresses per user for completed withdrawals
      const walletCountMap: Record<string, Set<string>> = {};
      allWds?.forEach((w) => {
        if (!walletCountMap[w.user_id]) walletCountMap[w.user_id] = new Set();
        walletCountMap[w.user_id].add(w.wallet_address);
      });
      const walletAddrsMap: Record<string, string[]> = {};
      Object.entries(walletCountMap).forEach(([uid, addrSet]) => {
        walletAddrsMap[uid] = Array.from(addrSet);
      });

      const merged: WalletEntry[] = walletData.map((w) => {
        const profile = profileMap[w.user_id];
        const balance = balanceMap[w.user_id];
        const suspension = suspensionMap[w.user_id];
        const sharedCount = walletAddressCount[w.wallet_address] ?? 1;
        // Other users sharing the same wallet address
        const sharedUserIds = (walletAddressUsers[w.wallet_address] ?? []).filter((uid) => uid !== w.user_id);
        const sharedUsers = sharedUserIds.map((uid) => ({
          user_id: uid,
          display_name: profileMap[uid]?.display_name ?? null,
          handle: profileMap[uid]?.handle ?? null,
        }));
        return {
          wallet_address: w.wallet_address,
          user_id: w.user_id,
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          handle: profile?.handle ?? null,
          balance: balance?.balance ?? 0,
          lifetime_earned: balance?.lifetime_earned ?? 0,
          total_withdrawn: withdrawalMap[w.user_id] ?? 0,
          suspension_type: suspension?.suspension_type ?? null,
          suspended_until: suspension?.suspended_until ?? null,
          suspension_reason: suspension?.reason ?? null,
          fraud_alert_count: fraudCountMap[w.user_id] ?? 0,
          max_alert_severity: fraudSeverityMap[w.user_id] ?? null,
          fraud_alert_details: fraudDetailMap[w.user_id] ?? [],
          pending_withdrawal_amount: pendingAmtMap[w.user_id] ?? 0,
          pending_withdrawal_ids: pendingIdsMap[w.user_id] ?? [],
          withdrawal_wallet_count: walletCountMap[w.user_id]?.size ?? 0,
          withdrawal_wallet_addresses: walletAddrsMap[w.user_id] ?? [],
          is_shared_wallet: sharedCount > 1,
          shared_wallet_user_count: sharedCount,
          shared_wallet_users: sharedUsers,
        };
      });

      setWallets(merged);
    } catch (err) {
      console.error("Error fetching wallets:", err);
      toast({ title: "Lỗi", description: "Không thể tải danh sách ví", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ─── Fetch: Shared wallets ─────────────────────────────────────────────────

  const fetchSharedWallets = useCallback(async () => {
    setAuditLoading(true);
    try {
      const { data: allWallets } = await supabase
        .from("user_wallet_addresses")
        .select("wallet_address, user_id");

      if (!allWallets) return;

      // Group by wallet_address
      const grouped: Record<string, string[]> = {};
      allWallets.forEach((w) => {
        if (!grouped[w.wallet_address]) grouped[w.wallet_address] = [];
        grouped[w.wallet_address].push(w.user_id);
      });

      // Filter shared (> 1 user)
      const sharedAddresses = Object.entries(grouped).filter(([, users]) => users.length > 1);
      if (sharedAddresses.length === 0) {
        setSharedWalletGroups([]);
        return;
      }

      const allSharedUserIds = [...new Set(sharedAddresses.flatMap(([, uids]) => uids))];

      const [{ data: profiles }, { data: pendingWds }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, handle, avatar_url").in("user_id", allSharedUserIds),
        supabase.from("coin_withdrawals").select("user_id, amount").in("user_id", allSharedUserIds).eq("status", "pending"),
      ]);

      const profileMap: Record<string, typeof profiles[0]> = {};
      profiles?.forEach((p) => (profileMap[p.user_id] = p));

      const pendingMap: Record<string, number> = {};
      pendingWds?.forEach((w) => { pendingMap[w.user_id] = (pendingMap[w.user_id] || 0) + w.amount; });

      const groups: SharedWalletGroup[] = sharedAddresses.map(([addr, uids]) => ({
        wallet_address: addr,
        user_count: uids.length,
        users: uids.map((uid) => ({
          user_id: uid,
          display_name: profileMap[uid]?.display_name ?? null,
          handle: profileMap[uid]?.handle ?? null,
          avatar_url: profileMap[uid]?.avatar_url ?? null,
        })),
        total_pending: uids.reduce((sum, uid) => sum + (pendingMap[uid] ?? 0), 0),
      }));

      setSharedWalletGroups(groups.sort((a, b) => b.user_count - a.user_count));

      // Also fetch wallet rotation
      const { data: rotationData } = await supabase
        .from("coin_withdrawals")
        .select("user_id, wallet_address, amount")
        .eq("status", "completed");

      if (rotationData) {
        const rotMap: Record<string, { wallets: Set<string>; total: number }> = {};
        rotationData.forEach((r) => {
          if (!rotMap[r.user_id]) rotMap[r.user_id] = { wallets: new Set(), total: 0 };
          rotMap[r.user_id].wallets.add(r.wallet_address);
          rotMap[r.user_id].total += r.amount;
        });

        const rotUsers = Object.entries(rotMap)
          .filter(([, v]) => v.wallets.size >= 2)
          .map(([uid, v]) => ({
            user_id: uid,
            display_name: profileMap[uid]?.display_name ?? null,
            handle: profileMap[uid]?.handle ?? null,
            avatar_url: profileMap[uid]?.avatar_url ?? null,
            wallet_count: v.wallets.size,
            total_withdrawn: v.total,
            pending_amount: pendingMap[uid] ?? 0,
          }))
          .sort((a, b) => b.wallet_count - a.wallet_count);

        // Fill in profiles not in sharedUserIds
        const missingIds = rotUsers.filter((u) => !profileMap[u.user_id]).map((u) => u.user_id);
        if (missingIds.length > 0) {
          const { data: extraProfiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, handle, avatar_url")
            .in("user_id", missingIds);
          extraProfiles?.forEach((p) => {
            const u = rotUsers.find((r) => r.user_id === p.user_id);
            if (u) {
              u.display_name = p.display_name;
              u.handle = p.handle;
              u.avatar_url = p.avatar_url;
            }
          });
        }

        setWalletRotationUsers(rotUsers);
      }
    } catch (err) {
      console.error("fetchSharedWallets error:", err);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  // ─── Fetch: Pending withdrawals ────────────────────────────────────────────

  const fetchPendingWithdrawals = useCallback(async () => {
    setPendingLoading(true);
    try {
      const { data: wds, error } = await supabase
        .from("coin_withdrawals")
        .select("id, user_id, wallet_address, amount, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!wds || wds.length === 0) {
        setPendingWithdrawals([]);
        return;
      }

      const userIds = [...new Set(wds.map((w) => w.user_id))];

      const [{ data: profiles }, { data: fraudAlerts }, { data: suspensions }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, handle, avatar_url").in("user_id", userIds),
        supabase.from("fraud_alerts").select("user_id, severity").in("user_id", userIds).eq("is_reviewed", false),
        supabase.from("user_suspensions").select("user_id").in("user_id", userIds).is("lifted_at", null),
      ]);

      const profileMap: Record<string, typeof profiles[0]> = {};
      profiles?.forEach((p) => (profileMap[p.user_id] = p));

      const fraudCountMap: Record<string, number> = {};
      const fraudSeverityMap: Record<string, string> = {};
      const severityOrder = ["critical", "high", "medium", "low"];
      fraudAlerts?.forEach((fa) => {
        fraudCountMap[fa.user_id] = (fraudCountMap[fa.user_id] || 0) + 1;
        const existing = fraudSeverityMap[fa.user_id];
        if (!existing || severityOrder.indexOf(fa.severity) < severityOrder.indexOf(existing)) {
          fraudSeverityMap[fa.user_id] = fa.severity;
        }
      });

      const suspendedSet = new Set(suspensions?.map((s) => s.user_id) ?? []);

      const result: PendingWithdrawal[] = wds.map((w) => ({
        id: w.id,
        user_id: w.user_id,
        wallet_address: w.wallet_address,
        amount: w.amount,
        created_at: w.created_at,
        display_name: profileMap[w.user_id]?.display_name ?? null,
        handle: profileMap[w.user_id]?.handle ?? null,
        avatar_url: profileMap[w.user_id]?.avatar_url ?? null,
        fraud_alert_count: fraudCountMap[w.user_id] ?? 0,
        max_alert_severity: fraudSeverityMap[w.user_id] ?? null,
        is_suspended: suspendedSet.has(w.user_id),
      }));

      setPendingWithdrawals(result);
    } catch (err) {
      console.error("fetchPendingWithdrawals error:", err);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  // ─── Rejection handler ─────────────────────────────────────────────────────

  const handleRejectWithdrawals = async (ids: string[], note: string) => {
    if (!session?.user?.id) return;
    setRejecting(true);
    try {
      const { error } = await supabase
        .from("coin_withdrawals")
        .update({
          status: "failed",
          admin_notes: note || "Từ chối bởi admin - kiểm tra ví",
          processed_at: new Date().toISOString(),
          processed_by: session.user.id,
        })
        .in("id", ids)
        .eq("status", "pending");

      if (error) throw error;

      toast({
        title: `Đã từ chối ${ids.length} lệnh rút`,
        description: "Số dư đã được hoàn trả tự động về tài khoản người dùng",
      });
      setRejectTarget(null);
      setRejectNote("");
      setBulkRejectOpen(false);
      setBulkRejectNote("");
      setSelectedWithdrawalIds([]);
      await Promise.all([fetchPendingWithdrawals(), fetchWallets()]);
    } catch (err: unknown) {
      toast({ title: "Lỗi", description: err instanceof Error ? err.message : "Không thể từ chối", variant: "destructive" });
    } finally {
      setRejecting(false);
    }
  };

  const handleApproveWithdrawal = async (id: string) => {
    if (!session?.user?.id) return;
    try {
      const { error } = await supabase
        .from("coin_withdrawals")
        .update({ status: "processing", processed_by: session.user.id })
        .eq("id", id)
        .eq("status", "pending");
      if (error) throw error;
      toast({ title: "Đã duyệt lệnh rút - chuyển sang processing" });
      await fetchPendingWithdrawals();
    } catch (err: unknown) {
      toast({ title: "Lỗi", description: err instanceof Error ? err.message : "Không thể duyệt", variant: "destructive" });
    }
  };

  // ─── Suspend / Lift ────────────────────────────────────────────────────────

  const handleSuspend = async () => {
    if (!suspendTarget || !session?.access_token) return;
    if (!suspendReason.trim()) {
      toast({ title: "Vui lòng nhập lý do tạm dừng", variant: "destructive" });
      return;
    }
    setSuspending(true);
    try {
      const res = await fetch(
        `${(import.meta.env.VITE_SUPABASE_URL ?? "")}/functions/v1/suspend-user`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUserId: suspendTarget.user_id,
            suspensionType,
            reason: suspendReason,
            durationDays: suspensionType === "temporary" ? parseInt(durationDays) : undefined,
            healingMessage: healingMessage.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tạm dừng");
      toast({ title: "Đã tạm dừng tài khoản thành công" });
      setSuspendTarget(null);
      setSuspendReason("");
      setHealingMessage("");
      setSuspensionType("temporary");
      setDurationDays("30");
      await fetchWallets();
    } catch (err: unknown) {
      toast({ title: "Lỗi", description: err instanceof Error ? err.message : "Không thể tạm dừng", variant: "destructive" });
    } finally {
      setSuspending(false);
    }
  };

  const handleLiftSuspension = async () => {
    if (!liftTarget || !session?.user?.id) return;
    setLifting(true);
    try {
      const { error } = await supabase
        .from("user_suspensions")
        .update({ lifted_at: new Date().toISOString(), lifted_by: session.user.id })
        .eq("user_id", liftTarget.user_id)
        .is("lifted_at", null);
      if (error) throw error;
      toast({ title: "Đã khôi phục tài khoản thành công" });
      setLiftTarget(null);
      await fetchWallets();
    } catch (err: unknown) {
      toast({ title: "Lỗi", description: err instanceof Error ? err.message : "Không thể gỡ tạm dừng", variant: "destructive" });
    } finally {
      setLifting(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const fmt = (n: number) => n.toLocaleString("vi-VN");

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast({ title: "Đã sao chép địa chỉ ví" });
  };

  const getStatusBadge = (w: WalletEntry) => {
    if (!w.suspension_type) {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
          <CheckCircle className="w-3 h-3 mr-1" /> Hoạt động
        </Badge>
      );
    }
    if (w.suspension_type === "permanent") {
      return <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" /> Khóa vĩnh viễn</Badge>;
    }
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
        <AlertTriangle className="w-3 h-3 mr-1" /> Tạm dừng
      </Badge>
    );
  };

  const alertTypeLabel: Record<string, string> = {
    email_pattern: "📧 Email trùng pattern",
    bulk_registration: "👥 Đăng ký đồng loạt",
    shared_wallet: "🔴 Ví dùng chung",
    wallet_rotation: "🟠 Hoán đổi ví",
    suspicious_withdrawal: "⚠ Rút tiền nghi ngờ",
    sybil: "🚫 Tài khoản sybil",
  };

  // ─── Helpers dùng chung ────────────────────────────────────────────────────
  const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const SEVERITY_CFG: Record<string, { badgeCls: string; dotColor: string; badgeLabel: string }> = {
    critical: {
      badgeCls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700",
      dotColor: "#ef4444",
      badgeLabel: "🔴 VÍ DÙNG CHUNG",
    },
    high: {
      badgeCls: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-700",
      dotColor: "#f97316",
      badgeLabel: "🟠 HOÁN ĐỔI VÍ",
    },
    medium: {
      badgeCls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700",
      dotColor: "#f59e0b",
      badgeLabel: "🟡 CẢNH BÁO",
    },
    low: {
      badgeCls: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-700",
      dotColor: "#eab308",
      badgeLabel: "⚠ NGHI NGỜ",
    },
  };

  // Hàm tổng hợp cảnh báo từ 3 nguồn: shared_wallet, wallet_rotation, fraud_alerts
  const getWalletWarningBadges = (w: WalletEntry) => {
    const hasShared = w.is_shared_wallet;
    const hasRotation = w.withdrawal_wallet_count >= 2;
    const hasFraud = w.fraud_alert_count > 0;

    if (!hasShared && !hasRotation && !hasFraud) return null;

    // Severity cao nhất để chọn màu badge chính
    let topSeverity = "low";
    if (hasShared) topSeverity = "critical";
    else if (hasRotation) topSeverity = "high";
    else if (w.max_alert_severity) topSeverity = w.max_alert_severity;

    const cfg = SEVERITY_CFG[topSeverity] ?? SEVERITY_CFG.low;
    const warningCount = (hasShared ? 1 : 0) + (hasRotation ? 1 : 0) + w.fraud_alert_count;

    // Label badge chính
    const badgeText = hasShared
      ? `🔴 VÍ DÙNG CHUNG (${w.shared_wallet_user_count} tài khoản)`
      : hasRotation
      ? `🟠 HOÁN ĐỔI VÍ (${w.withdrawal_wallet_count} ví)`
      : `${cfg.badgeLabel} ×${w.fraud_alert_count}`;

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              className={`${cfg.badgeCls} border text-xs font-semibold cursor-help whitespace-nowrap select-none`}
            >
              {badgeText}
            </Badge>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={6}
            align="start"
            avoidCollisions
            collisionPadding={12}
            className="p-0 overflow-hidden rounded-xl border border-border shadow-2xl bg-popover z-[9999] w-[340px]"
          >
            {/* ── Header ── */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/70 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <p className="text-xs font-bold text-foreground">
                Phân tích cảnh báo — {warningCount} dấu hiệu bất thường
              </p>
            </div>

            <div className="px-4 py-3 space-y-3.5 max-h-80 overflow-y-auto">

              {/* ── Khối 1: Ví dùng chung ── */}
              {hasShared && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400">
                      🔴 Ví dùng chung — Nguy cơ CỰC CAO
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-3.5 leading-relaxed">
                    Địa chỉ{" "}
                    <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-foreground">
                      {shortAddr(w.wallet_address)}
                    </code>{" "}
                    đang được dùng bởi{" "}
                    <strong className="text-red-600 dark:text-red-400">{w.shared_wallet_user_count} tài khoản</strong>{" "}
                    khác nhau — đây là dấu hiệu tài khoản giả mạo (Sybil).
                  </p>
                  {/* Danh sách tài khoản dùng chung */}
                  <div className="pl-3.5 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                      Danh sách tài khoản liên quan:
                    </p>
                    <div className="space-y-1 rounded-lg bg-red-50/60 dark:bg-red-900/20 border border-red-200/60 dark:border-red-800/40 p-2">
                      {/* Tài khoản này */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-red-400 shrink-0">●</span>
                        <span className="font-semibold text-foreground">{w.display_name ?? "Chưa đặt tên"}</span>
                        {w.handle && <span className="text-muted-foreground text-[11px]">@{w.handle}</span>}
                        <span className="ml-auto text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                          TÀI KHOẢN NÀY
                        </span>
                      </div>
                      {/* Tài khoản khác */}
                      {w.shared_wallet_users.map((u) => (
                        <div key={u.user_id} className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground shrink-0">●</span>
                          <span
                            className="font-medium text-foreground cursor-pointer hover:text-primary hover:underline transition-colors"
                            onClick={() => navigate(getProfilePath(u.user_id, u.handle))}
                          >
                            {u.display_name ?? "Ẩn danh"}
                          </span>
                          {u.handle && <span className="text-muted-foreground text-[11px]">@{u.handle}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Divider */}
              {hasShared && (hasRotation || hasFraud) && (
                <div className="border-t border-border/50" />
              )}

              {/* ── Khối 2: Hoán đổi ví ── */}
              {hasRotation && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                      🟠 Hoán đổi ví — Nguy cơ CAO
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground pl-3.5 leading-relaxed">
                    Tài khoản đã rút tiền tới{" "}
                    <strong className="text-orange-600 dark:text-orange-400">
                      {w.withdrawal_wallet_count} địa chỉ ví khác nhau
                    </strong>{" "}
                    — có thể là hành vi tránh truy vết hoặc chia nhỏ giao dịch.
                  </p>
                  {w.withdrawal_wallet_addresses.length > 0 && (
                    <div className="pl-3.5 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                        Địa chỉ ví đã nhận tiền:
                      </p>
                      <div className="space-y-1 rounded-lg bg-orange-50/60 dark:bg-orange-900/20 border border-orange-200/60 dark:border-orange-800/40 p-2">
                        {w.withdrawal_wallet_addresses.map((addr, i) => (
                          <div key={addr} className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">#{i + 1}</span>
                            <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] text-foreground flex-1">
                              {shortAddr(addr)}
                            </code>
                            <a
                              href={`https://bscscan.com/address/${addr}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                              title="Xem trên BSCScan"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              {hasRotation && hasFraud && (
                <div className="border-t border-border/50" />
              )}

              {/* ── Khối 3: Fraud alerts từ hệ thống ── */}
              {hasFraud && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      ⚠ Cảnh báo hệ thống — {w.fraud_alert_count} alert chưa xử lý
                    </p>
                  </div>
                  <div className="pl-3.5 space-y-1.5">
                    {w.fraud_alert_details.map((d, i) => {
                      const dotColor = SEVERITY_CFG[d.severity]?.dotColor ?? "#eab308";
                      return (
                        <div
                          key={i}
                          className="rounded-lg bg-amber-50/60 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 p-2 space-y-1"
                        >
                          <div className="flex items-center gap-1.5 text-xs">
                            <span
                              className="inline-block w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: dotColor }}
                            />
                            <span className="font-semibold text-foreground">
                              {alertTypeLabel[d.alert_type] ?? d.alert_type}
                            </span>
                            <span
                              className="ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: `${dotColor}20`,
                                color: dotColor,
                              }}
                            >
                              {d.severity}
                            </span>
                          </div>
                          {d.matched_pattern && (
                            <p className="text-[11px] text-muted-foreground pl-3.5">
                              Khớp pattern:{" "}
                              <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] text-foreground">
                                {d.matched_pattern}
                              </code>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="px-4 py-2.5 border-t border-border bg-muted/40 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-muted-foreground shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                Vào tab <strong>"🚨 Cần Kiểm tra"</strong> để xem nhóm ví liên quan đầy đủ
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Legacy wrapper cho pending tab (chỉ dùng fraud_alerts)
  const getFraudBadge = (
    severity: string | null,
    count: number,
  ) => {
    if (!severity || count === 0) return null;
    const cfg: Record<string, { cls: string; label: string }> = {
      critical: { cls: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400", label: "⚠ CRITICAL" },
      high:     { cls: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400", label: "🔴 HIGH" },
      medium:   { cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400", label: "🟠 MEDIUM" },
      low:      { cls: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-400", label: "🟡 LOW" },
    };
    const c = cfg[severity] ?? cfg.low;
    return (
      <Badge className={`${c.cls} border text-xs cursor-help`}>
        {c.label} ×{count}
      </Badge>
    );
  };

  // ─── Filtering Tab 1 ───────────────────────────────────────────────────────

  const filtered = wallets.filter((w) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (w.display_name?.toLowerCase().includes(q) ?? false) ||
      (w.handle?.toLowerCase().includes(q) ?? false) ||
      w.wallet_address.toLowerCase().includes(q);

    const isSuspended = !!w.suspension_type;
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !isSuspended) ||
      (statusFilter === "suspended" && isSuspended);

    // Flagged = có bất kỳ dấu hiệu bất thường nào: shared_wallet, wallet_rotation, hoặc fraud_alert
    const hasWarning = w.is_shared_wallet || w.withdrawal_wallet_count >= 2 || w.fraud_alert_count > 0;
    const matchFraud =
      fraudFilter === "all" || (fraudFilter === "flagged" && hasWarning);

    return matchSearch && matchStatus && matchFraud;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalSuspended = wallets.filter((w) => !!w.suspension_type).length;
  const totalFlagged = wallets.filter((w) => w.is_shared_wallet || w.withdrawal_wallet_count >= 2 || w.fraud_alert_count > 0).length;
  const totalPendingAmt = wallets.reduce((s, w) => s + w.pending_withdrawal_amount, 0);

  // ─── Pending withdrawal stats ──────────────────────────────────────────────

  const pendingFlagged = pendingWithdrawals.filter((w) => w.fraud_alert_count > 0).length;
  const pendingTotal = pendingWithdrawals.reduce((s, w) => s + w.amount, 0);
  const pendingSuspended = pendingWithdrawals.filter((w) => w.is_suspended).length;

  // ─── Select all in pending tab ─────────────────────────────────────────────

  const allPendingIds = pendingWithdrawals.map((w) => w.id);
  const allSelected = allPendingIds.length > 0 && selectedWithdrawalIds.length === allPendingIds.length;
  const toggleSelectAll = () => {
    setSelectedWithdrawalIds(allSelected ? [] : allPendingIds);
  };
  const toggleSelectOne = (id: string) => {
    setSelectedWithdrawalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 h-[73px] flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Wallet className="w-5 h-5 text-primary" />
          <div>
            <h1 className="font-bold text-foreground leading-tight">Quản lý Ví</h1>
            <p className="text-xs text-muted-foreground">{wallets.length} ví đã đăng ký</p>
          </div>
        </div>
      </div>

      <AdminNavToolbar />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Tổng ví", value: wallets.length, icon: Wallet, color: "text-primary" },
            { label: "Đang hoạt động", value: wallets.length - totalSuspended, icon: Users, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Có cảnh báo", value: totalFlagged, icon: AlertTriangle, color: "text-orange-500" },
            { label: "Bị tạm dừng", value: totalSuspended, icon: Ban, color: "text-destructive" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <stat.icon className={`w-8 h-8 ${stat.color} shrink-0`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 2-Tab Layout */}
        <Tabs defaultValue="wallets" onValueChange={(v) => {
          if (v === "audit") fetchSharedWallets();
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="wallets">
              <Wallet className="w-4 h-4 mr-2" /> Tất cả Ví
            </TabsTrigger>
            <TabsTrigger value="audit">
              <AlertTriangle className="w-4 h-4 mr-2" /> 🚨 Cần Kiểm tra
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════ TAB 1: ALL WALLETS ═══════════════ */}
          <TabsContent value="wallets" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm tên, handle, hoặc địa chỉ ví..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="active">Đang hoạt động</SelectItem>
                  <SelectItem value="suspended">Đang tạm dừng</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fraudFilter} onValueChange={(v) => { setFraudFilter(v as typeof fraudFilter); setPage(1); }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="flagged">⚠ Có cảnh báo</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchWallets} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-xl overflow-visible relative">
              {loading ? (
                <div className="p-12 text-center text-muted-foreground">Đang tải dữ liệu...</div>
              ) : paginated.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">Không tìm thấy kết quả nào</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Người dùng</TableHead>
                      <TableHead>Địa chỉ ví</TableHead>
                      <TableHead>Cảnh báo</TableHead>
                      <TableHead className="text-right">Số dư</TableHead>
                      <TableHead className="text-right">Đã rút</TableHead>
                      <TableHead className="text-right">Pending Rút</TableHead>
                      <TableHead>TT</TableHead>
                      <TableHead className="text-center">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((w) => (
                      <TableRow
                        key={`${w.user_id}-${w.wallet_address}`}
                        className={`hover:bg-muted/30 ${
                          w.is_shared_wallet
                            ? "bg-red-50/30 dark:bg-red-900/10 border-l-2 border-l-red-500"
                            : w.withdrawal_wallet_count >= 2
                            ? "bg-orange-50/30 dark:bg-orange-900/10 border-l-2 border-l-orange-400"
                            : w.fraud_alert_count > 0 && w.max_alert_severity === "critical"
                            ? "bg-red-50/20 dark:bg-red-900/10 border-l-2 border-l-red-400"
                            : w.fraud_alert_count > 0
                            ? "bg-amber-50/20 dark:bg-amber-900/10 border-l-2 border-l-amber-400"
                            : ""
                        }`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={w.avatar_url ?? ""} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {(w.display_name ?? "?")[0]?.toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p
                                className="text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                                onClick={() => navigate(getProfilePath(w.user_id, w.handle))}
                              >
                                {w.display_name ?? "Chưa đặt tên"}
                              </p>
                              {w.handle && <p className="text-xs text-muted-foreground">@{w.handle}</p>}
                              {w.withdrawal_wallet_count >= 2 && (
                                <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 mt-0.5">
                                  <ArrowRightLeft className="w-2.5 h-2.5 mr-1" />
                                  {w.withdrawal_wallet_count} ví rút
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-foreground/80">
                              {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-4)}
                            </span>
                            <button onClick={() => copyAddress(w.wallet_address)} className="text-muted-foreground hover:text-foreground transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <a href={`https://bscscan.com/address/${w.wallet_address}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getWalletWarningBadges(w)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium text-foreground">{fmt(w.balance)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-muted-foreground">{fmt(w.total_withdrawn)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {w.pending_withdrawal_amount > 0 ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                {fmt(w.pending_withdrawal_amount)}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 px-2"
                                onClick={() => {
                                  const firstPwd = pendingWithdrawals.find((p) => p.user_id === w.user_id);
                                  if (firstPwd) setRejectTarget(firstPwd);
                                  else {
                                    // Quick reject by IDs
                                    handleRejectWithdrawals(w.pending_withdrawal_ids, "Từ chối bởi admin - kiểm tra ví");
                                  }
                                }}
                              >
                                <XCircle className="w-3 h-3 mr-1" /> Từ chối
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(w)}</TableCell>
                        <TableCell className="text-center">
                          {w.suspension_type ? (
                            <Button size="sm" variant="outline" onClick={() => setLiftTarget(w)} className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/30">
                              <ShieldOff className="w-3.5 h-3.5 mr-1" /> Gỡ
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setSuspendTarget(w)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                              <Shield className="w-3.5 h-3.5 mr-1" /> Tạm dừng
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / {filtered.length} kết quả
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-foreground px-2">{page} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══════════════ TAB 2: AUDIT ═══════════════ */}
          <TabsContent value="audit" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Dashboard Kiểm toán Ví
              </h2>
              <Button variant="outline" size="sm" onClick={fetchSharedWallets} disabled={auditLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${auditLoading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
            </div>

            {auditLoading ? (
              <div className="p-12 text-center text-muted-foreground">Đang phân tích dữ liệu...</div>
            ) : (
              <>
                {/* Section A: Shared Wallets */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-border bg-red-50/50 dark:bg-red-900/10">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Network className="w-4 h-4 text-red-500" />
                      Ví Dùng Chung (Shared Wallets)
                      <Badge className="ml-2 bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400">
                        {sharedWalletGroups.length} nhóm
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Nhiều tài khoản dùng cùng một địa chỉ ví — dấu hiệu sybil farming</p>
                  </div>
                  {sharedWalletGroups.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      Không phát hiện ví dùng chung
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {sharedWalletGroups.map((group) => (
                        <div key={group.wallet_address} className="p-4 hover:bg-muted/30">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                                  {group.wallet_address.slice(0, 10)}...{group.wallet_address.slice(-6)}
                                </code>
                                <Badge className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400">
                                  {group.user_count} tài khoản
                                </Badge>
                                {group.total_pending > 0 && (
                                  <Badge className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">
                                    💰 {fmt(group.total_pending)} pending
                                  </Badge>
                                )}
                                <button onClick={() => copyAddress(group.wallet_address)} className="text-muted-foreground hover:text-foreground">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <a href={`https://bscscan.com/address/${group.wallet_address}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {group.users.map((u) => (
                                  <div
                                    key={u.user_id}
                                    className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1 cursor-pointer hover:bg-muted"
                                    onClick={() => navigate(`/user/${u.user_id}`)}
                                  >
                                    <Avatar className="w-5 h-5">
                                      <AvatarImage src={u.avatar_url ?? ""} />
                                      <AvatarFallback className="text-xs">{(u.display_name ?? "?")[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs text-foreground">{u.display_name ?? "Unknown"}</span>
                                    {u.handle && <span className="text-xs text-muted-foreground">@{u.handle}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section B: Wallet Rotation */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-border bg-purple-50/50 dark:bg-purple-900/10">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-purple-500" />
                      Hoán Đổi Ví (Wallet Rotation)
                      <Badge className="ml-2 bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/40 dark:text-purple-400">
                        {walletRotationUsers.length} tài khoản
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Tài khoản đã dùng ≥2 ví khác nhau để rút tiền — dấu hiệu rửa tiền</p>
                  </div>
                  {walletRotationUsers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                      Không phát hiện hoán đổi ví
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Người dùng</TableHead>
                          <TableHead className="text-center">Số ví đã dùng</TableHead>
                          <TableHead className="text-right">Đã rút (completed)</TableHead>
                          <TableHead className="text-right">Đang pending</TableHead>
                          <TableHead className="text-center">Hành động</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {walletRotationUsers.map((u) => (
                          <TableRow key={u.user_id} className="hover:bg-muted/30 border-l-2 border-l-purple-400">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={u.avatar_url ?? ""} />
                                  <AvatarFallback className="text-xs">{(u.display_name ?? "?")[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p
                                    className="text-sm font-medium cursor-pointer hover:text-primary"
                                    onClick={() => navigate(`/user/${u.user_id}`)}
                                  >
                                    {u.display_name ?? "Unknown"}
                                  </p>
                                  {u.handle && <p className="text-xs text-muted-foreground">@{u.handle}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400">
                                {u.wallet_count} ví
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{fmt(u.total_withdrawn)}</TableCell>
                            <TableCell className="text-right">
                              {u.pending_amount > 0 ? (
                                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{fmt(u.pending_amount)}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/user/${u.user_id}`)}
                                className="text-xs"
                              >
                                <ExternalLink className="w-3 h-3 mr-1" /> Xem
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Section C: Info note */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <p className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      Để xem thêm cảnh báo đăng ký đồng loạt (bulk registration), truy cập{" "}
                      <button className="underline font-medium" onClick={() => navigate("/admin/fraud-alerts")}>
                        Trang Cảnh báo Gian lận
                      </button>
                      . Các lệnh rút tiền cần kiểm tra có thể từ chối tập trung ở tab{" "}
                      <span className="font-medium">💰 Lệnh Rút Pending</span>.
                    </span>
                  </p>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Suspend Dialog ─────────────────────────────────── */}
      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && setSuspendTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Tạm dừng tài khoản
            </DialogTitle>
            {suspendTarget && (
              <DialogDescription asChild>
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={suspendTarget.avatar_url ?? ""} />
                    <AvatarFallback className="text-xs">{(suspendTarget.display_name ?? "?")[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">{suspendTarget.display_name ?? "Người dùng"}</span>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Loại tạm dừng</Label>
              <RadioGroup value={suspensionType} onValueChange={(v) => setSuspensionType(v as "temporary" | "permanent")} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="temporary" id="tmp" />
                  <Label htmlFor="tmp" className="cursor-pointer">Tạm thời</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="permanent" id="perm" />
                  <Label htmlFor="perm" className="cursor-pointer text-destructive">Vĩnh viễn</Label>
                </div>
              </RadioGroup>
            </div>
            {suspensionType === "temporary" && (
              <div>
                <Label htmlFor="days" className="text-sm font-medium">Số ngày tạm dừng</Label>
                <Input id="days" type="number" min="1" max="365" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="mt-1 w-32" />
              </div>
            )}
            <div>
              <Label htmlFor="reason" className="text-sm font-medium">Lý do <span className="text-destructive">*</span></Label>
              <Textarea id="reason" placeholder="Nhập lý do tạm dừng tài khoản..." value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} className="mt-1" rows={3} />
            </div>
            <div>
              <Label htmlFor="healing" className="text-sm font-medium">Thông điệp chữa lành <span className="text-muted-foreground">(tùy chọn)</span></Label>
              <Textarea id="healing" placeholder="Để trống sẽ dùng thông điệp mặc định từ Angel AI..." value={healingMessage} onChange={(e) => setHealingMessage(e.target.value)} className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)} disabled={suspending}>Hủy</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={suspending}>
              {suspending ? "Đang xử lý..." : "Xác nhận tạm dừng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Lift Suspension Dialog ─────────────────────────── */}
      <Dialog open={!!liftTarget} onOpenChange={(o) => !o && setLiftTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldOff className="w-5 h-5" /> Gỡ tạm dừng tài khoản
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn khôi phục tài khoản <strong>{liftTarget?.display_name ?? "này"}</strong> không?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiftTarget(null)} disabled={lifting}>Hủy</Button>
            <Button onClick={handleLiftSuspension} disabled={lifting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {lifting ? "Đang xử lý..." : "Xác nhận khôi phục"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Withdrawal Dialog ───────────────────────── */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Từ chối lệnh rút tiền
            </DialogTitle>
            {rejectTarget && (
              <DialogDescription asChild>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={rejectTarget.avatar_url ?? ""} />
                      <AvatarFallback className="text-xs">{(rejectTarget.display_name ?? "?")[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{rejectTarget.display_name}</span>
                  </div>
                  <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                    <p className="text-foreground">
                      <span className="text-muted-foreground">Số Camly:</span>{" "}
                      <strong className="text-amber-600 dark:text-amber-400">{fmt(rejectTarget.amount)}</strong>
                    </p>
                    <p className="text-foreground">
                      <span className="text-muted-foreground">Ví:</span>{" "}
                      <code className="text-xs">{rejectTarget.wallet_address.slice(0, 10)}...{rejectTarget.wallet_address.slice(-6)}</code>
                    </p>
                    {rejectTarget.fraud_alert_count > 0 && (
                      <p>{getFraudBadge(rejectTarget.max_alert_severity, rejectTarget.fraud_alert_count)}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Số dư sẽ được <strong>hoàn trả tự động</strong> về tài khoản người dùng sau khi từ chối.
                  </p>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>
          <div>
            <Label htmlFor="reject-note" className="text-sm font-medium">
              Ghi chú admin <span className="text-muted-foreground">(tùy chọn)</span>
            </Label>
            <Textarea
              id="reject-note"
              placeholder="Lý do từ chối lệnh rút..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejecting}>Hủy</Button>
            <Button
              variant="destructive"
              disabled={rejecting}
              onClick={() => rejectTarget && handleRejectWithdrawals([rejectTarget.id], rejectNote)}
            >
              {rejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Bulk Reject Dialog ─────────────────────────────── */}
      <Dialog open={bulkRejectOpen} onOpenChange={(o) => !o && setBulkRejectOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" /> Từ chối hàng loạt
            </DialogTitle>
            <DialogDescription>
              Bạn sắp từ chối <strong>{selectedWithdrawalIds.length}</strong> lệnh rút tiền.
              Tổng Camly:{" "}
              <strong className="text-amber-600 dark:text-amber-400">
                {fmt(
                  pendingWithdrawals
                    .filter((w) => selectedWithdrawalIds.includes(w.id))
                    .reduce((s, w) => s + w.amount, 0)
                )}
              </strong>
              {" "}sẽ được hoàn trả tự động về các tài khoản.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="bulk-note" className="text-sm font-medium">
              Ghi chú admin <span className="text-muted-foreground">(tùy chọn)</span>
            </Label>
            <Textarea
              id="bulk-note"
              placeholder="Lý do từ chối hàng loạt..."
              value={bulkRejectNote}
              onChange={(e) => setBulkRejectNote(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectOpen(false)} disabled={rejecting}>Hủy</Button>
            <Button
              variant="destructive"
              disabled={rejecting}
              onClick={() => handleRejectWithdrawals(selectedWithdrawalIds, bulkRejectNote)}
            >
              {rejecting ? "Đang xử lý..." : `Từ chối ${selectedWithdrawalIds.length} lệnh`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminWalletManagement;
