import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Plus, Trash2 } from "lucide-react";

type Row = {
  id: string;
  folder_pattern: string;
  paused: boolean;
  min_content_length: number;
  min_meaningful_words: number;
  require_role: string | null;
  note: string | null;
};

export default function TelegramIngestConfigCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_ingest_config")
      .select("*")
      .order("folder_pattern", { ascending: true });
    if (error) toast.error(error.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (r: Row) => {
    setSaving(r.id);
    const { error } = await supabase
      .from("telegram_ingest_config")
      .update({
        paused: r.paused,
        min_content_length: r.min_content_length,
        min_meaningful_words: r.min_meaningful_words,
        require_role: r.require_role || null,
        note: r.note,
      })
      .eq("id", r.id);
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success("Đã lưu");
  };

  const remove = async (id: string) => {
    if (!confirm("Xoá cấu hình này?")) return;
    const { error } = await supabase.from("telegram_ingest_config").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Đã xoá"); load(); }
  };

  const add = async () => {
    const p = newPattern.trim();
    if (!p) return;
    const { error } = await supabase
      .from("telegram_ingest_config")
      .insert({ folder_pattern: p });
    if (error) toast.error(error.message);
    else { toast.success("Đã thêm"); setNewPattern(""); load(); }
  };

  return (
    <Card className="p-5 space-y-4 border-2 border-yellow-400/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Send className="w-5 h-5 text-yellow-600" /> Telegram Ingest Config
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cấu hình lọc chất lượng dữ liệu Telegram trước khi vào RAG. Pattern dùng cú
            pháp SQL LIKE (<code>%</code> = wildcard). Pattern cụ thể hơn thắng.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="vd: Telegram / KNOWLEDGE ANGEL AI"
          value={newPattern}
          onChange={(e) => setNewPattern(e.target.value)}
        />
        <Button onClick={add} disabled={!newPattern.trim()}>
          <Plus className="w-4 h-4 mr-1" /> Thêm
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="border rounded-lg p-3 space-y-2 bg-background/60">
            <div className="flex items-center justify-between gap-2">
              <code className="text-sm font-mono truncate">{r.folder_pattern}</code>
              <div className="flex items-center gap-2 shrink-0">
                {r.paused && <Badge variant="destructive">Paused</Badge>}
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <label className="flex items-center gap-2">
                <Switch
                  checked={r.paused}
                  onCheckedChange={(v) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, paused: v } : x))}
                />
                <span>Paused</span>
              </label>
              <div>
                <div className="text-xs text-muted-foreground">Min length</div>
                <Input type="number" value={r.min_content_length}
                  onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, min_content_length: Number(e.target.value) } : x))} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Min words</div>
                <Input type="number" value={r.min_meaningful_words}
                  onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, min_meaningful_words: Number(e.target.value) } : x))} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Require role</div>
                <Input placeholder="admin | coordinator | (trống)" value={r.require_role ?? ""}
                  onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, require_role: e.target.value } : x))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Ghi chú" value={r.note ?? ""}
                onChange={(e) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, note: e.target.value } : x))} />
              <Button size="sm" onClick={() => save(r)} disabled={saving === r.id}>
                {saving === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lưu"}
              </Button>
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Chưa có cấu hình. Thêm pattern ở trên.</p>
        )}
      </div>
    </Card>
  );
}
