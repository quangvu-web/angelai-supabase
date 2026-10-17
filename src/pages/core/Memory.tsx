import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorePageShell } from "@/components/core/CorePageShell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Folder, FileText, Database, HardDrive } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const fmtBytes = (n: number) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${u[i]}`;
};

export default function Memory() {
  const { t, formatNumber } = useLanguage();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["memory-overview"],
    queryFn: async () => {
      const [docsRes, foldersRes, chunksRes] = await Promise.all([
        supabase.from("knowledge_documents").select("id, is_processed, file_size, file_type, folder_id, ingest_status, chunk_count"),
        supabase.from("knowledge_folders").select("id, name"),
        supabase.from("knowledge_chunks").select("id", { count: "exact", head: true }),
      ]);
      if (docsRes.error) throw docsRes.error;
      if (foldersRes.error) throw foldersRes.error;

      const docs = (docsRes.data ?? []) as any[];
      const folders = foldersRes.data ?? [];
      const totalSize = docs.reduce((s, d) => s + (d.file_size ?? 0), 0);
      const processed = docs.filter((d) => d.is_processed).length;
      const ready = docs.filter((d) => d.ingest_status === "ready").length;
      const pending = docs.filter((d) => d.ingest_status === "pending" || d.ingest_status === "processing").length;
      const failed = docs.filter((d) => d.ingest_status === "failed").length;
      const byFolder = new Map<string, number>();
      for (const d of docs) {
        const k = d.folder_id ?? "_root";
        byFolder.set(k, (byFolder.get(k) ?? 0) + 1);
      }
      const top = folders
        .map((f) => ({ name: f.name, count: byFolder.get(f.id) ?? 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        docs: docs.length,
        processed,
        ready,
        pending,
        failed,
        folders: folders.length,
        chunks: chunksRes.count ?? 0,
        totalSize,
        top,
      };
    },
    refetchInterval: 15_000,
  });

  const runIngest = async () => {
    await supabase.functions.invoke("knowledge-ingest", { body: { batch_size: 25, max_batches: 3 } });
    await refetch();
  };

  return (
    <CorePageShell title={t("core.memory.title")} subtitle={t("core.memory.subtitle")}>
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={<FileText className="h-4 w-4" />} label={t("core.documents")} value={`${data.ready}/${data.docs}`} hint={t("core.learned")} />
            <Stat icon={<Folder className="h-4 w-4" />} label={t("core.folders")} value={formatNumber(data.folders)} />
            <Stat icon={<Database className="h-4 w-4" />} label={t("core.chunks")} value={formatNumber(data.chunks)} />
            <Stat icon={<HardDrive className="h-4 w-4" />} label={t("core.totalSize")} value={fmtBytes(data.totalSize)} />
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">🧠 {t("core.learningStatus")}</div>
              <button
                onClick={runIngest}
                className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                ⚡ {t("core.learnNow")}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-2 rounded bg-green-500/10 text-green-700 dark:text-green-400">
                <div className="text-xs opacity-70">{t("core.ready")}</div>
                <div className="text-lg font-semibold">{data.ready}</div>
              </div>
              <div className="p-2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <div className="text-xs opacity-70">{t("core.pending")}</div>
                <div className="text-lg font-semibold">{data.pending}</div>
              </div>
              <div className="p-2 rounded bg-red-500/10 text-red-700 dark:text-red-400">
                <div className="text-xs opacity-70">{t("core.failed")}</div>
                <div className="text-lg font-semibold">{data.failed}</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              {t("core.autoIngest")}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-3">{t("core.topFolders")}</div>
            <div className="divide-y">
              {data.top.length === 0 ? (
                <div className="py-4 text-sm text-muted-foreground">{t("core.noFolders")}</div>
              ) : data.top.map((f) => (
                <div key={f.name} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate">{f.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{formatNumber(f.count)} {t("core.docs")}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </CorePageShell>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}
