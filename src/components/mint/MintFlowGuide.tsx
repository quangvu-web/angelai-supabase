import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, TrendingUp, Calendar, Shield, Coins, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: Sparkles,
    title: "Thực hiện hành động",
    desc: "Chat, đăng bài, viết nhật ký, giúp đỡ... mỗi hành động được Angel AI ghi nhận.",
    color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
  },
  {
    icon: TrendingUp,
    title: "Tích lũy Light Score",
    desc: "Hệ thống chấm điểm tự động theo 5 trụ cột PLP. Light Score tăng mỗi ngày.",
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
  },
  {
    icon: Calendar,
    title: "Kết thúc chu kỳ (cuối tháng)",
    desc: "Hệ thống tự động tính toán phân bổ FUN dựa trên tỷ lệ Light Score của bạn.",
    color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
  },
  {
    icon: Shield,
    title: "Xác minh & Ký duyệt",
    desc: "GOV Attesters (3/3) kiểm tra và ký duyệt phân bổ đảm bảo minh bạch.",
    color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: Coins,
    title: "Nhận FUN về ví",
    desc: "FUN Money (BEP-20) được mint on-chain và chuyển trực tiếp vào ví của bạn.",
    color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30",
  },
];

export function MintFlowGuide() {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Bạn nhận FUN Money như thế nào?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          FUN được phân bổ tự động theo chu kỳ tháng — bạn không cần thao tác gì!
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`p-2 rounded-full ${step.color}`}>
                  <step.icon className="h-4 w-4" />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px h-4 bg-border mt-1" />
                )}
              </div>
              <div className="pt-0.5">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
