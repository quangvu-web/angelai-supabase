import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, RotateCcw, Save, Trash2, ArchiveRestore } from "lucide-react";

type DeletedDoc = {
  id: string;
  title: string;
  source: string | null;
  folder_id: string | null;
  chunk_count: number | null;
  deleted_at: string;
  latest_backup_id: string | null;
  latest_backup_date: string | null;
};

type SnapshotSummary = {
  snapshot_date: string;
  doc_count: number;
};

export default function KnowledgeBackupPanel() {
  const [deleted, setDeleted] = useState<DeletedDoc[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: del, error: delErr }, { data: bk, error: bkErr }] = await Promise.all([
      supabase.rpc("list_deleted_knowledge_docs" as any, { _limit: 300 }),
      supabase
        .from("knowledge_document_backups" as any)
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(2000),
    ]);
    if (delErr) toast.error(delErr.message);
    else setDeleted((del ?? []) as any);

    if (!bkErr && Array.isArray(bk)) {
      const map = new Map<string, number>();
      for (const r of bk as any[]) {
        map.set(r.snapshot_date, (map.get(r.snapshot_date) ?? 0) + 1);
      }
      setSnapshots(
        Array.from(map.entries())
          .map(([snapshot_date, doc_count]) => ({ snapshot_date, doc_count }))
          .sort((a, b) => (a.snapshot_date < b.snapshot_date ? 1 : -1))
          .slice(0, 12)
      );
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runBackupNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("backup_knowledge_snapshot" as any);
    setRunning(false);
    if (error) { toast.error(error.message); return; }
    const r: any = data;
    toast.success(`Đã sao lưu: +${r?.inserted ?? 0} doc, dọn ${r?.pruned ?? 0} bản cũ`);
    load();
  };

  const restoreDeleted = async (id: string) => {
    const { error } = await supabase.rpc("restore_knowledge_docs" as any, { _ids: [id] });
    if (error) { toast.error(error.message); return; }
    toast.success("Đã khôi phục tài liệu. Cron sẽ re-embed.");
    load();
  };

  const restoreFromBackup = async (backupId: string) => {
    if (!confirm("Khôi phục tài liệu từ ảnh chụp này? Nội dung hiện tại (nếu có) sẽ bị ghi đè.")) return;
    const { error } = await supabase.rpc("restore_doc_from_backup" as any, { _backup_id: backupId });
    if (error) { toast.error(error.message); return; }
    toast.success("Đã khôi phục từ ảnh chụp. Cron sẽ re-embed.");
    load();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-base font-semibold flex items-center gap-2">
            <ArchiveRestore className="h-4 w-4" /> Sao lưu & Khôi phục
          </div>
          <div className="text-xs text-muted-foreground">
            Snapshot hàng tuần (CN 04:00 VN) · giữ 8 tuần · xoá mềm luôn có thể rollback
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Làm mới
          </Button>
          <Button size="sm" onClick={runBackupNow} disabled={running}>
            <Save className="h-3.5 w-3.5 mr-1" /> {running ? "Đang sao lưu…" : "Sao lưu ngay"}
          </Button>
        </div>
      </div>

      {/* Snapshot history */}
      <div>
        <div className="text-xs font-semibold mb-2">📸 Ảnh chụp gần đây</div>
        {snapshots.length === 0 ? (
          <div className="text-xs text-muted-foreground">Chưa có ảnh chụp.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {snapshots.map(s => (
              <Badge key={s.snapshot_date} variant="secondary" className="text-[11px]">
                {new Date(s.snapshot_date).toLocaleDateString("vi-VN")} · {s.doc_count.toLocaleString()} doc
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Deleted docs */}
      <div>
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <Trash2 className="h-3.5 w-3.5" /> Thùng rác ({deleted.length})
        </div>
        {deleted.length === 0 ? (
          <div className="text-xs text-muted-foreground p-4 text-center border rounded-md">
            Thùng rác trống.
          </div>
        ) : (
          <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
            {deleted.map(d => (
              <div key={d.id} className="p-2 flex items-center gap-2 hover:bg-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{d.title || "(không tiêu đề)"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {d.source ?? "?"} · xoá {new Date(d.deleted_at).toLocaleString("vi-VN")}
                    {d.latest_backup_date && ` · snapshot ${new Date(d.latest_backup_date).toLocaleDateString("vi-VN")}`}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => restoreDeleted(d.id)}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Khôi phục
                </Button>
                {d.latest_backup_id && (
                  <Button size="sm" variant="ghost" onClick={() => restoreFromBackup(d.latest_backup_id!)}>
                    <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Từ snapshot
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
