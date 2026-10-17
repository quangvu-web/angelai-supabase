import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, ChevronDown, Sparkles, Users } from "lucide-react";
import { RainbowTitle } from "@/components/leaderboard/RainbowTitle";
import { Button } from "@/components/ui/button";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { RankingRow } from "@/components/leaderboard/RankingRow";

export function Leaderboard() {
  const { allUsers, isLoading, stats } = useLeaderboard();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  const displayUsers = allUsers.slice(0, 6);

  if (isLoading) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-[var(--shadow-divine)]">
        <div className="h-1.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
        <div className="bg-card p-5 animate-pulse">
          <div className="h-8 bg-muted rounded-lg w-2/3 mx-auto mb-5" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-muted/60 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_4px_30px_rgba(218,165,32,0.15)] border border-[#daa520]/30">
      {/* Premium gold accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-[#b8860b] via-[#ffd700] to-[#b8860b]" />

      <div className="bg-card p-5">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="flex justify-center items-center gap-2 mb-2">
            <span className="text-lg">✨</span>
            <RainbowTitle text={t("leaderboard.topRanking")} className="text-2xl md:text-3xl tracking-[3px]" />
            <span className="text-lg">✨</span>
          </div>
          {/* Member count */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#ffd700]/10 via-[#ffec8b]/15 to-[#ffd700]/10 border border-[#daa520]/25">
            <Users className="w-3.5 h-3.5 text-[#b8860b]" />
            <span className="text-xs font-semibold text-[#b8860b]">
              {stats.total_users} {t("leaderboard.members") || "thành viên"}
            </span>
          </div>
        </div>

        {/* Member grid */}
        {allUsers.length > 0 ? (
          <>
            <div className="flex flex-col gap-2">
              {displayUsers.map((user, i) => (
                <motion.div
                  key={user.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <RankingRow user={user} />
                </motion.div>
              ))}
            </div>

            {/* Show more */}
            {allUsers.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/light-community")}
                className="w-full mt-3 text-xs text-muted-foreground hover:text-primary hover:bg-primary-pale/40 rounded-xl"
              >
                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                {t("common.showMore") || "Xem thêm"} ({allUsers.length - 6})
              </Button>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary/40" />
            <p className="text-sm">{t("common.noData")}</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-4 pt-3 border-t border-[#daa520]/15">
          <Link to="/community" className="block">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs font-semibold text-[#b8860b] hover:text-[#daa520] hover:bg-[#ffd700]/10 rounded-xl"
            >
              <Trophy className="w-3.5 h-3.5 mr-1.5 text-[#daa520]" />
              {t("leaderboard.viewCommunity") || "Xem Cộng Đồng"} →
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;
