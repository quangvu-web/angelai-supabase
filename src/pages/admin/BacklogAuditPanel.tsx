import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Play, RefreshCw, Loader2, AlertCircle, CheckCircle2, Ban } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { smartBack } from "@/lib/smartBack";

interface AuditRow {
  user_id: string;
  audit_group: "Aa" | "Ab" | "Ac";
  pending_fun: number;
  allocation_count: number;
  notes: string;
  audited_at: string;
}

interface AuditSummary {
  last_audit_at: string | null;
  groups: Record<"Aa" | "Ab" | "Ac", { user_count: number; total_fun: number; total_allocations: number }>;
  total_users: number;
  total_pending_fun: number;
}

const GROUP_META = {
  Aa: { label: "Aa — Chưa claim", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300", icon: AlertCircle },
  Ab: { label: "Ab — Claim lỗi", color: "bg-orange-500/15 text-orange-700 dark:text-orange-300", icon: RefreshCw },
  Ac: { label: "Ac — Loại trừ", color: "bg-destructive/15 text-destructive", icon: Ban },
} as const;

export default function BacklogAuditPanel() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filterGroup, setFilterGroup] = useState<"all" | "Aa" | "Ab" | "Ac">("all");

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["backlog-audit-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_backlog_audit_summary");
      if (error) throw error;
      return data as unknown as AuditSummary;
    },
    refetchInterval: 30_000,
  });

  const { data: rows, isLoading: loadingRows } = useQuery({
    queryKey: ["backlog-audit-rows", filterGroup],
    queryFn: async () => {
      let q = supabase
        .from("pplp_backlog_audit")
        .select("user_id, audit_group, pending_fun, allocation_count, notes, audited_at")
        .order("pending_fun", { ascending: false })
        .limit(200);
      if (filterGroup !== "all") q = q.eq("audit_group", filterGroup);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AuditRow[];
    },
  });

  const runAudit = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke("pplp-backlog-audit", {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any, dryRun) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const msg = dryRun
        ? `Dry-run xong: ${data.total_users} user phân loại`
        : `Đã lưu audit cho ${data.inserted} user`;
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["backlog-audit-summary"] });
      qc.invalidateQueries({ queryKey: ["backlog-audit-rows"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e.message}`),
  });

  const groupKeys: Array<"Aa" | "Ab" | "Ac"> = ["Aa", "Ab", "Ac"];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Quay lại
        </Button>
        <h1 className="text-2xl font-bold">📊 Backlog Audit Panel</h1>
      </div>

      {/* Action bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {summary?.last_audit_at ? (
              <>
                Audit gần nhất:{" "}
                <span className="font-medium text-foreground">
                  {formatDistanceToNow(new Date(summary.last_audit_at), { addSuffix: true, locale: vi })}
                </span>
              </>
            ) : (
              "Chưa có audit nào"
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => runAudit.mutate(true)}
              disabled={runAudit.isPending}
            >
              {runAudit.isPending && runAudit.variables === true ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Play className="w-3 h-3 mr-1" />
              )}
              Dry-run
            </Button>
            <Button size="sm" onClick={() => runAudit.mutate(false)} disabled={runAudit.isPending}>
              {runAudit.isPending && runAudit.variables === false ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3 mr-1" />
              )}
              Chạy & Lưu
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {groupKeys.map((g) => {
          const meta = GROUP_META[g];
          const Icon = meta.icon;
          const stat = summary?.groups?.[g] || { user_count: 0, total_fun: 0, total_allocations: 0 };
          return (
            <Card
              key={g}
              className={`cursor-pointer transition-all ${filterGroup === g ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilterGroup(filterGroup === g ? "all" : g)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge className={meta.color}>
                    <Icon className="w-3 h-3 mr-1" />
                    {meta.label}
                  </Badge>
                  <span className="text-2xl font-bold">{stat.user_count}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tổng FUN: <span className="font-bold text-amber-500">{Number(stat.total_fun).toLocaleString()}</span>
                </p>
                <p className="text-xs text-muted-foreground">{stat.total_allocations} allocations</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rows table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            Chi tiết{" "}
            {filterGroup !== "all" && (
              <Badge variant="outline" className="ml-2">
                {GROUP_META[filterGroup as "Aa" | "Ab" | "Ac"].label}
              </Badge>
            )}
          </CardTitle>
          {filterGroup !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setFilterGroup("all")}>
              Bỏ filter
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loadingRows || loadingSummary ? (
            <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
          ) : (rows?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Chưa có dữ liệu. Bấm <strong>Chạy & Lưu</strong> để tạo audit.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Nhóm</TableHead>
                    <TableHead className="text-right">Pending FUN</TableHead>
                    <TableHead className="text-right">Allocations</TableHead>
                    <TableHead>Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows!.map((r) => {
                    const meta = GROUP_META[r.audit_group];
                    return (
                      <TableRow key={r.user_id}>
                        <TableCell className="font-mono text-xs">
                          {r.user_id.slice(0, 8)}...{r.user_id.slice(-4)}
                        </TableCell>
                        <TableCell>
                          <Badge className={meta.color}>{r.audit_group}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-500">
                          {Number(r.pending_fun).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">{r.allocation_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                          {r.notes}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
