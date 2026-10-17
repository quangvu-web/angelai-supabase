import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, BellOff, CheckCircle2, Clock, XCircle, Users } from "lucide-react";

type StatusFilter = "all" | "notified" | "not_notified" | "claimed" | "pending" | "ineligible";

interface AuditRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  fun_allocated: number;
  alloc_status: string;
  eligible: boolean;
  ineligibility_reason: string | null;
  has_notification: boolean;
}

export default function NotificationAudit() {
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: cycles } = useQuery({
    queryKey: ["admin-notif-audit-cycles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pplp_mint_cycles")
        .select("id, cycle_number")
        .order("cycle_number", { ascending: true });
      return data || [];
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-notif-audit", selectedCycle],
    queryFn: async () => {
      if (!selectedCycle) return [];

      // Get all allocations for this cycle
      const { data: allocs } = await supabase
        .from("pplp_mint_allocations")
        .select("user_id, fun_allocated, status, eligible, ineligibility_reason")
        .eq("cycle_id", selectedCycle);

      if (!allocs || allocs.length === 0) return [];

      const userIds = allocs.map((a) => a.user_id);

      // Get notifications for this cycle
      const { data: notifs } = await supabase
        .from("notifications")
        .select("user_id")
        .eq("type", "fun_claim_available")
        .eq("reference_id", selectedCycle)
        .in("user_id", userIds);

      const notifiedSet = new Set((notifs || []).map((n) => n.user_id));

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p])
      );

      return allocs.map((a): AuditRow => {
        const profile = profileMap.get(a.user_id);
        return {
          user_id: a.user_id,
          display_name: profile?.display_name || null,
          email: null,
          fun_allocated: Number(a.fun_allocated) || 0,
          alloc_status: a.status || "pending",
          eligible: a.eligible ?? false,
          ineligibility_reason: a.ineligibility_reason || null,
          has_notification: notifiedSet.has(a.user_id),
        };
      });
    },
    enabled: !!selectedCycle,
  });

  const filtered = (rows || []).filter((r) => {
    switch (statusFilter) {
      case "notified": return r.has_notification;
      case "not_notified": return !r.has_notification && r.eligible;
      case "claimed": return r.alloc_status === "minted";
      case "pending": return r.eligible && r.alloc_status !== "minted";
      case "ineligible": return !r.eligible;
      default: return true;
    }
  });

  const counts = {
    total: (rows || []).length,
    notified: (rows || []).filter((r) => r.has_notification).length,
    not_notified: (rows || []).filter((r) => !r.has_notification && r.eligible).length,
    claimed: (rows || []).filter((r) => r.alloc_status === "minted").length,
    pending: (rows || []).filter((r) => r.eligible && r.alloc_status !== "minted").length,
    ineligible: (rows || []).filter((r) => !r.eligible).length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Notification Audit</h1>
          <p className="text-muted-foreground text-sm">Kiểm tra thông báo fun_claim_available theo cycle</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={selectedCycle} onValueChange={setSelectedCycle}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Chọn Cycle" />
            </SelectTrigger>
            <SelectContent>
              {(cycles || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Cycle #{c.cycle_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Lọc trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả ({counts.total})</SelectItem>
              <SelectItem value="notified">✅ Đã thông báo ({counts.notified})</SelectItem>
              <SelectItem value="not_notified">❌ Chưa thông báo ({counts.not_notified})</SelectItem>
              <SelectItem value="claimed">🎉 Đã claim ({counts.claimed})</SelectItem>
              <SelectItem value="pending">⏳ Chờ claim ({counts.pending})</SelectItem>
              <SelectItem value="ineligible">🚫 Không đủ ĐK ({counts.ineligible})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary cards */}
        {selectedCycle && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard icon={<Users className="h-4 w-4" />} label="Tổng" value={counts.total} />
            <SummaryCard icon={<Bell className="h-4 w-4 text-green-500" />} label="Đã thông báo" value={counts.notified} />
            <SummaryCard icon={<BellOff className="h-4 w-4 text-red-500" />} label="Chưa TB" value={counts.not_notified} />
            <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Đã claim" value={counts.claimed} />
            <SummaryCard icon={<Clock className="h-4 w-4 text-amber-500" />} label="Chờ claim" value={counts.pending} />
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Danh sách user {selectedCycle ? `(${filtered.length})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedCycle ? (
              <p className="text-muted-foreground text-sm">Chọn cycle để xem danh sách.</p>
            ) : isLoading ? (
              <p className="text-muted-foreground text-sm">Đang tải...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm">Không có user nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">FUN</TableHead>
                      <TableHead>Thông báo</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r, i) => (
                      <TableRow key={r.user_id}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[180px]">
                              {r.display_name || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {r.email || r.user_id.slice(0, 8)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {r.fun_allocated.toLocaleString("vi-VN")}
                        </TableCell>
                        <TableCell>
                          {r.has_notification ? (
                            <Badge variant="default" className="bg-green-600 text-xs">Đã gửi</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Chưa gửi</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!r.eligible ? (
                            <Badge variant="outline" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Ineligible</Badge>
                          ) : r.alloc_status === "minted" ? (
                            <Badge className="bg-emerald-600 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Claimed</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {r.ineligibility_reason || ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
