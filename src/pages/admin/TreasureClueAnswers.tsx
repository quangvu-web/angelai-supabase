import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, X, Plus, FlaskConical, AlertTriangle, RefreshCw } from "lucide-react";

type ClueRow = {
  clue_id: string;
  event_id: string;
  event_title: string;
  seq: number;
  title: string;
  description: string | null;
  points: number;
  words: string[];
  hashes_count: number;
  updated_at: string | null;
};

type ErrRow = {
  id: string;
  function_name: string;
  user_id: string | null;
  sqlstate: string | null;
  message: string;
  context: any;
  severity: string;
  created_at: string;
};

const BoxErrorLogPanel = () => {
  const [rows, setRows] = useState<ErrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("box_function_error_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLoading(false);
    if (error) return toast.error("Không tải được nhật ký lỗi: " + error.message);
    setRows((data || []) as unknown as ErrRow[]);
  };
  useEffect(() => {
    load();
    const ch = supabase
      .channel("box_err_log")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "box_function_error_log" },
        (payload) => {
          const r = payload.new as ErrRow;
          setRows((prev) => [r, ...prev].slice(0, 50));
          toast.error(`🚨 Lỗi hộp: ${r.function_name} — ${r.message}`);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
  const sevColor = (s: string) =>
    s === "critical" ? "destructive" : s === "warning" ? "secondary" : "outline";
  return (
    <Card className="border-amber-500/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Nhật ký lỗi hệ thống hộp (50 gần nhất)
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 max-h-80 overflow-auto">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có lỗi nào — mượt 🎉</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="text-xs border rounded p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={sevColor(r.severity) as any}>{r.severity}</Badge>
                  <code className="font-mono">{r.function_name}</code>
                  {r.sqlstate && (
                    <span className="text-muted-foreground">[{r.sqlstate}]</span>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="break-all">{r.message}</div>
              {r.context && (
                <pre className="text-[10px] text-muted-foreground overflow-x-auto">
                  {JSON.stringify(r.context)}
                </pre>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};


const TreasureClueAnswers = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClueRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [newWord, setNewWord] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_treasure_clues");
    if (error) {
      toast.error("Không tải được danh sách: " + error.message);
    } else {
      const list = (data || []) as ClueRow[];
      setRows(list);
      const d: Record<string, string[]> = {};
      list.forEach((r) => (d[r.clue_id] = [...(r.words || [])]));
      setDrafts(d);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addWord = (clueId: string) => {
    const w = (newWord[clueId] || "").trim().toLowerCase();
    if (!w) return;
    const cur = drafts[clueId] || [];
    if (cur.includes(w)) {
      toast.warning("Từ đã có trong danh sách");
      return;
    }
    if (cur.length >= 30) {
      toast.warning("Tối đa 30 từ");
      return;
    }
    setDrafts({ ...drafts, [clueId]: [...cur, w] });
    setNewWord({ ...newWord, [clueId]: "" });
  };

  const removeWord = (clueId: string, w: string) => {
    setDrafts({ ...drafts, [clueId]: (drafts[clueId] || []).filter((x) => x !== w) });
  };

  const save = async (clueId: string) => {
    const words = drafts[clueId] || [];
    if (words.length === 0) {
      toast.error("Cần ít nhất 1 từ");
      return;
    }
    setSaving(clueId);
    const { data, error } = await supabase.rpc("admin_set_clue_answers", {
      p_clue_id: clueId,
      p_words: words,
    });
    setSaving(null);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    const res = data as { success: boolean; error?: string; count?: number };
    if (!res?.success) {
      toast.error("Lưu thất bại: " + (res?.error || "unknown"));
      return;
    }
    toast.success(`Đã lưu ${res.count} từ`);
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const runSmokeTest = async () => {
    const t = toast.loading("Đang chạy smoke test mở hộp…");
    const { data, error } = await supabase.rpc("smoke_test_box_flow");
    toast.dismiss(t);
    if (error) return toast.error("Smoke test lỗi: " + error.message);
    const res = data as { success: boolean; step?: string; error?: string };
    if (res?.success) toast.success("✅ Luồng cấp + mở hộp OK (pgcrypto chạy mượt)");
    else toast.error(`❌ Lỗi ở ${res?.step}: ${res?.error}`);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">Đáp án manh mối săn kho báu</h1>
        <p className="text-muted-foreground text-sm">
          Chỉnh sửa danh sách từ tiếng Anh đồng nghĩa cho mỗi manh mối. Hệ thống tự băm SHA-256
          khi lưu. Mỗi từ chuẩn hoá về chữ thường, tối đa 30 từ.
        </p>
        <Button variant="outline" size="sm" onClick={runSmokeTest}>
          <FlaskConical className="h-4 w-4 mr-1" /> Chạy smoke test mở hộp
        </Button>
      </header>

      <BoxErrorLogPanel />

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Chưa có manh mối nào.
          </CardContent>
        </Card>
      )}

      {rows.map((r) => {
        const words = drafts[r.clue_id] || [];
        const original = r.words || [];
        const dirty =
          words.length !== original.length ||
          words.some((w, i) => w !== original[i]);
        return (
          <Card key={r.clue_id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    #{r.seq} — {r.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Sự kiện: {r.event_title} · {r.points} điểm · {r.hashes_count} hash đang dùng
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => save(r.clue_id)}
                  disabled={!dirty || saving === r.clue_id}
                >
                  {saving === r.clue_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Lưu
                </Button>
              </div>
              {r.description && (
                <p className="text-sm text-muted-foreground mt-2">{r.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 min-h-[36px]">
                {words.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    Chưa có từ nào
                  </span>
                )}
                {words.map((w) => (
                  <Badge key={w} variant="secondary" className="gap-1 pl-2 pr-1">
                    {w}
                    <button
                      onClick={() => removeWord(r.clue_id, w)}
                      className="hover:bg-destructive/20 rounded p-0.5"
                      aria-label={`xoá ${w}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Thêm từ tiếng Anh (vd: sunlight)"
                  value={newWord[r.clue_id] || ""}
                  onChange={(e) =>
                    setNewWord({ ...newWord, [r.clue_id]: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addWord(r.clue_id);
                    }
                  }}
                />
                <Button variant="outline" onClick={() => addWord(r.clue_id)}>
                  <Plus className="h-4 w-4 mr-1" /> Thêm
                </Button>
              </div>
              {r.updated_at && (
                <p className="text-[11px] text-muted-foreground">
                  Cập nhật lần cuối: {new Date(r.updated_at).toLocaleString("vi-VN")}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default TreasureClueAnswers;
