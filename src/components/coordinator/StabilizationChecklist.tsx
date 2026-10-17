import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Circle, ClipboardCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "todo" | "pass" | "fail";

interface TestCase {
  id: string;
  phase: 0 | 1 | 2 | 3 | 3.5;
  title: string;
  steps: string;
  expected: string;
}

const TESTS: TestCase[] = [
  {
    id: "p35-intent-history-contamination",
    phase: 3.5,
    title: "Intent KHÔNG bị nhiễm từ history",
    steps: 'Chat trước: "Đổi Hero title thành X" → ngay sau hỏi: "Tìm component Hero"',
    expected: "Console log [CoordinatorIntent] read_only (không phải modify). Server log intent=read_only. NO EvolveCard, NO PR.",
  },
  {
    id: "p3-search-hero",
    phase: 3,
    title: "search_symbol Hero trả ≥1 kết quả",
    steps: 'Hỏi Angel: "Tìm component Hero"',
    expected: "[CoordinatorIntent] read_only → search_symbol → final plain message. NO propose_edit / evolve_workspace / EvolveCard.",
  },
  {
    id: "p3-search-route",
    phase: 3,
    title: "search_route /quest → Quest.tsx",
    steps: 'Hỏi Angel: "Route /quest dùng file nào?"',
    expected: "[CoordinatorIntent] read_only → search_route → plain. NO PRD creation, NO search_symbol lạc đề.",
  },
  {
    id: "p3-search-i18n",
    phase: 3,
    title: "search_i18n_key trả 12 ngôn ngữ",
    steps: 'Hỏi Angel: "Key index.title đã dịch chưa?"',
    expected: "[CoordinatorIntent] read_only → search_i18n_key → plain. NO patch.",
  },
  {
    id: "p35-read-explain",
    phase: 3.5,
    title: "Đọc file + giải thích KHÔNG tạo patch",
    steps: 'Hỏi Angel: "Đọc file HeroSection.tsx và giải thích"',
    expected: "[CoordinatorIntent] read_only → read_file → plain. NO propose_edit, NO EvolveCard.",
  },
  {
    id: "p35-mode-isolation",
    phase: 3.5,
    title: "Mode Product Spec không tự tạo PRD khi user hỏi tìm",
    steps: 'Chọn Mode "Product Spec" → hỏi: "Tìm hook useAuth"',
    expected: "[CoordinatorIntent] read_only → search_symbol → plain. NO PRD/spec creation.",
  },
  {
    id: "p2-cta-small-edit",
    phase: 2,
    title: "Sửa CTA ≤ 5 edits, diff nhỏ",
    steps: 'Hỏi Angel sửa text 1 nút CTA bất kỳ.',
    expected: "propose_edit trả ≤5 edit, diff chỉ quanh vùng cần sửa (không rewrite cả file).",
  },
  {
    id: "p0-evolve-card-no-pr",
    phase: 0,
    title: "EvolveCard không tự tạo PR",
    steps: "Khi EvolveCard hiện, KHÔNG bấm Phê duyệt.",
    expected: "Không có PR nào được tạo trên GitHub. Bấm Huỷ → log status=rejected.",
  },
  {
    id: "p0-pr-pipeline",
    phase: 0,
    title: "Phê duyệt → PR mở thành công",
    steps: "Bấm Phê duyệt trên một edit hợp lệ.",
    expected: "EvolveCard chuyển sang status=pr_opened, link PR mở được, branch khớp angel/*.",
  },
  {
    id: "p0-build-fail-label",
    phase: 0,
    title: "Build fail vẫn mở PR + label",
    steps: "Tạo edit cố ý gây lỗi TypeScript đơn giản (ví dụ const x: number = \"abc\").",
    expected: "PR vẫn mở; label build-failed; EvolveCard hiện 'Build FAILED — KHÔNG auto-merge'.",
  },
  {
    id: "p1-evolution-log-realtime",
    phase: 1,
    title: "EvolutionLogPanel realtime",
    steps: "Mở tab EvolutionLogPanel khi tạo PR.",
    expected: "Hàng mới xuất hiện không cần refresh; status update theo realtime.",
  },
];

const STORAGE_KEY = "coordinator-stabilization-checklist-v2";

export function StabilizationChecklist() {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        setStatuses(j.statuses || {});
        setNotes(j.notes || {});
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ statuses, notes }));
    } catch { /* noop */ }
  }, [statuses, notes]);

  function setStatus(id: string, s: Status) {
    setStatuses((prev) => ({ ...prev, [id]: s }));
  }

  const passed = TESTS.filter((t) => statuses[t.id] === "pass").length;
  const failed = TESTS.filter((t) => statuses[t.id] === "fail").length;
  const total = TESTS.length;
  const allPass = passed === total;

  return (
    <Card className="p-5 space-y-4 border-amber-500/30">
      <div className="flex items-center gap-3 flex-wrap">
        <ClipboardCheck className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold">Stabilization Checklist (Phase 0–3.5 · Intent Firewall)</h2>
        <Badge variant="outline" className={cn(
          "ml-auto",
          allPass
            ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
            : failed > 0
              ? "border-red-500/40 text-red-700 bg-red-500/10"
              : "border-amber-500/40 text-amber-700 bg-amber-500/10"
        )}>
          {passed}/{total} pass · {failed} fail
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Phase 3.5 enforces Intent Firewall: search/read requests KHÔNG được tạo EvolveCard/PR.
        Chỉ mở Phase 3.6 (Safety Validation) khi {total}/{total} pass. Trạng thái lưu local.
      </p>

      {!allPass && passed > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          Còn {total - passed} test chưa pass — chưa được mở Phase 3.6.
        </div>
      )}

      <div className="space-y-2">
        {TESTS.map((t, idx) => {
          const s = statuses[t.id] || "todo";
          return (
            <div
              key={t.id}
              className={cn(
                "border rounded-lg p-3 space-y-2 transition-colors",
                s === "pass" && "border-emerald-500/40 bg-emerald-500/5",
                s === "fail" && "border-red-500/40 bg-red-500/5",
                s === "todo" && "border-border bg-background"
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-xs font-mono text-muted-foreground mt-0.5">
                  #{idx + 1}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Phase {t.phase}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="font-semibold">Bước:</span> {t.steps}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold">Kỳ vọng:</span> {t.expected}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 pt-1">
                <Button
                  size="sm"
                  variant={s === "pass" ? "default" : "outline"}
                  className={cn("h-7 text-xs", s === "pass" && "bg-emerald-600 hover:bg-emerald-700 text-white")}
                  onClick={() => setStatus(t.id, "pass")}
                >
                  <Check className="h-3 w-3 mr-1" /> Pass
                </Button>
                <Button
                  size="sm"
                  variant={s === "fail" ? "default" : "outline"}
                  className={cn("h-7 text-xs", s === "fail" && "bg-red-600 hover:bg-red-700 text-white")}
                  onClick={() => setStatus(t.id, "fail")}
                >
                  <X className="h-3 w-3 mr-1" /> Fail
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setStatus(t.id, "todo")}
                >
                  <Circle className="h-3 w-3 mr-1" /> Reset
                </Button>
                <input
                  type="text"
                  placeholder="Ghi chú (PR url, lỗi gặp phải…)"
                  value={notes[t.id] || ""}
                  onChange={(e) => setNotes((p) => ({ ...p, [t.id]: e.target.value }))}
                  className="ml-2 flex-1 text-xs px-2 py-1 rounded border bg-background min-w-0"
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
