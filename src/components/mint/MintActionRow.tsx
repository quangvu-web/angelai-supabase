import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  MessageSquare,
  BookOpen,
  FileText,
  MessageCircle,
  Heart,
  Share2,
  Gift,
  Users,
  Lightbulb,
  ThumbsUp,
  LogIn,
  Eye,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface ScoreData {
  light_score: number;
  final_reward: number;
  pillar_s: number;
  pillar_t: number;
  pillar_h: number;
  pillar_c: number;
  pillar_u: number;
  decision: string;
}

interface MintRequestData {
  tx_hash: string | null;
  status: string;
  minted_at: string | null;
}

interface PPLPAction {
  id: string;
  action_type: string;
  platform_id: string;
  status: string;
  created_at: string;
  minted_at?: string;
  mint_request_hash?: string | null;
  pplp_scores?: ScoreData | ScoreData[];
  pplp_mint_requests?: MintRequestData | MintRequestData[];
}

function resolveOne<T>(data: T | T[] | undefined | null): T | undefined {
  if (!data) return undefined;
  return Array.isArray(data) ? data[0] : data;
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  QUESTION_ASK: MessageSquare,
  JOURNAL_WRITE: BookOpen,
  CONTENT_CREATE: FileText,
  POST_CREATE: FileText,
  COMMENT_CREATE: MessageCircle,
  POST_ENGAGEMENT: Heart,
  SHARE_CONTENT: Share2,
  DONATE: Gift,
  DONATE_SUPPORT: Gift,
  CONTENT_SHARE: Share2,
  COMMUNITY_HELP: Users,
  HELP_COMMUNITY: Users,
  MENTOR_HELP: Users,
  IDEA_SUBMIT: Lightbulb,
  FEEDBACK_GIVE: ThumbsUp,
  DAILY_LOGIN: LogIn,
  GRATITUDE_PRACTICE: Star,
  VISION_CREATE: Eye,
};

const ACTION_LABELS: Record<string, string> = {
  QUESTION_ASK: "Hỏi AI",
  JOURNAL_WRITE: "Nhật ký",
  CONTENT_CREATE: "Đăng bài",
  POST_CREATE: "Đăng bài",
  COMMENT_CREATE: "Bình luận",
  POST_ENGAGEMENT: "Tương tác",
  SHARE_CONTENT: "Chia sẻ",
  DONATE: "Tặng quà",
  DONATE_SUPPORT: "Tặng quà",
  CONTENT_SHARE: "Chia sẻ",
  COMMUNITY_HELP: "Giúp đỡ",
  HELP_COMMUNITY: "Cộng đồng",
  MENTOR_HELP: "Hỗ trợ",
  IDEA_SUBMIT: "Ý tưởng",
  FEEDBACK_GIVE: "Góp ý",
  DAILY_LOGIN: "Đăng nhập",
  GRATITUDE_PRACTICE: "Biết ơn",
  VISION_CREATE: "Vision",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: "Đang xử lý", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  scored: { label: "Đạt", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  minted: { label: "Đã ghi nhận", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle2 },
  failed: { label: "Không đạt", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle },
  rejected: { label: "Bị từ chối", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertCircle },
  expired: { label: "Hết hạn", className: "bg-muted text-muted-foreground", icon: Clock },
};

// Pillar dot: filled if value >= 60
function PillarDots({ score }: { score: ScoreData }) {
  const pillars = [
    { key: "S", value: score.pillar_s, color: "bg-red-500" },
    { key: "T", value: score.pillar_t, color: "bg-blue-500" },
    { key: "H", value: score.pillar_h, color: "bg-green-500" },
    { key: "C", value: score.pillar_c, color: "bg-yellow-500" },
    { key: "U", value: score.pillar_u, color: "bg-purple-500" },
  ];
  return (
    <div className="flex gap-0.5">
      {pillars.map((p) => (
        <div
          key={p.key}
          className={`w-2 h-2 rounded-full ${p.value >= 60 ? p.color : "bg-muted"}`}
          title={`${p.key}: ${p.value}`}
        />
      ))}
    </div>
  );
}

interface Props {
  action: PPLPAction;
}

export function MintActionRow({ action }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isMobile = useIsMobile();
  const score = resolveOne(action.pplp_scores);
  const mintRequest = resolveOne(action.pplp_mint_requests);

  const effectiveStatus =
    action.status === "scored" && score?.decision !== "pass" ? "failed" : action.status;
  const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const ActionIcon = ACTION_ICONS[action.action_type] || Sparkles;

  const hasTxHash = mintRequest?.tx_hash?.startsWith("0x");
  const dateStr = format(new Date(action.created_at), "dd/MM");

  return (
    <div className="border-b last:border-b-0 border-border/50">
      {/* Compact row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors text-sm"
      >
        {/* Date */}
        <span className="text-muted-foreground w-10 shrink-0 text-xs font-mono">{dateStr}</span>

        {/* Action type */}
        <div className="flex items-center gap-1.5 min-w-0 w-24 shrink-0">
          <ActionIcon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="truncate text-xs">{ACTION_LABELS[action.action_type] || action.action_type}</span>
        </div>

        {/* Score - hidden on mobile */}
        {!isMobile && score && (
          <div className="flex items-center gap-1.5 w-16 shrink-0">
            <span className="text-xs font-medium">{score.light_score}</span>
            <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${score.light_score}%` }}
              />
            </div>
          </div>
        )}

        {/* Pillars - hidden on mobile */}
        {!isMobile && score && (
          <div className="w-16 shrink-0 flex justify-center">
            <PillarDots score={score} />
          </div>
        )}

        {/* Reward */}
        <span className="text-xs font-semibold text-amber-600 w-16 shrink-0 text-right">
          {score ? `+${score.final_reward.toLocaleString()}` : "—"}
        </span>

        {/* Status */}
        <Badge className={`${statusConfig.className} text-[10px] px-1.5 py-0 h-5 shrink-0`}>
          <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
          {statusConfig.label}
        </Badge>

        {/* Expand arrow */}
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 space-y-3 bg-muted/30">
          {score && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Light Score:</span>
                <span className="font-bold text-amber-600">{score.light_score}/100</span>
                <span className="text-muted-foreground ml-2">FUN:</span>
                <span className="font-bold text-amber-600">+{score.final_reward.toLocaleString()}</span>
              </div>
              {/* 5 Pillars full */}
              <div className="grid grid-cols-5 gap-1.5 text-xs">
                {[
                  { key: "S", val: score.pillar_s, bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600" },
                  { key: "T", val: score.pillar_t, bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600" },
                  { key: "H", val: score.pillar_h, bg: "bg-green-50 dark:bg-green-900/20", text: "text-green-600" },
                  { key: "C", val: score.pillar_c, bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-600" },
                  { key: "U", val: score.pillar_u, bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600" },
                ].map((p) => (
                  <div key={p.key} className={`text-center p-1.5 rounded ${p.bg}`}>
                    <div className={`font-semibold ${p.text}`}>{p.key}</div>
                    <div>{p.val}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* On-chain link */}
          {hasTxHash && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://testnet.bscscan.com/tx/${mintRequest?.tx_hash}`, "_blank");
              }}
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              Xem trên BSCScan
            </Button>
          )}

          {effectiveStatus === "scored" && score?.decision === "pass" && (
            <p className="text-xs text-amber-600">💡 FUN sẽ được phân bổ cuối chu kỳ tháng</p>
          )}
        </div>
      )}
    </div>
  );
}
