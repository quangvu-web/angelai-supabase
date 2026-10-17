import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PPLPScoreRadar } from "./PPLPScoreRadar";
import { PPLPPillarScores } from "@/hooks/usePPLPScore";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Zap, Shield, Target } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ValidationDetailCardProps {
  actionId: string;
  actionType: string;
  pillars: PPLPPillarScores;
  lightScore: number;
  decision: "pass" | "fail";
  decisionReason?: string;
  finalReward: number;
  qualityQ?: number;
  impactI?: number;
  integrityK?: number;
  createdAt: string;
}

const PILLAR_CONFIG = [
  { key: "pillar_s" as const, label: "Phục Vụ (S)", color: "#10b981" },
  { key: "pillar_t" as const, label: "Chân Thật (T)", color: "#3b82f6" },
  { key: "pillar_h" as const, label: "Chữa Lành (H)", color: "#ec4899" },
  { key: "pillar_c" as const, label: "Đóng Góp (C)", color: "#f59e0b" },
  { key: "pillar_u" as const, label: "Hợp Nhất (U)", color: "#8b5cf6" },
];

export function ValidationDetailCard({
  actionType,
  pillars,
  lightScore,
  decision,
  decisionReason,
  finalReward,
  qualityQ = 1,
  impactI = 1,
  integrityK = 1,
  createdAt,
}: ValidationDetailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { currentLanguage: language } = useLanguage();

  return (
    <Card className="border border-border/50 hover:shadow-md transition-shadow">
      {/* Compact header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {decision === "pass" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-medium capitalize">
                {actionType.replace(/_/g, " ")}
              </span>
              <Badge
                variant={decision === "pass" ? "default" : "destructive"}
                className="text-[10px] px-1.5 py-0"
              >
                {decision === "pass" ? "✓ Pass" : "✗ Fail"}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {new Date(createdAt).toLocaleDateString()}
              </span>
              <span className="font-mono text-sm font-bold text-primary">
                LS: {lightScore}
              </span>
              {finalReward > 0 && (
                <Badge className="bg-amber-500 text-white text-[10px]">
                  +{finalReward.toFixed(1)} FUN
                </Badge>
              )}
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardHeader>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <CardContent className="pt-0 pb-4 px-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Radar chart */}
            <div className="flex justify-center">
              <PPLPScoreRadar pillars={pillars} size="md" />
            </div>

            {/* Pillar bars */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {language === "vi" ? "Chi tiết 5 trụ cột" : "5 Pillar Breakdown"}
              </p>
              {PILLAR_CONFIG.map(({ key, label, color }) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span style={{ color }}>{label}</span>
                    <span className="font-mono font-medium">{pillars[key]}</span>
                  </div>
                  <Progress
                    value={pillars[key]}
                    className="h-1.5"
                    style={{ "--progress-color": color } as React.CSSProperties}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Multipliers */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-lg p-2 text-center">
              <Zap className="h-3.5 w-3.5 mx-auto text-amber-500 mb-1" />
              <p className="text-[10px] text-muted-foreground">Quality</p>
              <p className="text-sm font-bold">×{qualityQ.toFixed(1)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2 text-center">
              <Target className="h-3.5 w-3.5 mx-auto text-blue-500 mb-1" />
              <p className="text-[10px] text-muted-foreground">Impact</p>
              <p className="text-sm font-bold">×{impactI.toFixed(1)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2 text-center">
              <Shield className="h-3.5 w-3.5 mx-auto text-green-500 mb-1" />
              <p className="text-[10px] text-muted-foreground">Integrity</p>
              <p className="text-sm font-bold">{(integrityK * 100).toFixed(0)}%</p>
            </div>
          </div>

          {/* Decision reason */}
          {decisionReason && (
            <div className="bg-muted/20 rounded p-2 text-xs text-muted-foreground">
              <span className="font-medium">
                {language === "vi" ? "Lý do: " : "Reason: "}
              </span>
              {decisionReason}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
