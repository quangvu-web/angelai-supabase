import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminNavToolbar from "@/components/admin/AdminNavToolbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, ShieldAlert, Loader2, ArrowRightLeft, Clock, Ban, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { getProfilePath } from "@/lib/profileUrl";

interface WhitelistEntry {
  id: string;
  user_id: string;
  reason: string;
  whitelisted_by: string | null;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null; handle?: string | null };
  confirmer?: { display_name: string | null };
}

interface BlacklistGroup {
  actor_id: string;
  signal_count: number;
  signal_types: string[];
  max_severity: number;
  details: string[];
  first_detected: string;
  last_detected: string;
  profile?: { display_name: string | null; avatar_url: string | null; handle?: string | null };
}

const SIGNAL_TYPE_VI: Record<string, string> = {
  SYBIL: "Nghi tài khoản giả",
  BOT: "Nghi bot tự động",
  SPAM: "Spam",
  COORDINATED: "Hành vi phối hợp",
  WALLET_CLUSTER: "Cụm ví đáng ngờ",
  CONTENT_DUPLICATE: "Nội dung trùng lặp",
  TIMING_PATTERN: "Mẫu thời gian bất thường",
  DEVICE_FINGERPRINT: "Trùng dấu vân tay thiết bị",
  IP_HASH: "Trùng IP",
  RAPID_ACTION: "Hành động quá nhanh",
};

const parseDetailVi = (detail: string): string => {
  try {
    const obj = JSON.parse(detail);
    const parts: string[] = [];
    if (obj.matched_users) parts.push(`Trùng với ${obj.matched_users} tài khoản khác`);
    if (obj.ip_hash) parts.push("Trùng IP");
    if (obj.device_fingerprint || obj.fingerprint) parts.push("Trùng dấu vân tay thiết bị");
    if (obj.similarity_score) parts.push(`Độ tương đồng: ${Math.round(obj.similarity_score * 100)}%`);
    if (obj.count) parts.push(`Số lần: ${obj.count}`);
    if (obj.wallet_address) parts.push(`Ví: ${obj.wallet_address.slice(0, 8)}...`);
    if (obj.reason) parts.push(obj.reason);
    if (obj.message) parts.push(obj.message);
    return parts.length > 0 ? parts.join("; ") : detail;
  } catch {
    return detail;
  }
};

const AdminTrustList = () => {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"to_bl" | "to_wl">("to_bl");
  const [targetUser, setTargetUser] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // Multi-select state
  const [selectedWL, setSelectedWL] = useState<Set<string>>(new Set());
  const [selectedBL, setSelectedBL] = useState<Set<string>>(new Set());
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchAction, setBatchAction] = useState<"to_bl" | "to_wl">("to_bl");
  const [batchReason, setBatchReason] = useState("");
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Suspend/Ban state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendType, setSuspendType] = useState<"temporary" | "permanent">("temporary");
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDuration, setSuspendDuration] = useState(7);
  const [suspendProcessing, setSuspendProcessing] = useState(false);
  const [suspendBatch, setSuspendBatch] = useState(false);

  // Filter states — WL
  const [wlSearch, setWlSearch] = useState("");
  const [wlReasonFilter, setWlReasonFilter] = useState("");

  // Filter states — BL
  const [blSearch, setBlSearch] = useState("");
  const [blTypeFilter, setBlTypeFilter] = useState("all");
  const [blSeverityFilter, setBlSeverityFilter] = useState("all");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchWhitelist(), fetchBlacklist()]);
    setSelectedWL(new Set());
    setSelectedBL(new Set());
    setLoading(false);
  };

  const fetchWhitelist = async () => {
    const { data } = await supabase.from("fraud_whitelist").select("*").order("created_at", { ascending: false });
    if (!data) return;
    const userIds = [...new Set([...data.map(d => d.user_id), ...data.filter(d => d.whitelisted_by).map(d => d.whitelisted_by!)])];
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url, handle").in("user_id", userIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setWhitelist(data.map(entry => ({
      ...entry,
      profile: profileMap.get(entry.user_id) || undefined,
      confirmer: entry.whitelisted_by ? profileMap.get(entry.whitelisted_by) || undefined : undefined,
    })));
  };

  const fetchBlacklist = async () => {
    const { data } = await supabase.from("pplp_fraud_signals").select("actor_id, signal_type, severity, details, created_at").eq("is_resolved", false).order("created_at", { ascending: false });
    if (!data) return;
    const grouped = new Map<string, BlacklistGroup>();
    for (const signal of data) {
      const detailText = typeof signal.details === 'object' && signal.details ? JSON.stringify(signal.details) : String(signal.details || '');
      const existing = grouped.get(signal.actor_id);
      if (existing) {
        existing.signal_count++;
        if (!existing.signal_types.includes(signal.signal_type)) existing.signal_types.push(signal.signal_type);
        existing.max_severity = Math.max(existing.max_severity, signal.severity);
        if (detailText && !existing.details.includes(detailText)) existing.details.push(detailText);
        if (signal.created_at < existing.first_detected) existing.first_detected = signal.created_at;
        if (signal.created_at > existing.last_detected) existing.last_detected = signal.created_at;
      } else {
        grouped.set(signal.actor_id, {
          actor_id: signal.actor_id, signal_count: 1, signal_types: [signal.signal_type],
          max_severity: signal.severity, details: detailText ? [detailText] : [],
          first_detected: signal.created_at, last_detected: signal.created_at,
        });
      }
    }
    const actorIds = Array.from(grouped.keys());
    const { data: activeSuspensions } = await supabase.from("user_suspensions").select("user_id").in("user_id", actorIds).is("lifted_at", null);
    const suspendedIds = new Set(activeSuspensions?.map(s => s.user_id) || []);
    const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, avatar_url, handle").in("user_id", actorIds);
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setBlacklist(Array.from(grouped.values()).filter(g => !suspendedIds.has(g.actor_id)).map(g => ({ ...g, profile: profileMap.get(g.actor_id) || undefined })).sort((a, b) => b.signal_count - a.signal_count));
  };

  const openDialog = (action: "to_bl" | "to_wl", userId: string, userName: string) => {
    setDialogAction(action);
    setTargetUser({ id: userId, name: userName });
    setReason("");
    setDialogOpen(true);
  };

  const handleTransfer = async () => {
    if (!targetUser || !reason.trim()) { toast.error("Vui lòng nhập lý do"); return; }
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;
      if (dialogAction === "to_bl") {
        await supabase.from("fraud_whitelist").delete().eq("user_id", targetUser.id);
        await supabase.from("pplp_fraud_signals").insert({
          actor_id: targetUser.id, signal_type: "ADMIN_FLAG", severity: 5,
          details: { reason: reason.trim(), flagged_by: adminId }, is_resolved: false,
        });
        toast.success(`Đã chuyển ${targetUser.name} sang Blacklist`);
      } else {
        await supabase.from("fraud_whitelist").insert({
          user_id: targetUser.id, reason: reason.trim(), whitelisted_by: adminId,
        });
        await supabase.from("pplp_fraud_signals").update({ is_resolved: true }).eq("actor_id", targetUser.id).eq("is_resolved", false);
        toast.success(`Đã chuyển ${targetUser.name} sang Whitelist`);
      }
      setDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast.error("Có lỗi xảy ra");
    } finally {
      setProcessing(false);
    }
  };

  const toggleWL = (userId: string) => {
    setSelectedWL(prev => { const next = new Set(prev); next.has(userId) ? next.delete(userId) : next.add(userId); return next; });
  };
  const toggleBL = (actorId: string) => {
    setSelectedBL(prev => { const next = new Set(prev); next.has(actorId) ? next.delete(actorId) : next.add(actorId); return next; });
  };
  const toggleAllWL = () => {
    setSelectedWL(prev => prev.size === whitelist.length ? new Set() : new Set(whitelist.map(e => e.user_id)));
  };
  const toggleAllBL = () => {
    setSelectedBL(prev => prev.size === blacklist.length ? new Set() : new Set(blacklist.map(g => g.actor_id)));
  };
  const openBatchDialog = (action: "to_bl" | "to_wl") => {
    setBatchAction(action);
    setBatchReason("");
    setBatchDialogOpen(true);
  };

  const handleBatchTransfer = async () => {
    if (!batchReason.trim()) { toast.error("Vui lòng nhập lý do"); return; }
    setBatchProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;
      const userIds = Array.from(batchAction === "to_bl" ? selectedWL : selectedBL);
      if (batchAction === "to_bl") {
        for (const uid of userIds) {
          await supabase.from("fraud_whitelist").delete().eq("user_id", uid);
          await supabase.from("pplp_fraud_signals").insert({
            actor_id: uid, signal_type: "ADMIN_FLAG", severity: 5,
            details: { reason: batchReason.trim(), flagged_by: adminId }, is_resolved: false,
          });
        }
        toast.success(`Đã chuyển ${userIds.length} user sang Blacklist`);
      } else {
        for (const uid of userIds) {
          await supabase.from("fraud_whitelist").insert({ user_id: uid, reason: batchReason.trim(), whitelisted_by: adminId });
          await supabase.from("pplp_fraud_signals").update({ is_resolved: true }).eq("actor_id", uid).eq("is_resolved", false);
        }
        toast.success(`Đã chuyển ${userIds.length} user sang Whitelist`);
      }
      setBatchDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast.error("Có lỗi xảy ra");
    } finally {
      setBatchProcessing(false);
    }
  };

  // Suspend/Ban handlers
  const openSuspendDialog = (type: "temporary" | "permanent", userId: string, userName: string, batch = false) => {
    setSuspendType(type);
    setSuspendTarget({ id: userId, name: userName });
    setSuspendReason("");
    setSuspendDuration(7);
    setSuspendBatch(batch);
    setSuspendDialogOpen(true);
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) { toast.error("Vui lòng nhập lý do"); return; }
    setSuspendProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      const userIds = suspendBatch ? Array.from(selectedBL) : (suspendTarget ? [suspendTarget.id] : []);
      if (userIds.length === 0) return;

      const suspendedUntil = suspendType === "temporary"
        ? new Date(Date.now() + suspendDuration * 24 * 60 * 60 * 1000).toISOString()
        : null;

      for (const uid of userIds) {
        await supabase.from("user_suspensions").insert({
          user_id: uid,
          suspension_type: suspendType,
          reason: suspendReason.trim(),
          created_by: adminId,
          suspended_until: suspendedUntil,
        });
        // Resolve all fraud signals
        await supabase.from("pplp_fraud_signals").update({ is_resolved: true }).eq("actor_id", uid).eq("is_resolved", false);
      }

      const label = suspendType === "temporary" ? "đình chỉ" : "cấm vĩnh viễn";
      toast.success(`Đã ${label} ${userIds.length} user`);
      setSuspendDialogOpen(false);
      await fetchData();
    } catch (err) {
      toast.error("Có lỗi xảy ra");
    } finally {
      setSuspendProcessing(false);
    }
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 5) return <Badge variant="destructive">Nghiêm trọng ({severity})</Badge>;
    if (severity >= 3) return <Badge className="bg-amber-500 text-white">Trung bình ({severity})</Badge>;
    return <Badge variant="secondary">Thấp ({severity})</Badge>;
  };

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: vi }); } catch { return dateStr; }
  };

  // Filtered data
  const filteredWL = whitelist.filter(entry => {
    const name = (entry.profile?.display_name || entry.user_id).toLowerCase();
    const handle = (entry.profile?.handle || "").toLowerCase();
    const search = wlSearch.toLowerCase();
    if (wlSearch && !name.includes(search) && !handle.includes(search)) return false;
    if (wlReasonFilter && !entry.reason.toLowerCase().includes(wlReasonFilter.toLowerCase())) return false;
    return true;
  });

  const allBLSignalTypes = [...new Set(blacklist.flatMap(g => g.signal_types))];

  const filteredBL = blacklist.filter(group => {
    const name = (group.profile?.display_name || group.actor_id).toLowerCase();
    const handle = (group.profile?.handle || "").toLowerCase();
    const search = blSearch.toLowerCase();
    if (blSearch && !name.includes(search) && !handle.includes(search)) return false;
    if (blTypeFilter !== "all" && !group.signal_types.includes(blTypeFilter)) return false;
    if (blSeverityFilter === "high" && group.max_severity < 5) return false;
    if (blSeverityFilter === "medium" && (group.max_severity < 3 || group.max_severity >= 5)) return false;
    if (blSeverityFilter === "low" && group.max_severity >= 3) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <AdminNavToolbar />
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Whitelist & Blacklist</h1>

        <Tabs defaultValue="whitelist">
          <TabsList className="mb-4">
            <TabsTrigger value="whitelist" className="gap-1.5"><ShieldCheck className="w-4 h-4" />Whitelist ({whitelist.length})</TabsTrigger>
            <TabsTrigger value="blacklist" className="gap-1.5"><ShieldAlert className="w-4 h-4" />Blacklist ({blacklist.length})</TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <TabsContent value="whitelist">
                {/* WL Filters */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Tìm user..." value={wlSearch} onChange={e => setWlSearch(e.target.value)} className="pl-9 h-9" />
                    {wlSearch && <button onClick={() => setWlSearch("")} className="absolute right-2.5 top-2.5"><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>}
                  </div>
                  <div className="relative min-w-[180px] max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Lọc theo lý do..." value={wlReasonFilter} onChange={e => setWlReasonFilter(e.target.value)} className="pl-9 h-9" />
                    {wlReasonFilter && <button onClick={() => setWlReasonFilter("")} className="absolute right-2.5 top-2.5"><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>}
                  </div>
                  <span className="text-xs text-muted-foreground">{filteredWL.length}/{whitelist.length} kết quả</span>
                </div>

                {selectedWL.size > 0 && (
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-muted/50 border">
                    <span className="text-sm font-medium">Đã chọn {selectedWL.size} user</span>
                    <Button variant="destructive" size="sm" onClick={() => openBatchDialog("to_bl")}>
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />Chuyển tất cả sang BL
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedWL(new Set())}>Bỏ chọn</Button>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={whitelist.length > 0 && selectedWL.size === whitelist.length} onCheckedChange={toggleAllWL} />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Lý do</TableHead>
                      <TableHead>Người xác nhận</TableHead>
                      <TableHead>Ngày thêm</TableHead>
                      <TableHead>Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWL.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{whitelist.length === 0 ? "Chưa có user nào trong whitelist" : "Không có kết quả phù hợp"}</TableCell></TableRow>
                    ) : filteredWL.map((entry) => (
                      <TableRow key={entry.id} className={selectedWL.has(entry.user_id) ? "bg-muted/30" : ""}>
                        <TableCell>
                          <Checkbox checked={selectedWL.has(entry.user_id)} onCheckedChange={() => toggleWL(entry.user_id)} />
                        </TableCell>
                        <TableCell>
                          <Link to={getProfilePath(entry.user_id, entry.profile?.handle)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Avatar className="w-8 h-8"><AvatarImage src={entry.profile?.avatar_url || ""} /><AvatarFallback>{(entry.profile?.display_name || "?")[0]}</AvatarFallback></Avatar>
                            <div>
                              <div className="font-medium">{entry.profile?.display_name || entry.user_id.slice(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">{entry.profile?.handle ? `@${entry.profile.handle}` : entry.user_id.slice(0, 8)}</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{entry.reason}</TableCell>
                        <TableCell>{entry.confirmer?.display_name || entry.whitelisted_by?.slice(0, 8) || "—"}</TableCell>
                        <TableCell>{formatDate(entry.created_at)}</TableCell>
                        <TableCell>
                          <Button variant="destructive" size="sm" onClick={() => openDialog("to_bl", entry.user_id, entry.profile?.display_name || entry.user_id.slice(0, 8))}>
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />Chuyển BL
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="blacklist">
                {/* BL Filters */}
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Tìm user..." value={blSearch} onChange={e => setBlSearch(e.target.value)} className="pl-9 h-9" />
                    {blSearch && <button onClick={() => setBlSearch("")} className="absolute right-2.5 top-2.5"><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>}
                  </div>
                  <Select value={blTypeFilter} onValueChange={setBlTypeFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Loại tín hiệu" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả loại</SelectItem>
                      {allBLSignalTypes.map(t => (
                        <SelectItem key={t} value={t}>{SIGNAL_TYPE_VI[t] || t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={blSeverityFilter} onValueChange={setBlSeverityFilter}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Mức nghiêm trọng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất cả mức</SelectItem>
                      <SelectItem value="high">Nghiêm trọng (≥5)</SelectItem>
                      <SelectItem value="medium">Trung bình (3-4)</SelectItem>
                      <SelectItem value="low">Thấp (&lt;3)</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">{filteredBL.length}/{blacklist.length} kết quả</span>
                </div>

                {selectedBL.size > 0 && (
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-muted/50 border flex-wrap">
                    <span className="text-sm font-medium">Đã chọn {selectedBL.size} user</span>
                    <Button variant="outline" size="sm" onClick={() => openBatchDialog("to_wl")}>
                      <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />Chuyển tất cả sang WL
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openSuspendDialog("temporary", "", "", true)}>
                      <Clock className="w-3.5 h-3.5 mr-1" />Đình chỉ tất cả
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => openSuspendDialog("permanent", "", "", true)}>
                      <Ban className="w-3.5 h-3.5 mr-1" />Cấm vĩnh viễn tất cả
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedBL(new Set())}>Bỏ chọn</Button>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={blacklist.length > 0 && selectedBL.size === blacklist.length} onCheckedChange={toggleAllBL} />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Số tín hiệu</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Mức nghiêm trọng</TableHead>
                      <TableHead>Lý do chi tiết</TableHead>
                      <TableHead>Phát hiện</TableHead>
                      <TableHead>Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBL.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{blacklist.length === 0 ? "Không có tín hiệu gian lận chưa xử lý" : "Không có kết quả phù hợp"}</TableCell></TableRow>
                    ) : filteredBL.map((group) => (
                      <TableRow key={group.actor_id} className={selectedBL.has(group.actor_id) ? "bg-muted/30" : ""}>
                        <TableCell>
                          <Checkbox checked={selectedBL.has(group.actor_id)} onCheckedChange={() => toggleBL(group.actor_id)} />
                        </TableCell>
                        <TableCell>
                          <Link to={getProfilePath(group.actor_id, group.profile?.handle)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Avatar className="w-8 h-8"><AvatarImage src={group.profile?.avatar_url || ""} /><AvatarFallback>{(group.profile?.display_name || "?")[0]}</AvatarFallback></Avatar>
                            <div>
                              <div className="font-medium">{group.profile?.display_name || group.actor_id.slice(0, 8)}</div>
                              <div className="text-xs text-muted-foreground">{group.profile?.handle ? `@${group.profile.handle}` : group.actor_id.slice(0, 8)}</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell><Badge variant="destructive">{group.signal_count}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {group.signal_types.map(t => (
                              <Badge key={t} variant="outline" className="text-xs">{SIGNAL_TYPE_VI[t] || t}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{getSeverityBadge(group.max_severity)}</TableCell>
                        <TableCell className="max-w-sm">
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {group.details.slice(0, 3).map((d, i) => (
                              <div key={i} className="line-clamp-1">• {parseDetailVi(d)}</div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(group.first_detected)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <Button variant="outline" size="sm" onClick={() => openDialog("to_wl", group.actor_id, group.profile?.display_name || group.actor_id.slice(0, 8))}>
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />WL
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openSuspendDialog("temporary", group.actor_id, group.profile?.display_name || group.actor_id.slice(0, 8))}>
                              <Clock className="w-3.5 h-3.5 mr-1" />Đình chỉ
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => openSuspendDialog("permanent", group.actor_id, group.profile?.display_name || group.actor_id.slice(0, 8))}>
                              <Ban className="w-3.5 h-3.5 mr-1" />Cấm
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Single user transfer dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === "to_bl" ? "Chuyển sang Blacklist" : "Chuyển sang Whitelist"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === "to_bl"
                ? `Xác nhận chuyển "${targetUser?.name}" từ Whitelist sang Blacklist.`
                : `Xác nhận chuyển "${targetUser?.name}" từ Blacklist sang Whitelist.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Nhập lý do chuyển đổi..." value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[80px]" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransfer} disabled={processing || !reason.trim()}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch transfer dialog */}
      <AlertDialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {batchAction === "to_bl" ? `Chuyển ${selectedWL.size} user sang Blacklist` : `Chuyển ${selectedBL.size} user sang Whitelist`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {batchAction === "to_bl"
                ? `Xác nhận chuyển ${selectedWL.size} user đã chọn từ Whitelist sang Blacklist.`
                : `Xác nhận chuyển ${selectedBL.size} user đã chọn từ Blacklist sang Whitelist.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Nhập lý do chung cho tất cả..." value={batchReason} onChange={(e) => setBatchReason(e.target.value)} className="min-h-[80px]" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchProcessing}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchTransfer} disabled={batchProcessing || !batchReason.trim()}>
              {batchProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Xác nhận ({batchAction === "to_bl" ? selectedWL.size : selectedBL.size} user)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Suspend/Ban dialog */}
      <AlertDialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendType === "temporary"
                ? (suspendBatch ? `Đình chỉ ${selectedBL.size} user` : `Đình chỉ tạm thời "${suspendTarget?.name}"`)
                : (suspendBatch ? `Cấm vĩnh viễn ${selectedBL.size} user` : `Cấm vĩnh viễn "${suspendTarget?.name}"`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendType === "temporary"
                ? "Tài khoản sẽ bị đình chỉ trong thời gian quy định. Tất cả tín hiệu gian lận sẽ được đánh dấu đã xử lý."
                : "Tài khoản sẽ bị cấm vĩnh viễn, không thể đăng nhập hay sử dụng hệ thống. Hành động này không thể hoàn tác dễ dàng."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {suspendType === "temporary" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Số ngày đình chỉ</label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={suspendDuration}
                  onChange={(e) => setSuspendDuration(Math.max(1, parseInt(e.target.value) || 7))}
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Lý do</label>
              <Textarea
                placeholder={suspendType === "temporary" ? "Nhập lý do đình chỉ..." : "Nhập lý do cấm vĩnh viễn..."}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suspendProcessing}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              disabled={suspendProcessing || !suspendReason.trim()}
              className={suspendType === "permanent" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {suspendProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {suspendType === "temporary" ? `Đình chỉ ${suspendDuration} ngày` : "Cấm vĩnh viễn"}
              {suspendBatch ? ` (${selectedBL.size} user)` : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTrustList;
