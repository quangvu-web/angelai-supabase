import { useEffect, useState } from "react";
import { AlertCircle, Database, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseUrantiaJson, parseUrantiaText } from "@/lib/urantia/parser";
import type { UrantiaManifest } from "@/lib/urantia/types";

type Collection = { id: string; language: string; edition: string; source_version: string; version_status: string; is_active: boolean; activated_at: string | null };
type Batch = { id: string; status: string; retry_count: number; safe_error_code: string | null; manifest: Record<string, unknown>; created_at: string };

export default function UrantiaIngestPanel() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [schemaReady, setSchemaReady] = useState(true);
  const [dryRun, setDryRun] = useState<UrantiaManifest | null>(null);
  const [dryRunError, setDryRunError] = useState<string | null>(null);

  useEffect(() => {
    const db = supabase as any;
    Promise.all([
      db.rpc("admin_list_urantia_collections"),
      db.rpc("admin_list_urantia_batches"),
    ]).then(([c, b]) => {
      if (c.error || b.error) setSchemaReady(false);
      else { setCollections(c.data ?? []); setBatches(b.data ?? []); }
    });
  }, []);

  const manifestNumber = (b: Batch, key: string) => Number(b.manifest?.[key] ?? 0);
  return (
    <section className="rounded-2xl border border-primary-pale bg-white p-5 space-y-4">
      <div className="flex items-center gap-2"><Database className="w-5 h-5 text-primary" /><h2 className="font-semibold">Urantia staging</h2></div>
      <div className="rounded-xl border border-dashed p-3 text-sm space-y-2">
        <div className="font-medium">Dry-run manifest (không ghi database)</div>
        <input type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setDryRunError(null);
          try {
            if (file.size > 15 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
            const text = await file.text();
            setDryRun(file.name.toLowerCase().endsWith(".json") ? await parseUrantiaJson(text, { requireComplete: true }) : await parseUrantiaText(text, { requireComplete: true }));
          } catch (error) { setDryRun(null); setDryRunError(error instanceof Error ? error.message : "PARSE_FAILED"); }
        }} />
        {dryRun && <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <span>Documents: {dryRun.documents.length}/197</span><span>Chunks: {dryRun.chunks.length}</span>
          <span>Thiếu: {dryRun.missingPapers.length}</span><span>Lỗi: {dryRun.errors.length}</span>
          <span className="col-span-full break-all">Source SHA-256: {dryRun.sourceHash}</span>
        </div>}
        {dryRunError && <div className="text-red-700">Lỗi an toàn: {dryRunError}</div>}
      </div>
      {!schemaReady ? (
        <div className="flex gap-2 text-sm text-amber-700"><AlertCircle className="w-4 h-4 mt-0.5" />Schema Phase 1A chưa được áp dụng. Không có dữ liệu nào được ingest.</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {collections.length === 0 && <p className="text-sm text-muted-foreground">Chưa có collection Urantia. Collection mới luôn mặc định inactive.</p>}
            {collections.map((c) => <div key={c.id} className="rounded-xl border p-3 text-sm">
              <div className="font-medium">{c.language.toUpperCase()} · {c.edition} · {c.source_version}</div>
              <div className="mt-1 flex gap-2"><span>{c.version_status}</span><span className={c.is_active ? "text-green-700" : "text-muted-foreground"}>{c.is_active ? "Active" : "Inactive"}</span></div>
            </div>)}
          </div>
          {batches.map((b) => {
            const valid = manifestNumber(b, "valid_papers");
            const missing = manifestNumber(b, "missing_papers");
            const duplicates = manifestNumber(b, "duplicate_papers");
            const evaluationPass = b.manifest?.evaluation_pass === true;
            const complete = valid === 197 && missing === 0 && duplicates === 0 && evaluationPass;
            return <div key={b.id} className="rounded-xl border p-3 text-sm space-y-2">
              <div className="flex items-center justify-between"><span className="font-medium">Batch {b.id.slice(0, 8)}</span><span>{b.status}</span></div>
              <div className="grid grid-cols-3 gap-2 text-xs"><span>Valid: {valid}/197</span><span>Thiếu: {missing}</span><span>Trùng: {duplicates}</span></div>
              {b.safe_error_code && <div className="text-red-700">Lỗi: {b.safe_error_code}</div>}
              <button disabled={!complete} title={complete ? "Sẵn sàng cho bước phê duyệt activation" : "Cần đủ 197 tài liệu và evaluation PASS"} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Activate</button>
            </div>;
          })}
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileSearch className="w-4 h-4" />Upload không đồng nghĩa Angel đã học. Chỉ collection active sau evaluation mới được retrieval sử dụng.</div>
        </>
      )}
    </section>
  );
}
