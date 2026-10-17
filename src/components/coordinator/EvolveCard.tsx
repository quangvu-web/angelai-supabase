import { useMemo, useState } from "react";
import { diffLines } from "diff";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, ExternalLink, AlertTriangle, GitBranch, FileCode } from "lucide-react";
import { useEvolutionLogById } from "@/hooks/useEvolutionLog";
import { cn } from "@/lib/utils";

export interface EvolveArgs {
  file_path?: string;
  branch_name?: string;
  commit_message?: string;
  code_content?: string;
  pr_title?: string;
  pr_body?: string;
}

interface Props {
  args: EvolveArgs;
  rationale?: string;
  originalContent?: string | null;
  logId?: string | null;
  isDispatching?: boolean;
  onApprove: () => void;
  onReject: () => void;
}

function pathIsSafe(p?: string) {
  if (!p) return false;
  if (!p.startsWith("src/")) return false;
  if (p.startsWith("src/integrations/supabase/")) return false;
  if (p.includes("..")) return false;
  return true;
}

function StatusBadge({ status, buildPassed }: { status?: string; buildPassed?: boolean | null }) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    dispatched: { label: "Đang gửi GitHub…", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    pr_opened: { label: "PR đã mở ✓", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
    build_failed: { label: "Build FAILED — KHÔNG auto-merge", cls: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
    rejected: { label: "Đã từ chối", cls: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30" },
    rate_limited: { label: "Vượt rate limit", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  };
  const m = map[status] || { label: status, cls: "bg-muted text-foreground" };
  return <Badge variant="outline" className={cn("text-xs", m.cls)}>{m.label}</Badge>;
}

export function EvolveCard({
  args, rationale, originalContent, logId, isDispatching, onApprove, onReject,
}: Props) {
  const [approved, setApproved] = useState(false);
  const safe = pathIsSafe(args.file_path);

  const liveLog = useEvolutionLogById(approved ? logId ?? null : null);
  const row = liveLog.data;

  const diffChunks = useMemo(() => {
    if (!args.code_content) return null;
    if (originalContent == null) return null;
    return diffLines(originalContent, args.code_content);
  }, [originalContent, args.code_content]);

  // Detect i18n risk: file uses t() / useTranslation but new content drops t() calls
  // and is NOT a translation file edit.
  const i18nRisk = useMemo(() => {
    if (!originalContent || !args.code_content || !args.file_path) return null;
    if (args.file_path.startsWith("src/translations/")) return null;
    const usesT =
      /\buseTranslation\b/.test(originalContent) ||
      /\bt\(\s*["'`]/.test(originalContent);
    if (!usesT) return null;
    const origCalls = (originalContent.match(/\bt\(\s*["'`]/g) || []).length;
    const newCalls = (args.code_content.match(/\bt\(\s*["'`]/g) || []).length;
    if (newCalls < origCalls) {
      return { kind: "dropped", origCalls, newCalls } as const;
    }
    // Heuristic: hardcoded Vietnamese diacritics added to JSX text
    const viChars = />\s*[^<>{}\n]*[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ][^<>{}\n]*</;
    if (viChars.test(args.code_content) && !viChars.test(originalContent)) {
      return { kind: "hardcoded_vi", origCalls, newCalls } as const;
    }
    return null;
  }, [originalContent, args.code_content, args.file_path]);

  return (
    <div className="mt-3 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <FileCode className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold">Đề xuất sửa file</span>
        <Badge variant="outline" className={cn(
          "text-xs font-mono",
          safe ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
               : "border-red-500/40 text-red-700 dark:text-red-300"
        )}>
          {args.file_path || "(missing path)"}
        </Badge>
        {!safe && (
          <Badge variant="outline" className="text-xs border-red-500/40 text-red-700">
            <AlertTriangle className="h-3 w-3 mr-1" /> Path không hợp lệ
          </Badge>
        )}
        {i18nRisk && (
          <Badge variant="outline" className="text-xs border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            ⚠ i18n risk · {i18nRisk.kind === "dropped"
              ? `mất ${i18nRisk.origCalls - i18nRisk.newCalls} lệnh t()`
              : "hardcode tiếng Việt vào JSX"}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <GitBranch className="h-3 w-3" />
        <span className="font-mono">{args.branch_name}</span>
        <span>•</span>
        <span className="italic">"{args.commit_message}"</span>
      </div>

      {rationale && (
        <div className="text-sm text-foreground/80 border-l-2 border-amber-500/40 pl-3">
          {rationale}
        </div>
      )}

      {/* Diff preview */}
      <div className="border rounded-lg overflow-hidden bg-background/50">
        <div className="px-3 py-1.5 text-xs font-semibold border-b bg-muted/30 flex items-center justify-between">
          <span>Diff preview</span>
          {originalContent == null && (
            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Chưa có baseline — chỉ xem full content
            </span>
          )}
        </div>
        <div className="max-h-[360px] overflow-auto text-xs font-mono">
          {diffChunks ? (
            diffChunks.map((chunk, i) => {
              const bg = chunk.added
                ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                : chunk.removed
                  ? "bg-red-500/10 text-red-900 dark:text-red-200"
                  : "text-muted-foreground";
              const prefix = chunk.added ? "+ " : chunk.removed ? "- " : "  ";
              return (
                <pre key={i} className={cn("whitespace-pre-wrap px-3 py-0.5", bg)}>
                  {chunk.value.split("\n").filter((l, idx, arr) => !(idx === arr.length - 1 && l === "")).map((l) => prefix + l).join("\n")}
                </pre>
              );
            })
          ) : (
            <pre className="whitespace-pre-wrap px-3 py-2 text-muted-foreground">
              {args.code_content?.slice(0, 8000) || "(empty)"}
              {(args.code_content?.length ?? 0) > 8000 ? "\n\n…(truncated)" : ""}
            </pre>
          )}
        </div>
      </div>

      {/* Status / actions */}
      {!approved ? (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => { setApproved(true); onApprove(); }}
            disabled={!safe || isDispatching}
            className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white"
          >
            <Check className="h-4 w-4 mr-1" /> Phê duyệt → tạo PR
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} disabled={isDispatching}>
            <X className="h-4 w-4 mr-1" /> Huỷ
          </Button>
          {isDispatching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <StatusBadge status={row?.status ?? "dispatched"} buildPassed={row?.build_passed} />
          {row?.pr_url && (
            <a
              href={row.pr_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs underline text-primary"
            >
              <ExternalLink className="h-3 w-3" /> Mở PR
            </a>
          )}
          {row?.status === "build_failed" && (
            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Cần debug thủ công trước khi merge.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
