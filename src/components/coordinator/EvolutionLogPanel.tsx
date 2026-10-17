import { useState } from "react";
import { useEvolutionLog, EvolutionLogRow } from "@/hooks/useEvolutionLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Activity, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  dispatched: { label: "Đang gửi", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  pr_opened: { label: "PR mở", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  build_failed: { label: "Build FAIL", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  rejected: { label: "Từ chối", cls: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300" },
  rate_limited: { label: "Rate limit", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  merged: { label: "Đã merge", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  reverted: { label: "Rollback", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-300" },
};

export function EvolutionLogPanel() {
  const { rows, isLoading, filterStatus, setFilterStatus } = useEvolutionLog(50);
  const [openRow, setOpenRow] = useState<EvolutionLogRow | null>(null);

  return (
    <section className="p-5 rounded-xl border bg-card">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Activity className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Audit — Evolution Log</h2>
        <span className="text-xs text-muted-foreground">
          50 lần Angel sửa code gần nhất (Phase 0 Safety Gate)
        </span>
        <div className="ml-auto">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả status</SelectItem>
              <SelectItem value="dispatched">Đang gửi</SelectItem>
              <SelectItem value="pr_opened">PR mở</SelectItem>
              <SelectItem value="build_failed">Build FAIL</SelectItem>
              <SelectItem value="rejected">Từ chối</SelectItem>
              <SelectItem value="rate_limited">Rate limit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Chưa có evolve nào.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-2 px-2 font-medium">Thời gian</th>
                <th className="py-2 px-2 font-medium">File</th>
                <th className="py-2 px-2 font-medium">Branch</th>
                <th className="py-2 px-2 font-medium">Status</th>
                <th className="py-2 px-2 font-medium">PR</th>
                <th className="py-2 px-2 font-medium">Build</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = STATUS_META[r.status] || { label: r.status, cls: "" };
                const filePath = r.tool_call?.args?.file_path || "—";
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpenRow(r)}
                    className="border-b border-border/40 hover:bg-muted/40 cursor-pointer"
                  >
                    <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("vi-VN", { hour12: false })}
                    </td>
                    <td className="py-2 px-2 font-mono truncate max-w-[260px]">{filePath}</td>
                    <td className="py-2 px-2 font-mono truncate max-w-[180px]">{r.pr_branch || "—"}</td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className={cn("text-[10px]", meta.cls)}>
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      {r.pr_url ? (
                        <a
                          href={r.pr_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-primary underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Mở
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {r.build_passed === true ? "✅" : r.build_passed === false ? "❌" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!openRow} onOpenChange={(o) => !o && setOpenRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết evolve</DialogTitle>
          </DialogHeader>
          {openRow && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Status:</span> <b>{openRow.status}</b></div>
                <div><span className="text-muted-foreground">Phase:</span> {openRow.phase}</div>
                <div><span className="text-muted-foreground">Branch:</span> <span className="font-mono">{openRow.pr_branch || "—"}</span></div>
                <div><span className="text-muted-foreground">Build:</span> {openRow.build_passed === null ? "—" : openRow.build_passed ? "✅" : "❌"}</div>
              </div>
              {openRow.reject_reason && (
                <div className="text-red-600 dark:text-red-400">
                  <span className="font-semibold">Reject reason:</span> {openRow.reject_reason}
                </div>
              )}
              <div>
                <div className="text-muted-foreground mb-1">Tool call payload:</div>
                <pre className="bg-muted/50 rounded p-3 overflow-auto max-h-[400px] text-[10px] font-mono">
                  {JSON.stringify(openRow.tool_call, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
