import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Users, Repeat, ExternalLink, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { format, subDays, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import camlyCoinLogo from "@/assets/camly-coin-logo.png";

interface GiftRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  gift_type: string;
  context_type: string;
  message: string | null;
  tx_hash: string | null;
  created_at: string;
}

interface ProfileMap {
  [id: string]: { display_name: string | null; avatar_url: string | null };
}

const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const PAGE_SIZE = 15;

const GIFT_TYPE_LABELS: Record<string, string> = {
  internal: "Nội bộ",
  web3: "Web3 CAMLY",
  web3_CAMLY: "Web3 CAMLY",
  web3_FUN: "Web3 FUN",
  web3_USDT: "Web3 USDT",
  web3_BNB: "Web3 BNB",
  web3_BTC: "Web3 BTC",
  direct: "Quà tặng",
};

const CONTEXT_TYPE_LABELS: Record<string, string> = {
  chat: "Thưởng chat",
  post: "Bài viết",
  comment: "Bình luận",
  bounty: "Bounty",
  lixi: "Lì xì",
  tip: "Tip",
  global: "Quà tặng",
  direct: "Quà tặng",
  dm_tip: "Tip nhắn tin",
  question: "Câu hỏi",
};

export default function UserTransactionStats() {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [userName, setUserName] = useState("");
  const [filter, setFilter] = useState<"all" | "sent" | "received">("all");
  const [giftTypeFilter, setGiftTypeFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!userId) return;
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Fetch sent gifts
      const { data: sent } = await supabase
        .from("coin_gifts")
        .select("id, sender_id, receiver_id, amount, gift_type, context_type, message, tx_hash, created_at")
        .eq("sender_id", userId);

      // Fetch received gifts
      const { data: received } = await supabase
        .from("coin_gifts")
        .select("id, sender_id, receiver_id, amount, gift_type, context_type, message, tx_hash, created_at")
        .eq("receiver_id", userId);

      const allGifts = [...(sent || []), ...(received || [])];
      // Deduplicate (self-gifts appear in both)
      const unique = Array.from(new Map(allGifts.map(g => [g.id, g])).values());
      setGifts(unique);

      // Get unique user IDs for profile lookup
      const userIds = new Set<string>();
      unique.forEach(g => { userIds.add(g.sender_id); userIds.add(g.receiver_id); });
      userIds.add(userId);

      const ids = Array.from(userIds);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);

      const map: ProfileMap = {};
      profs?.forEach(p => { map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
      setProfiles(map);
      setUserName(map[userId]?.display_name || "User");
    } catch (err) {
      console.error("Error fetching transaction stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredByTime = useMemo(() => {
    if (timeRange === "all") return gifts;
    const days = parseInt(timeRange);
    const cutoff = subDays(new Date(), days);
    return gifts.filter(g => new Date(g.created_at) >= cutoff);
  }, [gifts, timeRange]);

  const filtered = useMemo(() => {
    let list = filteredByTime;
    if (filter === "sent") list = list.filter(g => g.sender_id === userId);
    if (filter === "received") list = list.filter(g => g.receiver_id === userId);
    if (giftTypeFilter !== "all") {
      if (giftTypeFilter === "web3_CAMLY") {
        list = list.filter(g => g.gift_type === "web3" || g.gift_type === "web3_CAMLY");
      } else {
        list = list.filter(g => g.gift_type === giftTypeFilter);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(g => {
        const senderName = profiles[g.sender_id]?.display_name?.toLowerCase() || "";
        const receiverName = profiles[g.receiver_id]?.display_name?.toLowerCase() || "";
        return senderName.includes(q) || receiverName.includes(q) || g.tx_hash?.toLowerCase().includes(q);
      });
    }
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredByTime, filter, giftTypeFilter, search, userId, profiles]);

  // Stats
  const stats = useMemo(() => {
    const sent = filteredByTime.filter(g => g.sender_id === userId);
    const received = filteredByTime.filter(g => g.receiver_id === userId);
    const totalSent = sent.reduce((s, g) => s + g.amount, 0);
    const totalReceived = received.reduce((s, g) => s + g.amount, 0);
    const counterparties = new Set([
      ...sent.map(g => g.receiver_id),
      ...received.map(g => g.sender_id),
    ]);
    counterparties.delete(userId!);
    return {
      totalReceived,
      totalSent,
      totalTx: filteredByTime.length,
      uniqueUsers: counterparties.size,
    };
  }, [filteredByTime, userId]);

  // Stats by gift_type (coin type)
  const coinTypeStats = useMemo(() => {
    const map = new Map<string, { received: number; sent: number; count: number }>();
    filteredByTime.forEach(g => {
      // Normalize legacy 'web3' to 'web3_CAMLY'
      const key = g.gift_type === "web3" ? "web3_CAMLY" : g.gift_type;
      if (!map.has(key)) map.set(key, { received: 0, sent: 0, count: 0 });
      const entry = map.get(key)!;
      entry.count++;
      if (g.receiver_id === userId) entry.received += g.amount;
      if (g.sender_id === userId) entry.sent += g.amount;
    });
    return Array.from(map.entries())
      .map(([type, v]) => ({ type, label: GIFT_TYPE_LABELS[type] || type, ...v }))
      .sort((a, b) => (b.received + b.sent) - (a.received + a.sent));
  }, [filteredByTime, userId]);


  const pieData = useMemo(() => {
    const received = filteredByTime.filter(g => g.receiver_id === userId);
    const map = new Map<string, number>();
    received.forEach(g => {
      const label = CONTEXT_TYPE_LABELS[g.context_type] || g.context_type;
      map.set(label, (map.get(label) || 0) + g.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredByTime, userId]);

  // Bar chart: top 10 counterparties
  const barData = useMemo(() => {
    const map = new Map<string, { sent: number; received: number }>();
    filteredByTime.forEach(g => {
      const other = g.sender_id === userId ? g.receiver_id : g.sender_id;
      if (other === userId) return;
      if (!map.has(other)) map.set(other, { sent: 0, received: 0 });
      const entry = map.get(other)!;
      if (g.sender_id === userId) entry.sent += g.amount;
      else entry.received += g.amount;
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({
        name: profiles[id]?.display_name || id.slice(0, 8),
        userId: id,
        sent: v.sent,
        received: v.received,
      }))
      .sort((a, b) => (b.sent + b.received) - (a.sent + a.received))
      .slice(0, 10);
  }, [filteredByTime, userId, profiles]);

  // Line chart: daily trend
  const lineData = useMemo(() => {
    const dayMap = new Map<string, { sent: number; received: number }>();
    filteredByTime.forEach(g => {
      const day = format(parseISO(g.created_at), "yyyy-MM-dd");
      if (!dayMap.has(day)) dayMap.set(day, { sent: 0, received: 0 });
      const entry = dayMap.get(day)!;
      if (g.sender_id === userId) entry.sent += g.amount;
      else entry.received += g.amount;
    });
    return Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date: format(parseISO(date), "dd/MM"), sent: v.sent, received: v.received }));
  }, [filteredByTime, userId]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const getName = (id: string) => profiles[id]?.display_name || id.slice(0, 8);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
        <Header />
        <div className="container max-w-6xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <Header />
      <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={`/user/${userId}`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">Thống kê giao dịch</h1>
            <p className="text-sm text-muted-foreground">{userName}</p>
          </div>
        </div>

        {/* Time range filter */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "7", label: "7 ngày" },
            { value: "30", label: "30 ngày" },
            { value: "90", label: "90 ngày" },
            { value: "all", label: "Tất cả" },
          ].map(t => (
            <Button
              key={t.value}
              variant={timeRange === t.value ? "default" : "outline"}
              size="sm"
              onClick={() => { setTimeRange(t.value); setPage(0); }}
              className="rounded-full text-xs"
            >
              {t.label}
            </Button>
          ))}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-4 h-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Tổng nhận</span>
              </div>
              <div className="flex items-center gap-1">
                <img src={camlyCoinLogo} className="w-5 h-5" alt="" />
                <span className="text-lg font-bold text-green-700">{stats.totalReceived.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-4 h-4 text-red-600" />
                <span className="text-xs text-muted-foreground">Tổng gửi</span>
              </div>
              <div className="flex items-center gap-1">
                <img src={camlyCoinLogo} className="w-5 h-5" alt="" />
                <span className="text-lg font-bold text-red-700">{stats.totalSent.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Repeat className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-muted-foreground">Số giao dịch</span>
              </div>
              <span className="text-lg font-bold text-blue-700">{stats.totalTx.toLocaleString()}</span>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-muted-foreground">User tương tác</span>
              </div>
              <span className="text-lg font-bold text-purple-700">{stats.uniqueUsers.toLocaleString()}</span>
            </CardContent>
          </Card>
        </div>

        {/* Coin type breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Thống kê theo loại coin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {coinTypeStats.map(ct => (
                <div key={ct.type} className="rounded-xl border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <img src={camlyCoinLogo} className="w-5 h-5" alt="" />
                    <span className="font-semibold text-sm text-foreground">{ct.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{ct.count} GD</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-green-600">
                      <ArrowDownLeft className="w-3 h-3" />Nhận: <strong>{ct.received.toLocaleString()}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                      <ArrowUpRight className="w-3 h-3" />Gửi: <strong>{ct.sent.toLocaleString()}</strong>
                    </span>
                  </div>
                </div>
              ))}
              {coinTypeStats.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-3 text-center py-4">Chưa có dữ liệu</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Pie: received by type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Nguồn nhận Camly</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => v.toLocaleString() + " Camly"} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-10">Chưa có dữ liệu</p>
              )}
            </CardContent>
          </Card>

          {/* Bar: top counterparties */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top 10 đối tác giao dịch</CardTitle>
            </CardHeader>
            <CardContent>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => v.toLocaleString() + " Camly"} />
                    <Legend />
                    <Bar dataKey="received" name="Nhận từ" fill="#10b981" stackId="a" />
                    <Bar dataKey="sent" name="Gửi đến" fill="#ef4444" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-10">Chưa có dữ liệu</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Line chart: trend */}
        {lineData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Xu hướng giao dịch theo ngày</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => v.toLocaleString() + " Camly"} />
                  <Legend />
                  <Line type="monotone" dataKey="received" name="Nhận" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sent" name="Gửi" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Transaction table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Chi tiết giao dịch</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Select value={filter} onValueChange={(v: any) => { setFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[130px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="sent">Đã gửi</SelectItem>
                  <SelectItem value="received">Đã nhận</SelectItem>
                </SelectContent>
              </Select>
              <Select value={giftTypeFilter} onValueChange={(v: string) => { setGiftTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả coin</SelectItem>
                  <SelectItem value="internal">Nội bộ</SelectItem>
                  <SelectItem value="web3_CAMLY">Web3 CAMLY</SelectItem>
                  <SelectItem value="web3_FUN">Web3 FUN</SelectItem>
                  <SelectItem value="web3_USDT">Web3 USDT</SelectItem>
                  <SelectItem value="web3_BNB">Web3 BNB</SelectItem>
                  <SelectItem value="web3_BTC">Web3 BTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Thời gian</TableHead>
                    <TableHead className="text-xs">Chiều</TableHead>
                    <TableHead className="text-xs">Đối tác</TableHead>
                    <TableHead className="text-xs text-right">Số lượng</TableHead>
                    <TableHead className="text-xs">Loại coin</TableHead>
                    <TableHead className="text-xs">Ngữ cảnh</TableHead>
                    <TableHead className="text-xs">Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                        Không có giao dịch nào
                      </TableCell>
                    </TableRow>
                  ) : pagedData.map(g => {
                    const isSent = g.sender_id === userId;
                    const otherId = isSent ? g.receiver_id : g.sender_id;
                    return (
                      <TableRow key={g.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(parseISO(g.created_at), "dd/MM/yy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {isSent ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600"><ArrowUpRight className="w-3 h-3" />Gửi</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600"><ArrowDownLeft className="w-3 h-3" />Nhận</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link to={`/user/${otherId}`} className="text-xs text-primary hover:underline">
                            {getName(otherId)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-xs font-semibold ${isSent ? "text-red-600" : "text-green-600"}`}>
                            {isSent ? "-" : "+"}{g.amount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground">
                          {GIFT_TYPE_LABELS[g.gift_type] || g.gift_type}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {CONTEXT_TYPE_LABELS[g.context_type] || g.context_type}
                        </TableCell>
                        <TableCell>
                          {g.tx_hash ? (
                            <a href={`https://bscscan.com/tx/${g.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-xs text-muted-foreground">Trang {page + 1}/{totalPages} ({filtered.length} giao dịch)</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
