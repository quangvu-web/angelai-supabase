import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Coins,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

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

// Helper to extract single object from one-to-one joined data
function resolveOne<T>(data: T | T[] | undefined | null): T | undefined {
  if (!data) return undefined;
  return Array.isArray(data) ? data[0] : data;
}

interface Props {
  action: PPLPAction;
  onMintSuccess?: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  QUESTION_ASK: "Hỏi Angel AI",
  JOURNAL_WRITE: "Viết nhật ký biết ơn",
  CONTENT_CREATE: "Đăng bài cộng đồng",
  POST_CREATE: "Đăng bài cộng đồng",
  COMMENT_CREATE: "Bình luận bài viết",
  POST_ENGAGEMENT: "Tương tác bài viết",
  SHARE_CONTENT: "Chia sẻ nội dung",
  DONATE: "Đóng góp/Tặng quà",
  DONATE_SUPPORT: "Đóng góp/Tặng quà",
  CONTENT_SHARE: "Chia sẻ nội dung",
  COMMUNITY_HELP: "Giúp đỡ cộng đồng",
  HELP_COMMUNITY: "Xây dựng cộng đồng",
  MENTOR_HELP: "Hỗ trợ người mới",
  IDEA_SUBMIT: "Đề xuất ý tưởng",
  FEEDBACK_GIVE: "Góp ý cải thiện",
  DAILY_LOGIN: "Đăng nhập hàng ngày",
  GRATITUDE_PRACTICE: "Thực hành biết ơn",
  VISION_CREATE: "Tạo Vision Board",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Đang xử lý", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  scored: { label: "Sẵn sàng mint", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  minted: { label: "Đã nhận FUN", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  failed: { label: "Thất bại", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export function FUNMoneyMintCard({ action, onMintSuccess }: Props) {
  const score = resolveOne(action.pplp_scores);
  const mintRequest = resolveOne(action.pplp_mint_requests);
  const statusConfig = STATUS_CONFIG[action.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // Determine mint request status
  const mintRequestStatus = mintRequest?.status;
  const hasTxHash = mintRequest?.tx_hash && mintRequest.tx_hash.startsWith("0x");
  const isPendingApproval = mintRequestStatus === "pending";
  const isSigned = mintRequestStatus === "signed";
  const isMintedOnChain = mintRequestStatus === "minted" || action.status === "minted";

  return (
    <Card className="transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Sparkles className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                {ACTION_LABELS[action.action_type] || action.action_type}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: vi })}
              </div>
            </div>
          </div>
          <Badge className={statusConfig.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Light Score */}
        {score && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Light Score</span>
              <span className="font-bold text-amber-600">{score.light_score}/100</span>
            </div>
            <Progress value={score.light_score} className="h-2" />

            {/* 5 Pillars mini view */}
            <div className="grid grid-cols-5 gap-1 text-xs">
              <div className="text-center p-1 rounded bg-red-50 dark:bg-red-900/20">
                <div className="font-medium text-red-600">S</div>
                <div>{score.pillar_s}</div>
              </div>
              <div className="text-center p-1 rounded bg-blue-50 dark:bg-blue-900/20">
                <div className="font-medium text-blue-600">T</div>
                <div>{score.pillar_t}</div>
              </div>
              <div className="text-center p-1 rounded bg-green-50 dark:bg-green-900/20">
                <div className="font-medium text-green-600">H</div>
                <div>{score.pillar_h}</div>
              </div>
              <div className="text-center p-1 rounded bg-yellow-50 dark:bg-yellow-900/20">
                <div className="font-medium text-yellow-600">C</div>
                <div>{score.pillar_c}</div>
              </div>
              <div className="text-center p-1 rounded bg-purple-50 dark:bg-purple-900/20">
                <div className="font-medium text-purple-600">U</div>
                <div>{score.pillar_u}</div>
              </div>
            </div>
          </div>
        )}

        {/* Reward Amount */}
        {score && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium">Reward</span>
            </div>
            <span className="text-xl font-bold text-amber-600">
              +{score.final_reward.toLocaleString()} FUN
            </span>
          </div>
        )}

        {/* Mint Request Status Badges */}
        {isPendingApproval && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              Đang chờ Admin phê duyệt
            </span>
          </div>
        )}

        {isSigned && !hasTxHash && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Đã ký, đang chờ giao dịch on-chain
            </span>
          </div>
        )}

        {/* Action Button */}
        {isMintedOnChain ? (
          <div className="space-y-2">
            <Button variant="outline" className="w-full" disabled>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
              {hasTxHash ? "Đã mint on-chain" : "Đã nhận FUN"}
            </Button>
            {hasTxHash && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() =>
                  window.open(`https://testnet.bscscan.com/tx/${mintRequest?.tx_hash}`, "_blank")
                }
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                Xem trên BSCScan
              </Button>
            )}
          </div>
        ) : isPendingApproval || isSigned ? (
          <Button variant="outline" className="w-full" disabled>
            <Clock className="mr-2 h-4 w-4" />
            Đang xử lý...
          </Button>
        ) : action.status === "scored" && score?.decision === "pass" ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-700 dark:text-amber-300">
              FUN sẽ được phân bổ cuối chu kỳ tháng dựa trên tổng Light Score
            </span>
          </div>
        ) : action.status === "pending" ? (
          <Button variant="outline" className="w-full" disabled>
            <Clock className="mr-2 h-4 w-4" />
            Đang chờ chấm điểm...
          </Button>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            <AlertCircle className="mr-2 h-4 w-4" />
            Không đủ điều kiện mint
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
