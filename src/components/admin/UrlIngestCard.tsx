import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";

interface Folder { id: string; name: string; }

interface Props {
  folders: Folder[];
  onIngested?: () => void;
}

/**
 * Card admin nạp knowledge từ URL bất kỳ.
 * Gọi edge function `knowledge-ingest-url`. Có anti-duplicate theo content_hash.
 */
export default function UrlIngestCard({ folders, onIngested }: Props) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("URL phải bắt đầu bằng http(s)://");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Đang tải và nạp URL…");
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-ingest-url", {
        body: {
          url: trimmed,
          title: title.trim() || undefined,
          folder_id: folderId || null,
        },
      });
      if (error) throw error;
      if (data?.duplicate) {
        toast.info(`Đã có trong knowledge: ${data.title ?? ""}`, { id: toastId });
      } else {
        toast.success(`Đã nạp: ${data?.title ?? "OK"} (${data?.content_length ?? 0} ký tự)`, { id: toastId });
        setUrl("");
        setTitle("");
        onIngested?.();
      }
    } catch (e: any) {
      toast.error(`Lỗi: ${e?.message ?? "unknown"}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Nạp knowledge từ URL</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Dán link bài viết bất kỳ. Angel sẽ tự tải, tách nội dung, dedup và embed trong vài phút.
      </p>
      <div className="space-y-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
          disabled={loading}
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề (tuỳ chọn — mặc định lấy từ <title>)"
          className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
          disabled={loading}
        />
        <select
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg bg-white"
          disabled={loading}
        >
          <option value="">— Chưa gán folder —</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <button
          onClick={submit}
          disabled={loading || !url.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {loading ? "Đang nạp…" : "Nạp URL"}
        </button>
      </div>
    </div>
  );
}
