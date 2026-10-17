import { useLightPoints, LEVEL_THRESHOLDS } from "@/hooks/useLightPoints";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Star, TrendingUp, Trophy } from "lucide-react";

const LightPointsDisplay = () => {
  const { totalPoints, lifetimePoints, isLoading, getLevelInfo, recentPoints, getCurrentMonth } = useLightPoints();

  const lifetimeLevelInfo = getLevelInfo(lifetimePoints);
  const monthlyLevelInfo = getLevelInfo(totalPoints);

  if (isLoading) {
    return (
      <Card className="border-divine-gold/20 shadow-soft animate-pulse">
        <CardContent className="pt-6">
          <div className="h-24 bg-divine-gold/10 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-divine-gold/20 shadow-soft overflow-hidden">
      {/* Header - Lifetime level */}
      <div className="bg-gradient-to-r from-divine-gold/20 via-divine-light/20 to-divine-gold/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-divine-gold/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-divine-gold" />
            </div>
            <div>
              <p className="text-sm text-foreground-muted">Level {lifetimeLevelInfo.level} (tích lũy)</p>
              <h3 className="font-bold text-divine-gold">{lifetimeLevelInfo.title}</h3>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-divine-gold">{totalPoints.toLocaleString()} ⭐</p>
            <p className="text-xs text-foreground-muted">Điểm {getCurrentMonth()}</p>
            <p className="text-xs text-foreground-muted mt-0.5 flex items-center justify-end gap-1">
              <Trophy className="w-3 h-3" /> Tích lũy: {lifetimePoints.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="pt-4 space-y-4">
        {/* Monthly progress */}
        {monthlyLevelInfo.nextLevel && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground-muted">Tiến trình tháng → Level {monthlyLevelInfo.nextLevel.level}</span>
              <span className="text-divine-gold font-medium">
                {totalPoints} / {monthlyLevelInfo.nextLevel.points}
              </span>
            </div>
            <Progress value={monthlyLevelInfo.progress} className="h-2" />
            <p className="text-xs text-foreground-muted">
              Còn {monthlyLevelInfo.nextLevel.points - totalPoints} điểm để đạt "{monthlyLevelInfo.nextLevel.title}"
            </p>
          </div>
        )}

        {/* Lifetime progress (smaller) */}
        {lifetimeLevelInfo.nextLevel && (
          <div className="space-y-1.5 pt-2 border-t border-divine-gold/10">
            <div className="flex justify-between text-xs">
              <span className="text-foreground-muted">Tích lũy → Level {lifetimeLevelInfo.nextLevel.level} ({lifetimeLevelInfo.nextLevel.title})</span>
              <span className="text-foreground-muted">
                {lifetimePoints} / {lifetimeLevelInfo.nextLevel.points}
              </span>
            </div>
            <Progress value={lifetimeLevelInfo.progress} className="h-1.5" />
          </div>
        )}

        {/* Recent points */}
        {recentPoints.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-divine-gold/10">
            <p className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-divine-gold" />
              Điểm gần đây
            </p>
            <div className="space-y-1">
              {recentPoints.slice(0, 3).map((point) => (
                <div key={point.id} className="flex justify-between items-center text-sm">
                  <span className="text-foreground-muted truncate max-w-[200px]">
                    {point.reason}
                  </span>
                  <span className="text-green-500 font-medium">+{point.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Level badges */}
        <div className="pt-2 border-t border-divine-gold/10">
          <p className="text-sm font-medium mb-2">Các cấp độ ánh sáng</p>
          <div className="flex flex-wrap gap-2">
            {LEVEL_THRESHOLDS.slice(0, 5).map((level) => (
              <div
                key={level.level}
                className={`px-2 py-1 rounded-full text-xs ${
                  lifetimeLevelInfo.level >= level.level
                    ? "bg-divine-gold/20 text-divine-gold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Star className={`inline w-3 h-3 mr-1 ${lifetimeLevelInfo.level >= level.level ? "fill-current" : ""}`} />
                {level.title}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LightPointsDisplay;
