import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { RefreshCw, Trash2, Pencil, Search, AlertTriangle, Copy, GitBranch } from "lucide-react";

type TgDoc = {
  id: string;
  title: string;
  folder_id: string | null;
  source: string | null;
  source_ref: string | null;
  content_hash: string | null;
  chunk_count: number | null;
  ingest_status: string | null;
  knowledge_status?: "draft" | "review" | "active" | "deprecated" | "archived";
  version?: number;
  effective_until?: string | null;
  created_at: string;
  extracted_content: string | null;
  metadata: any;
};

type Folder = { id: string; name: string };

const PAGE_SIZE = 50;

interface Props {
  folderId?: string | null;
  lockFolder?: boolean;
}

export default function TelegramKnowledgeManager({ folderId, lockFolder }: Props = {}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<TgDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const [folderFilter, setFolderFilter] = useState<string>(folderId ?? "all");

  useEffect(() => {
    if (folderId !== undefined && folderId !== null) {
      setFolderFilter(folderId);
      setPage(0);
    } else if (folderId === null) {
      setFolderFilter("all");
      setPage(0);
    }
  }, [folderId]);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "longest" | "shortest">("newest");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dupMap, setDupMap] = useState<Record<string, number>>({});

  const [editDoc, setEditDoc] = useState<TgDoc | null>(null);
  const [viewDoc, setViewDoc] = useState<TgDoc | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [dedupePreview, setDedupePreview] = useState<{ groups: number; toDelete: number } | null>(null);
  const [confirmBulkText, setConfirmBulkText] = useState("");

  const loadFolders = async () => {
    const { data } = await supabase
      .from("knowledge_folders")
      .select("id, name")
      .order("name");
    setFolders(data ?? []);
  };

  const loadDocs = async () => {
    setLoading(true);
    let q = supabase
      .from("knowledge_documents")
      .select("id, title, folder_id, source, source_ref, content_hash, chunk_count, ingest_status, knowledge_status, version, effective_until, created_at, extracted_content, metadata", { count: "exact" })
      .is("deleted_at", null);

    if (folderFilter !== "all") q = q.eq("folder_id", folderFilter);
    if (statusFilter !== "all") q = q.eq("ingest_status", statusFilter);
    if (lifecycleFilter !== "all" && lifecycleFilter !== "expired") q = q.eq("knowledge_status", lifecycleFilter);
    if (lifecycleFilter === "expired") q = q.not("effective_until", "is", null).lte("effective_until", new Date().toISOString());
    if (search.trim()) q = q.or(`title.ilike.%${search}%,extracted_content.ilike.%${search}%`);

    if (sort === "newest") q = q.order("created_at", { ascending: false });
    // length-based sort done client-side after fetch (Postgres would need generated column)

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count, error } = await q.range(from, to);
    if (error) { toast.error(error.message); setLoading(false); return; }

    let rows = (data ?? []) as TgDoc[];
    if (sort === "longest") rows = [...rows].sort((a, b) => (b.extracted_content?.length ?? 0) - (a.extracted_content?.length ?? 0));
    if (sort === "shortest") rows = [...rows].sort((a, b) => (a.extracted_content?.length ?? 0) - (b.extracted_content?.length ?? 0));

    setDocs(rows);
    setTotal(count ?? 0);

    // Compute duplicate map for hashes in current page
    const hashes = rows.map(r => r.content_hash).filter(Boolean) as string[];
    if (hashes.length) {
      const { data: dups } = await supabase
        .from("knowledge_documents")
        .select("content_hash")
        .in("content_hash", hashes);
      const counts: Record<string, number> = {};
      (dups ?? []).forEach((d: any) => { counts[d.content_hash] = (counts[d.content_hash] ?? 0) + 1; });
      setDupMap(counts);
    } else {
      setDupMap({});
    }
    setLoading(false);
  };

  useEffect(() => { loadFolders(); }, []);
  useEffect(() => { loadDocs(); /* eslint-disable-next-line */ }, [folderFilter, statusFilter, lifecycleFilter, sort, page]);

  const onSearch = () => { setPage(0); loadDocs(); };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(docs.map(d => d.id)));
    else setSelected(new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const openEdit = (d: TgDoc) => {
    setEditDoc(d);
    setEditTitle(d.title ?? "");
    setEditContent(d.extracted_content ?? "");
  };

  const saveEdit = async () => {
    if (!editDoc) return;
    setSaving(true);
    const { error } = await supabase.rpc("admin_edit_knowledge_doc", {
      _id: editDoc.id, _title: editTitle, _content: editContent,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Đã cập nhật. Cron sẽ tự re-embed.");
    setEditDoc(null);
    loadDocs();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (ids.length > 20) {
      if (confirmBulkText !== "XOÁ") {
        toast.error('Gõ "XOÁ" để xác nhận xóa hàng loạt >20 doc');
        return;
      }
    } else {
      if (!confirm(
        `Chuyển ${ids.length} tài liệu vào thùng rác (soft-delete)?\n\n` +
        `Tài liệu sẽ bị ẩn khỏi kho kiến thức và Angel AI ngừng dùng. Có thể khôi phục trong panel Backup.`
      )) return;
    }

    // Lấy file_url để dọn storage sau khi soft-delete
    const { data: urlRows } = await supabase
      .from("knowledge_documents")
      .select("id, file_url")
      .in("id", ids);

    const { data, error } = await supabase.rpc("bulk_delete_knowledge_docs", { _ids: ids } as any);
    if (error) { toast.error(error.message); return; }

    // Best-effort dọn file gốc trong bucket "knowledge-documents"
    const paths: string[] = [];
    (urlRows ?? []).forEach((r: any) => {
      const m = (r.file_url as string | null)?.match(/\/storage\/v1\/object\/public\/knowledge-documents\/(.+)$/);
      if (m) paths.push(decodeURIComponent(m[1]));
    });
    if (paths.length) {
      const { error: rmErr } = await supabase.storage.from("knowledge-documents").remove(paths);
      if (rmErr) console.warn("Storage cleanup failed:", rmErr.message);
    }

    toast.success(`Đã chuyển ${data} tài liệu vào thùng rác`);
    setSelected(new Set());
    setConfirmBulkText("");
    loadDocs();
  };

  const previewDedupe = async () => {
    const { data, error } = await supabase.rpc("dedupe_telegram_docs", { _dry_run: true } as any);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setDedupePreview({ groups: row?.duplicate_groups ?? 0, toDelete: row?.docs_to_delete ?? 0 });
  };

  const runDedupe = async () => {
    const { data, error } = await supabase.rpc("dedupe_telegram_docs", { _dry_run: false } as any);
    if (error) { toast.error(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    toast.success(`Đã dedupe: xóa ${row?.deleted ?? 0} doc trùng`);
    setDedupePreview(null);
    loadDocs();
  };

  const setKnowledgeStatus = async (doc: TgDoc, status: "draft" | "review" | "active" | "deprecated" | "archived") => {
    const reason = status === "deprecated" || status === "archived"
      ? prompt("Ly do thay doi trang thai?") ?? undefined
      : undefined;
    const { error } = await supabase.rpc("set_knowledge_status" as any, {
      _id: doc.id,
      _status: status,
      _reason: reason ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Da chuyen sang ${status}`);
    loadDocs();
  };

  const createNewVersion = async (doc: TgDoc) => {
    const reason = prompt("Ly do tao version moi?", "Cap nhat knowledge Telegram theo review");
    if (reason === null) return;
    const { error } = await supabase.rpc("create_knowledge_new_version" as any, {
      _id: doc.id,
      _title: doc.title,
      _content: doc.extracted_content,
      _reason: reason,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Da tao version moi o trang thai Review");
    loadDocs();
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-base font-semibold">📚 Knowledge Manager</div>
          <div className="text-xs text-muted-foreground">Xem lại, chỉnh sửa, xóa tài liệu ở mọi folder (Telegram, Khóa thiền, Docs…)</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDocs} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Làm mới
          </Button>
          <Button variant="outline" size="sm" onClick={previewDedupe}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Quét trùng
          </Button>
        </div>
      </div>

      {/* Dedupe preview banner */}
      {dedupePreview && (
        <div className="p-3 rounded-md border bg-amber-500/10 flex items-center justify-between gap-2">
          <div className="text-sm">
            🔎 Có <b>{dedupePreview.groups}</b> nhóm trùng — sẽ xóa <b>{dedupePreview.toDelete}</b> doc (giữ bản mới nhất).
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDedupePreview(null)}>Huỷ</Button>
            <Button size="sm" onClick={runDedupe} disabled={dedupePreview.toDelete === 0}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Xóa {dedupePreview.toDelete} doc trùng
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <Select value={folderFilter} onValueChange={(v) => { setFolderFilter(v); setPage(0); }} disabled={lockFolder}>
          <SelectTrigger><SelectValue placeholder="Folder" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả folder</SelectItem>
            {folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lifecycleFilter} onValueChange={(v) => { setLifecycleFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Lifecycle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tat ca lifecycle</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="deprecated">Deprecated</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v: any) => setSort(v)}>
          <SelectTrigger><SelectValue placeholder="Sắp xếp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Mới nhất</SelectItem>
            <SelectItem value="longest">Dài nhất</SelectItem>
            <SelectItem value="shortest">Ngắn nhất</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Input placeholder="Tìm trong title/nội dung…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()} />
          <Button size="icon" variant="outline" onClick={onSearch}><Search className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Bulk toolbar */}
      <div className="flex items-center justify-between border rounded-md p-2 bg-muted/30">
        <div className="flex items-center gap-2 text-sm">
          <Checkbox checked={docs.length > 0 && selected.size === docs.length} onCheckedChange={(c) => toggleAll(!!c)} />
          <span>Chọn tất cả trang ({selected.size}/{docs.length})</span>
          <span className="text-xs text-muted-foreground">· Tổng: {total}</span>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 20 && (
            <Input className="w-32 h-8" placeholder='Gõ "XOÁ"' value={confirmBulkText}
              onChange={(e) => setConfirmBulkText(e.target.value)} />
          )}
          <Button size="sm" variant="destructive" disabled={!selected.size} onClick={bulkDelete} title="Chuyển vào thùng rác (soft-delete)">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Vào thùng rác ({selected.size})
          </Button>
        </div>
      </div>

      {/* Doc list */}
      <div className="border rounded-md divide-y">
        {loading && <div className="p-6 text-center text-sm text-muted-foreground">Đang tải…</div>}
        {!loading && docs.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Không có tài liệu nào khớp bộ lọc.</div>
        )}
        {docs.map(d => {
          const len = d.extracted_content?.length ?? 0;
          const dup = d.content_hash ? (dupMap[d.content_hash] ?? 0) > 1 : false;
          const lifecycle = d.knowledge_status ?? "active";
          const expired = !!d.effective_until && new Date(d.effective_until).getTime() <= Date.now();
          return (
            <div key={d.id} className="p-2 flex items-center gap-2 hover:bg-muted/30">
              <Checkbox checked={selected.has(d.id)} onCheckedChange={(c) => toggleOne(d.id, !!c)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="text-sm font-medium truncate text-left hover:underline" onClick={() => setViewDoc(d)}>
                    {d.title || "(không tiêu đề)"}
                  </button>
                  {dup && <Badge variant="destructive" className="text-[10px]">🔁 trùng</Badge>}
                  <Badge variant="outline" className="text-[10px]">{d.ingest_status ?? "?"}</Badge>
                  <Badge variant={lifecycle === "active" ? "default" : "secondary"} className="text-[10px]">
                    {lifecycle} v{d.version ?? 1}
                  </Badge>
                  {expired && <Badge variant="destructive" className="text-[10px]">expired</Badge>}
                  {d.chunk_count ? <Badge variant="secondary" className="text-[10px]">{d.chunk_count} chunks</Badge> : null}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {len} ký tự · {new Date(d.created_at).toLocaleString("vi-VN")}
                  {d.metadata?.author_handle ? ` · @${d.metadata.author_handle}` : ""}
                  {d.metadata?.chat_title ? ` · ${d.metadata.chat_title}` : ""}
                </div>
              </div>
              <Select value={lifecycle} onValueChange={(v: any) => setKnowledgeStatus(d, v)}>
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deprecated">Deprecated</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => createNewVersion(d)} title="Tao version moi">
                <GitBranch className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">Trang {page + 1} / {pageCount}</div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← Trước</Button>
          <Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}>Sau →</Button>
        </div>
      </div>

      {/* View dialog */}
      <Dialog open={!!viewDoc} onOpenChange={(o) => !o && setViewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{viewDoc?.title}</DialogTitle>
            <DialogDescription className="text-xs">
              {viewDoc?.source} · {viewDoc?.source_ref} · {viewDoc?.chunk_count ?? 0} chunks
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-3 flex-1">
            <div>
              <div className="text-xs font-semibold mb-1">Metadata</div>
              <pre className="text-[11px] bg-muted p-2 rounded overflow-x-auto">{JSON.stringify(viewDoc?.metadata ?? {}, null, 2)}</pre>
            </div>
            <div>
              <div className="text-xs font-semibold mb-1">Nội dung ({viewDoc?.extracted_content?.length ?? 0} ký tự)</div>
              <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded max-h-96 overflow-y-auto">{viewDoc?.extracted_content ?? ""}</pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDoc(null)}>Đóng</Button>
            {viewDoc && <Button onClick={() => { const d = viewDoc; setViewDoc(null); openEdit(d); }}><Pencil className="h-3.5 w-3.5 mr-1" /> Sửa</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDoc} onOpenChange={(o) => !o && setEditDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Sửa tài liệu</DialogTitle>
            <DialogDescription className="text-xs flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Lưu sẽ xóa chunks cũ và re-embed (chờ cron chạy).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto flex-1">
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Tiêu đề" />
            <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
              rows={16} className="font-mono text-xs" placeholder="Nội dung…" />
            <div className="text-[11px] text-muted-foreground">{editContent.length} ký tự</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>Huỷ</Button>
            <Button onClick={saveEdit} disabled={saving || !editTitle.trim() || !editContent.trim()}>
              {saving ? "Đang lưu…" : "Lưu & Re-embed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
