import { useBehaviorSequences, getSequenceLabel } from "@/hooks/useBehaviorSequences";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, Zap } from "lucide-react";

export function BehaviorSequenceTracker() {
  const { activeSequences, completedSequences, isLoading } = useBehaviorSequences();
  const { currentLanguage: language } = useLanguage();

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  const allSequences = [...activeSequences, ...completedSequences.slice(0, 3)];

  if (allSequences.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            {language === "vi" ? "Chuỗi Hành Vi" : "Behavior Sequences"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {language === "vi"
              ? "Chưa có chuỗi hành vi nào. Hãy bắt đầu bằng cách đăng bài, hỏi đáp hoặc hỗ trợ cộng đồng!"
              : "No sequences yet. Start by posting, asking questions, or helping the community!"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          {language === "vi" ? "Chuỗi Hành Vi" : "Behavior Sequences"}
          {completedSequences.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {completedSequences.length} {language === "vi" ? "hoàn thành" : "completed"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {allSequences.map((seq) => {
          const label = getSequenceLabel(seq.sequence_type, language);
          const isCompleted = seq.status === "completed";

          return (
            <div
              key={seq.id}
              className={`p-3 rounded-lg border ${
                isCompleted
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                  : "bg-card border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{label.icon}</span>
                  <span className="text-sm font-medium">{label.name}</span>
                </div>
                {isCompleted ? (
                  <Badge className="bg-emerald-500 text-white text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    x{seq.sequence_multiplier}
                  </Badge>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {seq.stage}/{seq.max_stage}
                  </div>
                )}
              </div>

              {/* Stage pipeline */}
              <div className="flex gap-1">
                {Array.from({ length: seq.max_stage }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      i < seq.stage
                        ? isCompleted
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
