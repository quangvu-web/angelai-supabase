import { AdminLayout } from "@/components/layouts/AdminLayout";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Wallet, ArrowRightLeft, Users, TrendingUp, ShieldAlert, AlertTriangle, RotateCcw, Zap, Link as LinkIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { format, subDays, parseISO, differenceInMinutes } from "date-fns";

type TimeRange = "7d" | "30d" | "90d" | "all";

interface GiftTx {
  id: string;
  amount: number;
  tx_hash: string;
  gift_type: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  sender_name: string;
  receiver_name: string;
}

interface WithdrawalTx {
  id: string;
  amount: number;
  tx_hash: string;
  created_at: string;
  user_id: string;
  user_name: string;
  wallet_address: string;
}

// Sybil alert types
interface SybilAlert {
  id: string;
  type: "circular" | "rapid_fire" | "wallet_cluster" | "self_transfer";
  severity: "high" | "medium" | "low";
  description: string;
  users: string[];
  userNames: string[];
  evidence: string;
  totalAmount: number;
  txCount: number;
}

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(142 76% 36%)"];
const SHORT_HASH = (h: string) => h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "";

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  low: "bg-blue-500/15 text-blue-700 border-blue-500/30",
};

const ALERT_ICONS: Record<string, typeof RotateCcw> = {
  circular: RotateCcw,
  rapid_fire: Zap,
  wallet_cluster: LinkIcon,
  self_transfer: AlertTriangle,
};

const ALERT_LABELS: Record<string, string> = {
  circular: "Vòng tròn giao dịch",
  rapid_fire: "Gửi liên tục bất thường",
  wallet_cluster: "Cụm ví liên kết",
  self_transfer: "Tự chuyển cho mình",
};

export default function AdminOnChainDashboard() {
  const [gifts, setGifts] = useState<GiftTx[]>([]);
  const [allGiftsRaw, setAllGiftsRaw] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("30d");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const PAGE_SIZE = 20;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [gRes, wRes, allGRes] = await Promise.all([
        supabase
          .from("coin_gifts")
          .select("id, amount, tx_hash, gift_type, created_at, sender_id, receiver_id")
          .not("tx_hash", "is", null)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("coin_withdrawals")
          .select("id, amount, tx_hash, created_at, user_id, wallet_address")
          .eq("status", "completed")
          .not("tx_hash", "is", null)
          .order("created_at", { ascending: false })
          .limit(1000),
        // All gifts for Sybil detection (including internal)
        supabase
          .from("coin_gifts")
          .select("id, amount, tx_hash, gift_type, created_at, sender_id, receiver_id, context_type")
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      const allUserIds = new Set<string>();
      (gRes.data || []).forEach((g: any) => { allUserIds.add(g.sender_id); allUserIds.add(g.receiver_id); });
      (wRes.data || []).forEach((w: any) => { allUserIds.add(w.user_id); });
      (allGRes.data || []).forEach((g: any) => { allUserIds.add(g.sender_id); allUserIds.add(g.receiver_id); });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", [...allUserIds]);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.display_name || p.user_id.slice(0, 8); });

      setGifts((gRes.data || []).map((g: any) => ({
        id: g.id, amount: g.amount, tx_hash: g.tx_hash, gift_type: g.gift_type,
        created_at: g.created_at, sender_id: g.sender_id, receiver_id: g.receiver_id,
        sender_name: nameMap[g.sender_id] || g.sender_id?.slice(0, 8) || "?",
        receiver_name: nameMap[g.receiver_id] || g.receiver_id?.slice(0, 8) || "?",
      })));

      setAllGiftsRaw((allGRes.data || []).map((g: any) => ({
        ...g,
        sender_name: nameMap[g.sender_id] || g.sender_id?.slice(0, 8) || "?",
        receiver_name: nameMap[g.receiver_id] || g.receiver_id?.slice(0, 8) || "?",
      })));

      setWithdrawals((wRes.data || []).map((w: any) => ({
        id: w.id, amount: w.amount, tx_hash: w.tx_hash, created_at: w.created_at,
        user_id: w.user_id, user_name: nameMap[w.user_id] || w.user_id?.slice(0, 8) || "?",
        wallet_address: w.wallet_address,
      })));

      setLoading(false);
    })();
  }, []);

  const cutoff = range === "all" ? null : subDays(new Date(), range === "7d" ? 7 : range === "30d" ? 30 : 90);
  const filteredGifts = useMemo(() => cutoff ? gifts.filter(g => new Date(g.created_at) >= cutoff) : gifts, [gifts, cutoff]);
  const filteredWithdrawals = useMemo(() => cutoff ? withdrawals.filter(w => new Date(w.created_at) >= cutoff) : withdrawals, [withdrawals, cutoff]);
  const filteredAllGifts = useMemo(() => cutoff ? allGiftsRaw.filter((g: any) => new Date(g.created_at) >= cutoff) : allGiftsRaw, [allGiftsRaw, cutoff]);

  // ===================== SYBIL DETECTION =====================
  const sybilAlerts = useMemo((): SybilAlert[] => {
    const alerts: SybilAlert[] = [];
    const data = filteredAllGifts;
    let alertId = 0;

    // 1. Self-transfers (sender === receiver)
    const selfTransfers = data.filter((g: any) => g.sender_id === g.receiver_id);
    if (selfTransfers.length > 0) {
      const grouped = new Map<string, any[]>();
      selfTransfers.forEach((g: any) => {
        if (!grouped.has(g.sender_id)) grouped.set(g.sender_id, []);
        grouped.get(g.sender_id)!.push(g);
      });
      grouped.forEach((txs, userId) => {
        alerts.push({
          id: `self-${alertId++}`,
          type: "self_transfer",
          severity: txs.length >= 5 ? "high" : txs.length >= 2 ? "medium" : "low",
          description: `${txs[0].sender_name} tự chuyển Camly cho chính mình ${txs.length} lần`,
          users: [userId],
          userNames: [txs[0].sender_name],
          evidence: `Tổng ${txs.reduce((s: number, t: any) => s + t.amount, 0).toLocaleString()} Camly qua ${txs.length} giao dịch`,
          totalAmount: txs.reduce((s: number, t: any) => s + t.amount, 0),
          txCount: txs.length,
        });
      });
    }

    // 2. Circular transfers (A→B and B→A)
    const pairMap = new Map<string, { ab: any[]; ba: any[] }>();
    data.forEach((g: any) => {
      if (g.sender_id === g.receiver_id) return;
      const key = [g.sender_id, g.receiver_id].sort().join("|");
      if (!pairMap.has(key)) pairMap.set(key, { ab: [], ba: [] });
      const entry = pairMap.get(key)!;
      if (g.sender_id < g.receiver_id) entry.ab.push(g);
      else entry.ba.push(g);
    });

    pairMap.forEach((pair, key) => {
      if (pair.ab.length >= 2 && pair.ba.length >= 2) {
        const allTxs = [...pair.ab, ...pair.ba];
        const userA = pair.ab[0].sender_id;
        const userB = pair.ab[0].receiver_id;
        const totalAmount = allTxs.reduce((s: number, t: any) => s + t.amount, 0);
        alerts.push({
          id: `circular-${alertId++}`,
          type: "circular",
          severity: allTxs.length >= 10 ? "high" : allTxs.length >= 5 ? "medium" : "low",
          description: `Giao dịch vòng tròn giữa ${pair.ab[0].sender_name} ↔ ${pair.ab[0].receiver_name}`,
          users: [userA, userB],
          userNames: [pair.ab[0].sender_name, pair.ab[0].receiver_name],
          evidence: `${pair.ab.length} lần A→B, ${pair.ba.length} lần B→A, tổng ${totalAmount.toLocaleString()} Camly`,
          totalAmount,
          txCount: allTxs.length,
        });
      }
    });

    // 3. Rapid-fire transfers (same sender, >5 txs within 30 minutes)
    const bySender = new Map<string, any[]>();
    data.forEach((g: any) => {
      if (!bySender.has(g.sender_id)) bySender.set(g.sender_id, []);
      bySender.get(g.sender_id)!.push(g);
    });

    bySender.forEach((txs, senderId) => {
      if (txs.length < 5) return;
      const sorted = txs.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      // Sliding window: 5 txs within 30 min
      for (let i = 0; i <= sorted.length - 5; i++) {
        const window = sorted.slice(i, i + 5);
        const diffMin = differenceInMinutes(new Date(window[4].created_at), new Date(window[0].created_at));
        if (diffMin <= 30) {
          // Find full burst
          let end = i + 5;
          while (end < sorted.length && differenceInMinutes(new Date(sorted[end].created_at), new Date(window[0].created_at)) <= 30) end++;
          const burst = sorted.slice(i, end);
          const totalAmt = burst.reduce((s: number, t: any) => s + t.amount, 0);
          const uniqueReceivers = new Set(burst.map((t: any) => t.receiver_id));
          alerts.push({
            id: `rapid-${alertId++}`,
            type: "rapid_fire",
            severity: burst.length >= 15 ? "high" : burst.length >= 8 ? "medium" : "low",
            description: `${sorted[0].sender_name} gửi ${burst.length} giao dịch trong ${diffMin} phút đến ${uniqueReceivers.size} user`,
            users: [senderId],
            userNames: [sorted[0].sender_name],
            evidence: `${burst.length} giao dịch, tổng ${totalAmt.toLocaleString()} Camly trong ≤30 phút`,
            totalAmount: totalAmt,
            txCount: burst.length,
          });
          break; // One alert per sender
        }
      }
    });

    // 4. Wallet clustering: users who share the same withdrawal wallet
    const walletUsers = new Map<string, Set<string>>();
    const walletNames = new Map<string, Set<string>>();
    withdrawals.forEach(w => {
      if (!walletUsers.has(w.wallet_address)) {
        walletUsers.set(w.wallet_address, new Set());
        walletNames.set(w.wallet_address, new Set());
      }
      walletUsers.get(w.wallet_address)!.add(w.user_id);
      walletNames.get(w.wallet_address)!.add(w.user_name);
    });

    walletUsers.forEach((users, wallet) => {
      if (users.size >= 2) {
        const names = Array.from(walletNames.get(wallet) || []);
        const relatedW = withdrawals.filter(w => w.wallet_address === wallet);
        const totalAmt = relatedW.reduce((s, w) => s + w.amount, 0);
        alerts.push({
          id: `cluster-${alertId++}`,
          type: "wallet_cluster",
          severity: users.size >= 4 ? "high" : users.size >= 3 ? "medium" : "low",
          description: `${users.size} tài khoản rút tiền về cùng ví ${SHORT_HASH(wallet)}`,
          users: Array.from(users),
          userNames: names,
          evidence: `Ví: ${SHORT_HASH(wallet)}, ${relatedW.length} lần rút, tổng ${totalAmt.toLocaleString()} Camly`,
          totalAmount: totalAmt,
          txCount: relatedW.length,
        });
      }
    });

    return alerts.sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 };
      return sev[b.severity] - sev[a.severity] || b.totalAmount - a.totalAmount;
    });
  }, [filteredAllGifts, withdrawals]);

  const sybilStats = useMemo(() => ({
    total: sybilAlerts.length,
    high: sybilAlerts.filter(a => a.severity === "high").length,
    medium: sybilAlerts.filter(a => a.severity === "medium").length,
    low: sybilAlerts.filter(a => a.severity === "low").length,
    totalSuspiciousAmount: sybilAlerts.reduce((s, a) => s + a.totalAmount, 0),
  }), [sybilAlerts]);

  // ===================== EXISTING STATS =====================
  const totalTx = filteredGifts.length + filteredWithdrawals.length;
  const totalValue = filteredGifts.reduce((s, g) => s + g.amount, 0) + filteredWithdrawals.reduce((s, w) => s + w.amount, 0);
  const uniqueWallets = new Set([
    ...filteredGifts.map(g => g.sender_name),
    ...filteredGifts.map(g => g.receiver_name),
    ...filteredWithdrawals.map(w => w.wallet_address),
  ]).size;

  const lineData = useMemo(() => {
    const map: Record<string, { gifts: number; withdrawals: number }> = {};
    filteredGifts.forEach(g => {
      const d = format(parseISO(g.created_at), "yyyy-MM-dd");
      if (!map[d]) map[d] = { gifts: 0, withdrawals: 0 };
      map[d].gifts++;
    });
    filteredWithdrawals.forEach(w => {
      const d = format(parseISO(w.created_at), "yyyy-MM-dd");
      if (!map[d]) map[d] = { gifts: 0, withdrawals: 0 };
      map[d].withdrawals++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: format(parseISO(date), "dd/MM"), gifts: v.gifts, withdrawals: v.withdrawals }));
  }, [filteredGifts, filteredWithdrawals]);

  const pieData = useMemo(() => {
    const typeMap: Record<string, number> = {};
    filteredGifts.forEach(g => { typeMap[g.gift_type] = (typeMap[g.gift_type] || 0) + 1; });
    if (filteredWithdrawals.length) typeMap["withdrawal"] = filteredWithdrawals.length;
    return Object.entries(typeMap).map(([name, value]) => ({ name, value }));
  }, [filteredGifts, filteredWithdrawals]);

  const barData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredGifts.forEach(g => { map[g.sender_name] = (map[g.sender_name] || 0) + g.amount; });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, total]) => ({ name: name.length > 12 ? name.slice(0, 12) + "…" : name, total }));
  }, [filteredGifts]);

  const allRows = useMemo(() => {
    const rows = [
      ...filteredGifts.map(g => ({
        id: g.id, time: g.created_at, from: g.sender_name, to: g.receiver_name, amount: g.amount, tx_hash: g.tx_hash, type: g.gift_type,
      })),
      ...filteredWithdrawals.map(w => ({
        id: w.id, time: w.created_at, from: w.user_name, to: SHORT_HASH(w.wallet_address), amount: w.amount, tx_hash: w.tx_hash, type: "withdrawal",
      })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    if (search) {
      const q = search.toLowerCase();
      return rows.filter(r => r.from.toLowerCase().includes(q) || r.to.toLowerCase().includes(q) || r.tx_hash.toLowerCase().includes(q));
    }
    return rows;
  }, [filteredGifts, filteredWithdrawals, search]);

  const pagedRows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(allRows.length / PAGE_SIZE);
  const fmt = (n: number) => n.toLocaleString("vi-VN");

  if (loading) {
    return (
      <AdminLayout>
        <div className="container mx-auto p-4 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Thống kê On-Chain (BSC)
          </h1>
          <div className="flex gap-1">
            {(["7d", "30d", "90d", "all"] as TimeRange[]).map(r => (
              <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => { setRange(r); setPage(0); }} className="text-xs">
                {r === "all" ? "Tất cả" : r}
              </Button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview" className="text-xs">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />Tổng quan
            </TabsTrigger>
            <TabsTrigger value="sybil" className="text-xs relative">
              <ShieldAlert className="w-3.5 h-3.5 mr-1" />Phát hiện Sybil
              {sybilStats.high > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
                  {sybilStats.high}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ==================== OVERVIEW TAB ==================== */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Tổng giao dịch</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-foreground flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-primary" />{fmt(totalTx)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Tổng giá trị Camly</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />{fmt(totalValue)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ví tham gia</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-primary" />{fmt(uniqueWallets)}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Withdrawals</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" />{fmt(filteredWithdrawals.length)}</p></CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Xu hướng giao dịch</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                      <Legend />
                      <Line type="monotone" dataKey="gifts" name="Quà tặng" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="withdrawals" name="Rút tiền" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Phân loại giao dịch</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} fontSize={11}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-sm">Top 10 người gửi on-chain</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={10} stroke="hsl(var(--muted-foreground))" />
                      <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                      <Bar dataKey="total" name="Tổng Camly" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm">Chi tiết giao dịch ({allRows.length})</CardTitle>
                <Input placeholder="Tìm user hoặc tx_hash…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="max-w-xs h-8 text-xs" />
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Thời gian</TableHead>
                      <TableHead className="text-xs">Từ</TableHead>
                      <TableHead className="text-xs">Đến</TableHead>
                      <TableHead className="text-xs text-right">Số lượng</TableHead>
                      <TableHead className="text-xs">Loại</TableHead>
                      <TableHead className="text-xs">Tx Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs whitespace-nowrap">{format(parseISO(r.time), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{r.from}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{r.to}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{fmt(r.amount)}</TableCell>
                        <TableCell><span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{r.type}</span></TableCell>
                        <TableCell>
                          <a href={`https://bscscan.com/tx/${r.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                            {SHORT_HASH(r.tx_hash)} <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pagedRows.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">Không có giao dịch on-chain</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t">
                    <span className="text-xs text-muted-foreground">Trang {page + 1}/{totalPages}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-xs h-7">←</Button>
                      <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="text-xs h-7">→</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== SYBIL TAB ==================== */}
          <TabsContent value="sybil" className="space-y-6 mt-4">
            {/* Sybil Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-4 h-4 text-destructive" />
                    <span className="text-xs text-muted-foreground">Tổng cảnh báo</span>
                  </div>
                  <span className="text-2xl font-bold text-destructive">{sybilStats.total}</span>
                </CardContent>
              </Card>
              <Card className="border-destructive/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <span className="text-xs text-muted-foreground">Nghiêm trọng</span>
                  </div>
                  <span className="text-2xl font-bold text-destructive">{sybilStats.high}</span>
                </CardContent>
              </Card>
              <Card className="border-amber-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-xs text-muted-foreground">Trung bình</span>
                  </div>
                  <span className="text-2xl font-bold text-amber-600">{sybilStats.medium}</span>
                </CardContent>
              </Card>
              <Card className="border-blue-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Thấp</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{sybilStats.low}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tổng nghi vấn</span>
                  </div>
                  <span className="text-2xl font-bold text-foreground">{fmt(sybilStats.totalSuspiciousAmount)}</span>
                  <span className="text-xs text-muted-foreground ml-1">Camly</span>
                </CardContent>
              </Card>
            </div>

            {/* Alert type distribution */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(["self_transfer", "circular", "rapid_fire", "wallet_cluster"] as const).map(type => {
                const Icon = ALERT_ICONS[type];
                const count = sybilAlerts.filter(a => a.type === type).length;
                return (
                  <Card key={type} className={count > 0 ? "border-amber-500/20" : ""}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${count > 0 ? "bg-amber-500/10" : "bg-muted"}`}>
                        <Icon className={`w-4 h-4 ${count > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{ALERT_LABELS[type]}</p>
                        <p className="text-lg font-bold text-foreground">{count}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Alerts List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                  Chi tiết cảnh báo Sybil ({sybilAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sybilAlerts.length === 0 ? (
                  <div className="text-center py-12">
                    <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                    <p className="text-sm text-muted-foreground">Không phát hiện hoạt động Sybil bất thường 🎉</p>
                  </div>
                ) : (
                  sybilAlerts.map(alert => {
                    const Icon = ALERT_ICONS[alert.type];
                    return (
                      <div key={alert.id} className={`rounded-lg border p-4 ${SEVERITY_STYLES[alert.severity]}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="mt-0.5">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] ${SEVERITY_STYLES[alert.severity]}`}>
                                  {alert.severity === "high" ? "🔴 Nghiêm trọng" : alert.severity === "medium" ? "🟡 Trung bình" : "🔵 Thấp"}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {ALERT_LABELS[alert.type]}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium">{alert.description}</p>
                              <p className="text-xs opacity-80">{alert.evidence}</p>
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                {alert.userNames.map((name, i) => (
                                  <a
                                    key={alert.users[i]}
                                    href={`/user/${alert.users[i]}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs underline hover:opacity-70"
                                  >
                                    {name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">{fmt(alert.totalAmount)}</p>
                            <p className="text-[10px] opacity-70">{alert.txCount} giao dịch</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
