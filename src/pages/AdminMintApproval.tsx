import { useState, useEffect, useCallback, useMemo } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import AdminNavToolbar from "@/components/admin/AdminNavToolbar";
import { OnChainErrorBanner, OnChainErrorSummary } from "@/components/admin/OnChainErrorBanner";
import { EpochBatchProgress } from "@/components/admin/EpochBatchProgress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Shield,
  AlertCircle,
  Loader2,
  Send,
  FileCheck,
  Zap,
  CheckSquare,
  TrendingUp,
  Coins,
  BarChart3,
  PauseCircle,
  PlayCircle,
  Users,
  Package,
} from "lucide-react";
import { MintExportButton } from "@/components/admin/MintExportButton";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createRealtimeChannelId } from "@/lib/realtime";
import { BatchMintStats } from "@/components/admin/BatchMintStats";

interface MintRequestRow {
  id: string;
  action_id: string;
  actor_id: string;
  recipient_address: string;
  amount: number;
  action_hash: string;
  evidence_hash: string;
  status: string;
  signature: string | null;
  signer_address: string | null;
  tx_hash: string | null;
  nonce: number;
  created_at: string;
  minted_at: string | null;
  on_chain_error: string | null;
  // Multisig fields
  amount_wei?: string | null;
  platform_id?: string | null;
  multisig_signatures?: Record<string, any>;
  multisig_completed_groups?: string[];
  multisig_required_groups?: string[];
  // Joined data
  pplp_actions?: {
    action_type: string;
    platform_id: string;
    metadata: Record<string, unknown>;
  };
  profiles?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  // Ban/fraud flags
  is_banned?: boolean;
  is_suspicious?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  QUESTION_ASK: "💬 Hỏi AI",
  JOURNAL_WRITE: "📝 Nhật ký",
  CONTENT_CREATE: "📢 Đăng bài",
  POST_CREATE: "📢 Đăng bài",
  COMMENT_CREATE: "💬 Bình luận",
  DONATE: "🎁 Donate",
  SHARE_CONTENT: "🔗 Chia sẻ",
  GRATITUDE_PRACTICE: "🙏 Biết ơn",
  VISION_CREATE: "🌟 Vision",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Chờ duyệt", variant: "outline" },
  pending_sig: { label: "Chờ ký multisig", variant: "outline" },
  signing: { label: "Đang ký multisig", variant: "secondary" },
  signed: { label: "Đã ký", variant: "secondary" },
  submitted: { label: "Đã submit", variant: "secondary" },
  confirmed: { label: "Đã xác nhận", variant: "default" },
  minted: { label: "Đã mint", variant: "default" },
  rejected: { label: "Từ chối", variant: "destructive" },
  failed: { label: "Thất bại", variant: "destructive" },
  expired: { label: "Hết hạn", variant: "outline" },
};

export default function AdminMintApproval() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MintRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("pending");
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [retryProgress, setRetryProgress] = useState({ done: 0, total: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [globalCounts, setGlobalCounts] = useState<{ pending: number; signed: number; minted: number; pendingFun: number; signedFun: number; mintedFun: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [mintPaused, setMintPaused] = useState(false);
  const [pausedReason, setPausedReason] = useState("");
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isBatchLocking, setIsBatchLocking] = useState(false);
  const [batchLockProgress, setBatchLockProgress] = useState({ done: 0, total: 0, current: "" });
  const [showBatchLockConfirm, setShowBatchLockConfirm] = useState(false);
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      // Paginated fetch to load ALL records (Supabase max 1000/query)
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("pplp_mint_requests")
          .select(`
            *,
            pplp_actions!inner(action_type, platform_id, metadata)
          `)
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = allData.concat(data);
          offset += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      // Fetch profiles separately for display names
      const actorIds = [...new Set(allData.map((r: any) => r.actor_id))];
      let profilesMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};

      // Supabase .in() also has limits, batch in chunks of 200
      for (let i = 0; i < actorIds.length; i += 200) {
        const chunk = actorIds.slice(i, i + 200);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", chunk);

        (profiles || []).forEach((p: any) => {
          profilesMap[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        });
      }

      // Cross-check banned users (active suspensions)
      const bannedSet = new Set<string>();
      for (let i = 0; i < actorIds.length; i += 200) {
        const chunk = actorIds.slice(i, i + 200);
        const { data: suspensions } = await supabase
          .from("user_suspensions")
          .select("user_id")
          .in("user_id", chunk)
          .is("lifted_at", null);
        (suspensions || []).forEach((s: any) => bannedSet.add(s.user_id));
      }
      setBannedIds(bannedSet);

      // Cross-check suspicious users (unresolved fraud signals severity >= 3)
      const suspiciousSet = new Set<string>();
      for (let i = 0; i < actorIds.length; i += 200) {
        const chunk = actorIds.slice(i, i + 200);
        const { data: fraudSignals } = await supabase
          .from("pplp_fraud_signals")
          .select("actor_id")
          .in("actor_id", chunk)
          .eq("is_resolved", false)
          .gte("severity", 3);
        (fraudSignals || []).forEach((f: any) => {
          if (!bannedSet.has(f.actor_id)) suspiciousSet.add(f.actor_id);
        });
      }

      const enriched = allData.map((r: any) => ({
        ...r,
        profiles: profilesMap[r.actor_id] || { display_name: null, avatar_url: null },
        is_banned: bannedSet.has(r.actor_id),
        is_suspicious: suspiciousSet.has(r.actor_id),
      }));

      setRequests(enriched);
    } catch (error) {
      console.error("Error fetching mint requests:", error);
      toast.error("Lỗi tải danh sách mint requests");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch global counts using DB function (handles 10K+ records efficiently)
  const fetchGlobalCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_mint_request_stats");
      if (error) throw error;
      if (data) {
        const stats = data as Record<string, number>;
        setGlobalCounts({
          pending: stats.pending || 0,
          signed: stats.signed || 0,
          minted: stats.minted || 0,
          pendingFun: stats.pending_fun || 0,
          signedFun: stats.signed_fun || 0,
          mintedFun: stats.minted_fun || 0,
        });
      }
    } catch (e) {
      console.error("Error fetching global counts:", e);
    }
  }, []);

  // Fetch mint pause status
  const fetchMintPauseStatus = useCallback(async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "mint_system")
      .maybeSingle();
    if (data?.value) {
      const val = data.value as Record<string, unknown>;
      setMintPaused(!!val.paused);
      setPausedReason((val.paused_reason as string) || "");
    }
  }, []);

  // Toggle mint pause (admin only)
  const handleTogglePause = useCallback(async () => {
    setIsTogglingPause(true);
    try {
      const newPaused = !mintPaused;
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          key: "mint_system",
          value: {
            paused: newPaused,
            paused_reason: newPaused
              ? "Tạm dừng bởi Admin - đang kiểm tra an ninh hệ thống"
              : "Hệ thống hoạt động bình thường",
          },
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      setMintPaused(newPaused);
      toast.success(newPaused ? "🚨 Đã tạm dừng hệ thống mint" : "✅ Đã mở lại hệ thống mint");
    } catch (e) {
      toast.error("Lỗi cập nhật trạng thái mint");
    } finally {
      setIsTogglingPause(false);
    }
  }, [mintPaused]);

  useEffect(() => {
    fetchRequests();
    fetchGlobalCounts();
    fetchMintPauseStatus();

    // Realtime: auto-update when a user gets banned
    const channel = supabase
      .channel(createRealtimeChannelId('admin-mint-suspensions'))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_suspensions' },
        (payload) => {
          const newBannedUserId = payload.new?.user_id as string;
          if (newBannedUserId) {
            setBannedIds(prev => {
              const next = new Set(prev);
              next.add(newBannedUserId);
              return next;
            });
            // Also update existing requests in-memory
            setRequests(prev => prev.map(r => 
              r.actor_id === newBannedUserId ? { ...r, is_banned: true } : r
            ));
            toast.warning(`🚫 Tài khoản mới bị ban — danh sách đã cập nhật`, { duration: 5000 });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests, fetchGlobalCounts, fetchMintPauseStatus]);

  // Cleanup banned/suspicious mint requests
  const handleCleanupBanned = useCallback(async () => {
    const bannedPending = requests.filter(r => r.status === "pending" && r.is_banned).length;
    const suspiciousPending = requests.filter(r => r.status === "pending" && r.is_suspicious).length;

    if (bannedPending === 0 && suspiciousPending === 0) {
      toast.info("Không có yêu cầu nào từ tài khoản vi phạm hoặc nghi gian lận");
      return;
    }

    const confirmed = window.confirm(
      `Sẽ từ chối ${bannedPending} yêu cầu từ tài khoản bị ban và gắn cờ ${suspiciousPending} yêu cầu nghi gian lận. Tiếp tục?`
    );
    if (!confirmed) return;

    setIsCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-banned-mint-requests");

      if (error) throw error;

      if (data?.success) {
        toast.success(
          `🛡️ ${data.message}`,
          { duration: 6000 }
        );
      } else {
        toast.error(data?.error || "Lỗi không xác định");
      }

      await Promise.all([fetchRequests(), fetchGlobalCounts()]);
    } catch (error: any) {
      console.error("Cleanup error:", error);
      toast.error("Lỗi khi lọc tài khoản vi phạm");
    } finally {
      setIsCleaningUp(false);
    }
  }, [requests, fetchRequests, fetchGlobalCounts]);

  // ============================================
  // BATCH LOCK BY USER (gom mint requests)
  // ============================================

  // Group pending requests by actor_id + wallet
  const batchLockGroups = useMemo(() => {
    const pending = requests.filter(r => r.status === "pending" && !r.is_banned);
    const groups: Record<string, { actor_id: string; wallet: string; display_name: string; requests: MintRequestRow[] }> = {};
    for (const r of pending) {
      const key = `${r.actor_id}__${r.recipient_address}`;
      if (!groups[key]) {
        groups[key] = {
          actor_id: r.actor_id,
          wallet: r.recipient_address,
          display_name: r.profiles?.display_name || r.actor_id.slice(0, 8),
          requests: [],
        };
      }
      groups[key].requests.push(r);
    }
    // Only groups with 1+ pending requests
    return Object.values(groups).filter(g => g.requests.length > 0).sort((a, b) => b.requests.length - a.requests.length);
  }, [requests]);

  const batchLockTotalUsers = batchLockGroups.length;
  const batchLockTotalActions = batchLockGroups.reduce((s, g) => s + g.requests.length, 0);
  const batchLockTotalFun = batchLockGroups.reduce((s, g) => s + g.requests.reduce((ss, r) => ss + r.amount, 0), 0);

  const handleBatchLockByUser = useCallback(async () => {
    if (batchLockGroups.length === 0) {
      toast.info("Không có yêu cầu pending nào để gom");
      return;
    }

    setShowBatchLockConfirm(false);
    setIsBatchLocking(true);
    setBatchLockProgress({ done: 0, total: batchLockGroups.length, current: "" });

    let successCount = 0;
    let failCount = 0;
    let totalMinted = 0;

    for (let i = 0; i < batchLockGroups.length; i++) {
      const group = batchLockGroups[i];
      setBatchLockProgress({ done: i, total: batchLockGroups.length, current: group.display_name });

      try {
        const { data, error } = await supabase.functions.invoke("pplp-batch-lock", {
          body: { actor_id: group.actor_id, wallet_address: group.wallet },
        });

        if (error) {
          throw error;
        } else if (data?.blocked) {
          console.warn(`[Batch] 🚫 ${group.display_name}: bị chặn do fraud signals (${data.count})`);
          failCount++;
        } else if (data?.skipped) {
          console.log(`[Batch] ⏭ ${group.display_name}: đã xử lý trước đó, bỏ qua`);
          successCount++;
        } else if (data?.success) {
          successCount++;
          totalMinted += data.user_amount || 0;
          console.log(`[Batch] ✓ ${group.display_name}: ${group.requests.length} actions → TX: ${data.tx_hash}`);
        } else {
          failCount++;
          console.error(`[Batch] ✗ ${group.display_name}: ${data?.error}`);
        }
      } catch (e: any) {
        failCount++;
        console.error(`[Batch] ✗ ${group.display_name}:`, e?.message || e);
      }

      setBatchLockProgress({ done: i + 1, total: batchLockGroups.length, current: group.display_name });
    }

    toast.success(
      `⚡ Gom & Ký hoàn tất: ${successCount} users thành công, ${failCount} thất bại. Tổng: ${totalMinted.toLocaleString()} FUN`,
      { duration: 8000 }
    );

    setIsBatchLocking(false);
    await Promise.all([fetchRequests(), fetchGlobalCounts()]);
  }, [batchLockGroups, fetchRequests, fetchGlobalCounts]);

  // Helper: extract error body from FunctionsHttpError (409 returns body in context)
  const extractErrorBody = async (error: unknown): Promise<string> => {
    try {
      // FunctionsHttpError has a context.body (ReadableStream) or context.json()
      const e = error as any;
      if (e?.context?.json) {
        const body = await e.context.json();
        return JSON.stringify(body);
      }
      if (e?.context?.text) {
        return await e.context.text();
      }
      if (e?.message) return e.message;
      return typeof error === 'object' ? JSON.stringify(error) : String(error);
    } catch {
      return String(error);
    }
  };

  const isAlreadyMintedError = (msg: string): boolean => {
    return msg.includes('already minted') || msg.includes('"error":"Action already minted');
  };

  const extractTxFromError = (msg: string): string => {
    try {
      const jsonMatch = msg.match(/\{.*\}/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tx_hash) return ` TX: ${parsed.tx_hash.slice(0, 10)}...`;
      }
    } catch { /* ignore */ }
    return '';
  };

  // Approve & sign a mint request (triggers backend to sign + execute on-chain)
  const handleApproveAndSign = useCallback(
    async (request: MintRequestRow) => {
      setProcessingIds((prev) => new Set(prev).add(request.id));

      try {
        toast.loading("Đang ký và gửi giao dịch on-chain...", { id: `approve-${request.id}` });

        const { data, error } = await supabase.functions.invoke("pplp-authorize-mint", {
          body: {
            action_id: request.action_id,
            wallet_address: request.recipient_address,
          },
        });

        // Handle 409 "already minted" gracefully
        if (error) {
          const errMsg = await extractErrorBody(error);

          if (isAlreadyMintedError(errMsg)) {
            const txInfo = extractTxFromError(errMsg);
            toast.info(`ℹ️ Action này đã được mint on-chain trước đó rồi.${txInfo}`, {
              id: `approve-${request.id}`,
              duration: 5000,
            });
            await fetchRequests();
            return;
          }
          throw error;
        }

        if (data?.tx_hash) {
          toast.success(`✅ Đã mint on-chain! TX: ${data.tx_hash.slice(0, 10)}...`, {
            id: `approve-${request.id}`,
          });
        } else if (data?.on_chain_error) {
          const errLabel = data.on_chain_error === "ATTESTER_NOT_REGISTERED" ? "Attester chưa đăng ký"
            : data.on_chain_error === "ACTION_NOT_REGISTERED" ? "Action chưa đăng ký"
            : data.on_chain_error === "INSUFFICIENT_GAS" ? "Thiếu tBNB"
            : data.on_chain_error === "RPC_FAILURE" ? "RPC thất bại"
            : "Contract revert";
          toast.warning(`⚠️ Đã ký nhưng on-chain thất bại: ${errLabel}`, {
            id: `approve-${request.id}`,
            duration: 8000,
          });
        } else if (data?.success) {
          toast.success("✅ Đã ký thành công. Chờ giao dịch on-chain.", {
            id: `approve-${request.id}`,
          });
        } else {
          toast.error(data?.error || "Lỗi không xác định", { id: `approve-${request.id}` });
        }

        await fetchRequests();
      } catch (error: unknown) {
        const errMsg = await extractErrorBody(error);

        if (isAlreadyMintedError(errMsg)) {
          const txInfo = extractTxFromError(errMsg);
          toast.info(`ℹ️ Action đã mint on-chain rồi.${txInfo}`, { id: `approve-${request.id}`, duration: 5000 });
          await fetchRequests();
        } else {
          console.error("Approve error:", error);
          toast.error(errMsg || "Lỗi khi phê duyệt", { id: `approve-${request.id}` });
        }
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
      }
    },
    [fetchRequests]
  );

  // Reject a mint request
  const handleReject = useCallback(
    async (request: MintRequestRow) => {
      setProcessingIds((prev) => new Set(prev).add(request.id));

      try {
        const { error } = await supabase
          .from("pplp_mint_requests")
          .update({ status: "rejected", updated_at: new Date().toISOString() })
          .eq("id", request.id);

        if (error) throw error;

        toast.success("❌ Đã từ chối mint request");
        await fetchRequests();
      } catch (error: any) {
        toast.error(error.message || "Lỗi khi từ chối");
      } finally {
        setProcessingIds((prev) => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
      }
    },
    [fetchRequests]
  );

  // Retry all signed requests
  const handleRetryAll = useCallback(async () => {
    const signedRequests = requests.filter((r) => r.status === "signed");
    if (signedRequests.length === 0) {
      toast.info("Không có giao dịch nào cần retry");
      return;
    }

    const confirmed = window.confirm(
      `Bạn sẽ retry ${signedRequests.length} giao dịch on-chain. Tiếp tục?`
    );
    if (!confirmed) return;

    setIsRetryingAll(true);
    setRetryProgress({ done: 0, total: signedRequests.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < signedRequests.length; i++) {
      const req = signedRequests[i];
      try {
        const { data, error } = await supabase.functions.invoke("pplp-authorize-mint", {
          body: {
            action_id: req.action_id,
            wallet_address: req.recipient_address,
          },
        });

        if (error) {
          const errMsg = await extractErrorBody(error);
          if (isAlreadyMintedError(errMsg)) { successCount++; continue; }
          throw error;
        }

        if (data?.tx_hash) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        const errMsg = await extractErrorBody(e);
        if (isAlreadyMintedError(errMsg)) { successCount++; } else { failCount++; }
      }

      setRetryProgress({ done: i + 1, total: signedRequests.length });
    }

    toast.success(
      `✅ Retry hoàn tất: ${successCount} thành công, ${failCount} thất bại`
    );

    setIsRetryingAll(false);
    await fetchRequests();
  }, [requests, fetchRequests]);

  // Filter by tab — banned requests are EXCLUDED from pending and shown in dedicated tab
  const filteredRequests = requests.filter((r) => {
    if (activeTab === "banned") return r.is_banned;
    if (activeTab === "pending") return r.status === "pending" && !r.is_banned;
    if (activeTab === "signed") return r.status === "signed";
    if (activeTab === "minted") return r.status === "minted";
    if (activeTab === "rejected") return r.status === "rejected" || r.status === "expired";
    return true;
  });

  const counts = {
    pending: requests.filter((r) => r.status === "pending" && !r.is_banned).length,
    signed: requests.filter((r) => r.status === "signed").length,
    minted: requests.filter((r) => r.status === "minted").length,
    rejected: requests.filter((r) => r.status === "rejected" || r.status === "expired").length,
    banned: requests.filter((r) => r.is_banned).length,
  };

  // Mini chart data: mints per day (last 7 days)
  const chartData = useMemo(() => {
    const days: { date: string; count: number; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dateStr = format(d, "yyyy-MM-dd");
      const label = format(d, "dd/MM");
      const dayMints = requests.filter(
        (r) => r.status === "minted" && r.minted_at && r.minted_at.startsWith(dateStr)
      );
      days.push({ date: label, count: dayMints.length, amount: dayMints.reduce((s, r) => s + r.amount, 0) });
    }
    return days;
  }, [requests]);

  // Pagination: only show visibleCount items
  const paginatedRequests = filteredRequests.slice(0, visibleCount);
  const hasMore = filteredRequests.length > visibleCount;

  const allSelected = filteredRequests.length > 0 && filteredRequests.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0;
  const selectedTotal = filteredRequests.filter((r) => selectedIds.has(r.id)).reduce((sum, r) => sum + r.amount, 0);

  // Clear selection + reset pagination when tab changes
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSelectedIds(new Set());
    setVisibleCount(50);
  }, []);

  // Toggle single selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select/deselect all in current tab
  const toggleSelectAll = useCallback(() => {
    const currentIds = filteredRequests.map((r) => r.id);
    const allCurrentSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.has(id));
    if (allCurrentSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentIds));
    }
  }, [filteredRequests, selectedIds]);

  // Batch approve selected
  const handleBatchApprove = useCallback(async () => {
    const selected = filteredRequests.filter((r) => selectedIds.has(r.id) && r.status === "pending");
    if (selected.length === 0) return;

    const confirmed = window.confirm(`Approve & Sign ${selected.length} yêu cầu? Tiếp tục?`);
    if (!confirmed) return;

    setIsBatchProcessing(true);
    setBatchProgress({ done: 0, total: selected.length });

    let success = 0, fail = 0;
    for (let i = 0; i < selected.length; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("pplp-authorize-mint", {
          body: { action_id: selected[i].action_id, wallet_address: selected[i].recipient_address },
        });
        if (error) {
          const errMsg = await extractErrorBody(error);
          if (isAlreadyMintedError(errMsg)) { success++; continue; }
          throw error;
        }
        if (data?.tx_hash || data?.success) success++;
        else fail++;
      } catch (e) {
        const errMsg = await extractErrorBody(e);
        if (isAlreadyMintedError(errMsg)) { success++; } else { fail++; }
      }
      setBatchProgress({ done: i + 1, total: selected.length });
    }

    toast.success(`✅ Batch: ${success} thành công, ${fail} thất bại`);
    setIsBatchProcessing(false);
    setSelectedIds(new Set());
    await fetchRequests();
  }, [filteredRequests, selectedIds, fetchRequests]);

  // Batch reject selected
  const handleBatchReject = useCallback(async () => {
    const selected = filteredRequests.filter((r) => selectedIds.has(r.id) && r.status === "pending");
    if (selected.length === 0) return;

    const confirmed = window.confirm(`Từ chối ${selected.length} yêu cầu? Tiếp tục?`);
    if (!confirmed) return;

    setIsBatchProcessing(true);
    setBatchProgress({ done: 0, total: selected.length });

    let success = 0;
    for (let i = 0; i < selected.length; i++) {
      try {
        const { error } = await supabase
          .from("pplp_mint_requests")
          .update({ status: "rejected", updated_at: new Date().toISOString() })
          .eq("id", selected[i].id);
        if (!error) success++;
      } catch {}
      setBatchProgress({ done: i + 1, total: selected.length });
    }

    toast.success(`❌ Đã từ chối ${success} yêu cầu`);
    setIsBatchProcessing(false);
    setSelectedIds(new Set());
    await fetchRequests();
  }, [filteredRequests, selectedIds, fetchRequests]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <AdminNavToolbar />

      <main className="flex-1 container mx-auto px-4 py-6 pt-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Mint Approval</h1>
                <p className="text-sm text-muted-foreground">
                  Xem xét và phê duyệt yêu cầu mint FUN Money
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <MintExportButton />
              {/* Toggle Pause Button */}
              <Button
                variant={mintPaused ? "default" : "outline"}
                size="sm"
                onClick={handleTogglePause}
                disabled={isTogglingPause}
                className={mintPaused
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"}
              >
                {isTogglingPause ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : mintPaused ? (
                  <PlayCircle className="h-4 w-4 mr-1" />
                ) : (
                  <PauseCircle className="h-4 w-4 mr-1" />
                )}
                {mintPaused ? "Mở lại Mint" : "Tạm dừng Mint"}
              </Button>
              {!mintPaused && counts.signed > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryAll}
                  disabled={isLoading || isRetryingAll}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                >
                  {isRetryingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      {retryProgress.done}/{retryProgress.total}
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-1" />
                      Retry All ({counts.signed})
                    </>
                  )}
                </Button>
              )}
              {/* Cleanup banned/suspicious button */}
              {(() => {
                const bannedCount = requests.filter(r => r.status === "pending" && r.is_banned).length;
                const suspiciousCount = requests.filter(r => r.status === "pending" && r.is_suspicious).length;
                return (bannedCount > 0 || suspiciousCount > 0) ? (
                  <Button
                    size="sm"
                    onClick={handleCleanupBanned}
                    disabled={isCleaningUp}
                    className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
                  >
                    {isCleaningUp ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Shield className="h-4 w-4 mr-1" />
                    )}
                    🛡️ Lọc vi phạm ({bannedCount + suspiciousCount})
                  </Button>
                ) : null;
              })()}
              {/* ⚡ Batch Lock by User */}
              {!mintPaused && batchLockTotalActions > 0 && (
                <>
                  <Button
                    size="sm"
                    onClick={() => setShowBatchLockConfirm(true)}
                    disabled={isBatchLocking}
                    className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                  >
                    {isBatchLocking ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        {batchLockProgress.done}/{batchLockProgress.total}
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-1" />
                        ⚡ Gom & Ký ({batchLockTotalUsers} users, {batchLockTotalActions} actions)
                      </>
                    )}
                  </Button>
                  {/* Confirm Dialog */}
                  {showBatchLockConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBatchLockConfirm(false)}>
                      <div className="bg-background border rounded-xl shadow-xl p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <Package className="h-5 w-5 text-violet-500" />
                          Gom & Ký theo User
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between p-2 rounded bg-muted">
                            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> Users</span>
                            <strong>{batchLockTotalUsers}</strong>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted">
                            <span className="flex items-center gap-1"><Zap className="h-4 w-4" /> Actions</span>
                            <strong>{batchLockTotalActions}</strong>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-muted">
                            <span className="flex items-center gap-1"><Coins className="h-4 w-4" /> Tổng FUN</span>
                            <strong className="text-amber-600">{batchLockTotalFun.toLocaleString("vi-VN")}</strong>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Mỗi user sẽ được gom tất cả pending requests thành 1 lệnh <code>lockWithPPLP</code> on-chain duy nhất. Tiết kiệm gas đáng kể.
                        </p>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => setShowBatchLockConfirm(false)}>
                            Hủy
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleBatchLockByUser}
                            className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                          >
                            <Package className="h-4 w-4 mr-1" />
                            Xác nhận gom {batchLockTotalUsers} users
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <Button variant="outline" size="sm" onClick={fetchRequests} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
            </div>
          </div>

          {/* 🚨 MINT PAUSED BANNER */}
          {mintPaused && (
            <Alert className="border-red-500 bg-red-50 dark:bg-red-950/40">
              <PauseCircle className="h-5 w-5 text-red-600" />
              <AlertTitle className="text-red-700 dark:text-red-400 font-bold text-base">
                🚨 HỆ THỐNG MINT ĐANG TẠM DỪNG
              </AlertTitle>
              <AlertDescription className="text-red-600 dark:text-red-300 text-sm mt-1">
                {pausedReason && <span className="block mb-1 font-medium">{pausedReason}</span>}
                Tất cả nút Sign / Mint / Retry đã bị vô hiệu hóa. Nhấn <strong>"Mở lại Mint"</strong> ở trên để khôi phục hệ thống.
              </AlertDescription>
            </Alert>
          )}

          {/* Info Alert */}
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
              <strong>Flow:</strong> User request mint → Admin review ở đây → Approve & Sign → 
              Backend gọi <code>lockWithPPLP</code> on-chain → FUN locked vào contract → 
              User activate → User claim về ví.
            </AlertDescription>
          </Alert>

          {/* Epoch Batch Minter Widget */}
          <EpochBatchProgress />

          {/* Batch/Retry Progress */}
          {(isRetryingAll || isBatchProcessing) && (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                <strong>{isRetryingAll ? "Đang retry on-chain..." : "Đang xử lý batch..."}</strong>{" "}
                {(isRetryingAll ? retryProgress : batchProgress).done}/{(isRetryingAll ? retryProgress : batchProgress).total} giao dịch
                <div className="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((isRetryingAll ? retryProgress : batchProgress).done / (isRetryingAll ? retryProgress : batchProgress).total) * 100}%` }}
                  />
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Batch Lock Progress */}
          {isBatchLocking && (
            <Alert className="border-violet-200 bg-violet-50 dark:bg-violet-950/30">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
              <AlertDescription className="text-violet-700 dark:text-violet-300 text-sm">
                <strong>⚡ Đang gom & ký theo user...</strong>{" "}
                {batchLockProgress.done}/{batchLockProgress.total} users
                {batchLockProgress.current && <span className="ml-1">— {batchLockProgress.current}</span>}
                <div className="mt-2 w-full bg-violet-200 dark:bg-violet-800 rounded-full h-2">
                  <div
                    className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(batchLockProgress.done / Math.max(1, batchLockProgress.total)) * 100}%` }}
                  />
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* On-chain Error Summary */}
          <OnChainErrorSummary requests={requests} />

          {/* Dashboard Stats Cards */}
          {globalCounts && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Pending</span>
                  </div>
                  <p className="text-2xl font-bold">{globalCounts.pending.toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-muted-foreground">{globalCounts.pendingFun.toLocaleString("vi-VN")} FUN</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FileCheck className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Signed</span>
                  </div>
                  <p className="text-2xl font-bold">{globalCounts.signed.toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-muted-foreground">{globalCounts.signedFun.toLocaleString("vi-VN")} FUN</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400">Minted</span>
                  </div>
                  <p className="text-2xl font-bold">{globalCounts.minted.toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-muted-foreground">{globalCounts.mintedFun.toLocaleString("vi-VN")} FUN</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Coins className="h-4 w-4 text-purple-600" />
                    <span className="text-xs font-medium text-purple-700 dark:text-purple-400">Tổng phân phối</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {(globalCounts.pendingFun + globalCounts.signedFun + globalCounts.mintedFun).toLocaleString("vi-VN")}
                  </p>
                  <p className="text-xs text-muted-foreground">FUN Money (all time)</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Mini Chart: Mints per day (7 days) */}
          {chartData.some(d => d.count > 0) && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Mint theo ngày (7 ngày gần nhất)</span>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={30} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === "count" ? [`${value} lệnh`, "Số lệnh"] : [`${value.toLocaleString()} FUN`, "Tổng FUN"]
                      }
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="pending" className="gap-1">
                <Clock className="h-3.5 w-3.5" />
                Chờ duyệt ({counts.pending})
              </TabsTrigger>
              <TabsTrigger value="banned" className="gap-1 text-destructive data-[state=active]:text-destructive">
                <Shield className="h-3.5 w-3.5" />
                🚫 Bị ban ({counts.banned})
              </TabsTrigger>
              <TabsTrigger value="signed" className="gap-1">
                <FileCheck className="h-3.5 w-3.5" />
                Đã ký ({globalCounts ? globalCounts.signed.toLocaleString("vi-VN") : counts.signed})
              </TabsTrigger>
              <TabsTrigger value="minted" className="gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Đã mint ({globalCounts ? globalCounts.minted.toLocaleString("vi-VN") : counts.minted})
              </TabsTrigger>
              <TabsTrigger value="rejected" className="gap-1">
                <XCircle className="h-3.5 w-3.5" />
                Từ chối ({counts.rejected})
              </TabsTrigger>
              <TabsTrigger value="batch-stats" className="gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                Batch Stats
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4 space-y-3">
              {activeTab === "batch-stats" ? (
                <BatchMintStats />
              ) : (<>
              {/* Banned tab warning banner */}
              {activeTab === "banned" && counts.banned > 0 && (
                <Alert className="border-destructive/50 bg-destructive/10">
                  <Shield className="h-4 w-4 text-destructive" />
                  <AlertTitle className="text-destructive font-bold">
                    🚫 Danh sách yêu cầu từ tài khoản bị ban ({counts.banned})
                  </AlertTitle>
                  <AlertDescription className="text-destructive/80 text-sm">
                    Các yêu cầu dưới đây thuộc về tài khoản đã bị đình chỉ vĩnh viễn.
                    Danh sách này được tách riêng để admin không nhầm lẫn khi ký duyệt.
                    Sử dụng nút <strong>"Lọc vi phạm"</strong> để từ chối hàng loạt.
                    {" "}Danh sách cập nhật <strong>realtime</strong> khi có tài khoản mới bị ban.
                  </AlertDescription>
                </Alert>
              )}
              {/* Select All Bar */}
              {!isLoading && filteredRequests.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Chọn tất cả"
                    />
                    <span className="text-sm font-medium">
                      {someSelected
                        ? `Đã chọn ${selectedIds.size} / ${filteredRequests.length}`
                        : "Chọn tất cả"}
                    </span>
                    {someSelected && (
                      <Badge variant="secondary" className="text-xs">
                        💰 {selectedTotal.toLocaleString("vi-VN")} FUN
                      </Badge>
                    )}
                  </div>
                  {someSelected && activeTab === "pending" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleBatchApprove}
                        disabled={isBatchProcessing || mintPaused}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                        title={mintPaused ? "Hệ thống mint đang tạm dừng" : undefined}
                      >
                        {isBatchProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckSquare className="h-4 w-4 mr-1" />
                        )}
                        Duyệt ({selectedIds.size})
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBatchReject}
                        disabled={isBatchProcessing || mintPaused}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Từ chối ({selectedIds.size})
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Không có yêu cầu nào trong mục này</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedRequests.map((req) => (
                    <MintRequestCard
                      key={req.id}
                      request={req}
                      isProcessing={processingIds.has(req.id)}
                      isSelected={selectedIds.has(req.id)}
                      onToggleSelect={() => toggleSelect(req.id)}
                      onApprove={() => handleApproveAndSign(req)}
                      onReject={() => handleReject(req)}
                      mintPaused={mintPaused}
                    />
                  ))}
                  {hasMore && (
                    <div className="text-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleCount((v) => v + 50)}
                      >
                        Hiện thêm ({filteredRequests.length - visibleCount} còn lại)
                      </Button>
                    </div>
                  )}
                </div>
              )}
              </>)}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// Individual mint request card
function MintRequestCard({
  request,
  isProcessing,
  isSelected,
  onToggleSelect,
  onApprove,
  onReject,
  mintPaused,
}: {
  request: MintRequestRow;
  isProcessing: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  mintPaused: boolean;
}) {
  const actionType = (request.pplp_actions as any)?.action_type || "UNKNOWN";
  const displayName = request.profiles?.display_name || request.actor_id.slice(0, 8);
  const statusInfo = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;

  return (
    <Card className={`transition-all hover:shadow-sm ${isSelected ? "ring-2 ring-primary/50 bg-primary/5" : ""} ${request.is_banned ? "border-red-400 bg-red-50/50 dark:bg-red-950/20" : request.is_suspicious ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20" : ""}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Checkbox */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Chọn yêu cầu ${request.id}`}
            className="shrink-0"
          />
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {ACTION_LABELS[actionType] || actionType}
              </span>
              <Badge variant={statusInfo.variant} className="text-xs">
                {statusInfo.label}
              </Badge>
              {request.is_banned && (
                <Badge className="text-xs bg-red-600 text-white border-red-600">
                  🚫 Tài khoản bị ban
                </Badge>
              )}
              {request.is_suspicious && !request.is_banned && (
                <Badge className="text-xs bg-orange-500 text-white border-orange-500">
                  ⚠️ Nghi gian lận
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: vi })}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>👤 {displayName}</span>
              <span>💰 <strong className="text-amber-600">{request.amount.toLocaleString("vi-VN")} FUN</strong></span>
              <span title={request.recipient_address}>
                🔗 {request.recipient_address.slice(0, 6)}...{request.recipient_address.slice(-4)}
              </span>
            </div>

            {request.tx_hash && (
              <a
                href={`https://testnet.bscscan.com/tx/${request.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                TX: {request.tx_hash.slice(0, 14)}...
              </a>
            )}

            {/* Multisig signature details */}
            {request.multisig_signatures && Object.keys(request.multisig_signatures).length > 0 && (
              <div className="mt-1 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  ✍️ Chữ ký ({(request.multisig_completed_groups || []).length}/3):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(["will", "wisdom", "love"] as const).map((group) => {
                    const sigData = request.multisig_signatures?.[group];
                    const groupLabels: Record<string, { label: string; emoji: string }> = {
                      will: { label: "Ý Chí", emoji: "💪" },
                      wisdom: { label: "Trí Tuệ", emoji: "🌟" },
                      love: { label: "Yêu Thương", emoji: "❤️" },
                    };
                    const info = groupLabels[group];
                    if (sigData) {
                      return (
                        <span
                          key={group}
                          className="inline-flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs"
                          title={`Ví: ${sigData.signer}\nKý lúc: ${sigData.signed_at || "N/A"}`}
                        >
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {info.emoji} {info.label}
                          <span className="text-muted-foreground">— {sigData.signer_name || sigData.signer?.slice(0, 8)}</span>
                        </span>
                      );
                    }
                    return (
                      <span
                        key={group}
                        className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        <Clock className="h-3 w-3" />
                        {info.emoji} {info.label} — Chưa ký
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {request.signature && !request.tx_hash && !request.multisig_signatures && (
              <p className="text-xs text-muted-foreground">
                ✍️ Đã ký bởi: {request.signer_address?.slice(0, 10)}...
              </p>
            )}

            {/* On-chain error diagnostic */}
            {request.status === "signed" && request.on_chain_error && (
              <OnChainErrorBanner
                error={request.on_chain_error}
                signerAddress={request.signer_address}
                actionType={actionType}
              />
            )}
          </div>

          {/* Right: Actions - Disabled when mint is paused */}
          {request.status === "pending" && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={isProcessing || mintPaused}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50"
                title={mintPaused ? "Hệ thống mint đang tạm dừng" : undefined}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Approve & Sign
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={isProcessing || mintPaused}
                className="text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </div>
          )}

          {request.status === "signed" && (
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={isProcessing || mintPaused}
                className="bg-gradient-to-r from-amber-500 to-orange-500 disabled:opacity-50"
                title={mintPaused ? "Hệ thống mint đang tạm dừng" : undefined}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Retry On-chain
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
