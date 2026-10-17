import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell, KpiCard } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

type Row = {
  id: string;
  api_key_hash: string;
  action: string;
  docs_count: number;
  success_count: number;
  error_count: number;
  http_status: number;
  sample_error: string | null;
  sample_source: string | null;
  sample_source_ref: string | null;
  request_bytes: number | null;
  duration_ms: number | null;
  created_at: string;
  created_count?: number | null;
  updated_count?: number | null;
  duplicate_count?: number | null;
  skipped_count?: number | null;
  low_content_count?: number | null;
};

type LowContentDoc = {
  id: string;
  title: string | null;
  source_ref: string | null;
  content_length: number;
  created_at: string;
};

const fmt = (n: any) => Number(n ?? 0).toLocaleString("vi-VN");
const shortTime = (d: string) =>
  new Date(d).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

function statusBadge(r: Row) {
  if (r.http_status >= 500) return <Badge variant="destructive">5xx</Badge>;
  if (r.http_status >= 400) return <Badge variant="destructive">{r.http_status}</Badge>;
  if (r.error_count > 0 && r.success_count === 0) return <Badge variant="destructive">All failed</Badge>;
  if (r.error_count > 0) return <Badge className="bg-amber-500 text-black">Partial</Badge>;
  return <Badge className="bg-emerald-600 text-white">OK</Badge>;
}

function breakdownChips(r: Row) {
  const chips: JSX.Element[] = [];
  if ((r.created_count ?? 0) > 0)
    chips.push(<Badge key="c" className="bg-emerald-600 text-white text-[10px]">+{r.created_count} mới</Badge>);
  if ((r.updated_count ?? 0) > 0)
    chips.push(<Badge key="u" className="bg-blue-600 text-white text-[10px]">↻ {r.updated_count} cập nhật</Badge>);
  if ((r.duplicate_count ?? 0) > 0)
    chips.push(<Badge key="d" variant="outline" className="text-[10px]">trùng {r.duplicate_count}</Badge>);
  if ((r.skipped_count ?? 0) > 0)
    chips.push(<Badge key="s" variant="outline" className="text-[10px] border-amber-500 text-amber-600">skip {r.skipped_count}</Badge>);
  if ((r.low_content_count ?? 0) > 0)
    chips.push(
      <Badge key="l" className="bg-amber-500 text-black text-[10px]" title="Google Doc lưu được nhưng nội dung < 500 ký tự — nghi FUN Profile fetch thiếu">
        ⚠ low {r.low_content_count}
      </Badge>,
    );
  return chips.length ? <div className="flex flex-wrap gap-1">{chips}</div> : <span className="text-muted-foreground text-xs">—</span>;
}

export default function KnowledgeIngest() {
  const q = useQuery({
    queryKey: ["knowledge-ingest-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_ingest_audit" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    refetchInterval: 30_000,
  });

  // A.2: Google Doc gần đây có content < 500 ký tự → nghi FUN Profile fetch thiếu
  const lowQ = useQuery({
    queryKey: ["knowledge-low-content-gdocs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents" as any)
        .select("id, title, source_ref, extracted_content, created_at")
        .eq("source", "google_doc")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as any[])
        .map((d) => ({
          id: d.id,
          title: d.title,
          source_ref: d.source_ref,
          content_length: (d.extracted_content ?? "").length,
          created_at: d.created_at,
        }))
        .filter((d) => d.content_length > 0 && d.content_length < 500) as LowContentDoc[];
    },
    refetchInterval: 60_000,
  });

  // Cảnh báo: tài liệu có tiêu đề "Tài khoản Fun.Rich chính thức..." nhưng CHƯA có metadata.authoritative=true
  const unflaggedAuthQ = useQuery({
    queryKey: ["knowledge-unflagged-authoritative"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents" as any)
        .select("id, title, source, metadata, created_at")
        .is("deleted_at", null)
        .or("title.ilike.%tài khoản%chính thức%,title.ilike.%tài khoản%fun.rich%,title.ilike.%tai khoan%chinh thuc%")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as any[]).filter(
        (d) => !(d?.metadata && d.metadata.authoritative === true),
      );
    },
    refetchInterval: 60_000,
  });

  const rows = q.data ?? [];
  const total = rows.length;
  const ok = rows.filter((r) => r.http_status < 400 && r.error_count === 0).length;
  const failed = rows.filter((r) => r.http_status >= 400).length;
  const partial = rows.filter((r) => r.http_status < 400 && r.error_count > 0).length;
  const totalDocs = rows.reduce((s, r) => s + (r.success_count ?? 0), 0);
  const totalLow = rows.reduce((s, r) => s + (r.low_content_count ?? 0), 0);

  return (
    <CorePageShell
      title="External Knowledge Ingest"
      subtitle="Lịch sử FUN Profile & các nguồn ngoài đẩy Knowledge vào Angel AI (RAG)"
    >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Requests (100 gần nhất)" value={fmt(total)} />
        <KpiCard label="OK" value={fmt(ok)} />
        <KpiCard label="Partial" value={fmt(partial)} />
        <KpiCard label="Failed" value={fmt(failed)} />
        <KpiCard label="⚠ Low-content" value={fmt(totalLow)} />
      </div>

      {(lowQ.data?.length ?? 0) > 0 && (
        <Card className="p-4 mt-4 border-amber-500/50 bg-amber-50">
          <div className="flex items-center gap-2 mb-2 text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            <div className="font-semibold text-sm">
              {lowQ.data!.length} Google Doc có nội dung dưới 500 ký tự — nghi FUN Profile fetch thiếu (Doc chưa share "Anyone with link"?)
            </div>
          </div>
          <div className="space-y-1">
            {lowQ.data!.slice(0, 10).map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs">
                <Badge className="bg-amber-500 text-black">{d.content_length} ký tự</Badge>
                <span className="text-muted-foreground whitespace-nowrap">{shortTime(d.created_at)}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{d.source_ref}</span>
                <span className="truncate">{d.title ?? "(không tiêu đề)"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(unflaggedAuthQ.data?.length ?? 0) > 0 && (
        <Card className="p-4 mt-4 border-rose-500/50 bg-rose-50">
          <div className="flex items-center gap-2 mb-2 text-rose-800">
            <AlertTriangle className="w-4 h-4" />
            <div className="font-semibold text-sm">
              {unflaggedAuthQ.data!.length} tài liệu khớp mẫu "Tài khoản Fun.Rich chính thức" nhưng CHƯA có nhãn authoritative — RAG sẽ không ưu tiên. Trigger tự động sẽ xử lý tài liệu mới; các mục dưới đây cần chạy lại hoặc kiểm tra thủ công.
            </div>
          </div>
          <div className="space-y-1">
            {unflaggedAuthQ.data!.slice(0, 15).map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 text-xs">
                <Badge variant="destructive" className="text-[10px]">missing auth</Badge>
                <span className="text-muted-foreground whitespace-nowrap">{shortTime(d.created_at)}</span>
                <Badge variant="outline" className="text-[10px]">{d.source ?? "?"}</Badge>
                <span className="truncate">{d.title ?? "(không tiêu đề)"}</span>
              </div>
            ))}
          </div>
        </Card>
      )}



      <Card className="p-4 mt-4">
        <div className="text-sm text-muted-foreground mb-3">
          Tổng doc ingest thành công (trong 100 request gần nhất): <b>{fmt(totalDocs)}</b>
        </div>

        {q.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Chưa có request nào từ hệ ngoài. Sau khi FUN Profile push, log sẽ xuất hiện ở đây.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Docs</TableHead>
                  <TableHead>Breakdown</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Sample error</TableHead>
                  <TableHead className="text-right">Bytes</TableHead>
                  <TableHead className="text-right">ms</TableHead>
                  <TableHead>Key</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{shortTime(r.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.action}</TableCell>
                    <TableCell>{statusBadge(r)}</TableCell>
                    <TableCell className="text-right">{fmt(r.docs_count)}</TableCell>
                    <TableCell>{breakdownChips(r)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.sample_source ?? "—"}
                      {r.sample_source_ref ? <span className="text-muted-foreground">/{r.sample_source_ref}</span> : null}
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={r.sample_error ?? ""}>
                      {r.sample_error ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{fmt(r.request_bytes)}</TableCell>
                    <TableCell className="text-right">{fmt(r.duration_ms)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.api_key_hash.slice(0, 8)}…</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </CorePageShell>
  );
}
