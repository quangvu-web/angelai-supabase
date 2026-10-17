import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const LEADERBOARD_REFRESH_MS = 180_000;
const LEADERBOARD_USER_LIMIT = 200;

export interface CommunityLightInfo {
  level: number;
  name_vi: string;
  name_en: string;
  icon: string;
  color: string;
  trend: string;
  total_score: number;
}

export interface LeaderboardUser {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  handle: string | null;
  balance: number;
  lifetime_earned: number;
  rank: number;
  light_info?: CommunityLightInfo;
}

export interface TopQuestion {
  id: string;
  question_text: string;
  likes_count: number;
  user_id: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  created_at: string;
}

export interface LeaderboardStats {
  total_users: number;
  active_users: number;
  total_coins_distributed: number;
}

type LeaderboardProfile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  handle: string | null;
};

export function useLeaderboard() {
  const [topUsers, setTopUsers] = useState<LeaderboardUser[]>([]);
  const [allUsers, setAllUsers] = useState<LeaderboardUser[]>([]);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);
  const [stats, setStats] = useState<LeaderboardStats>({
    total_users: 0,
    active_users: 0,
    total_coins_distributed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [balancesResult, suspensionsResult] = await Promise.all([
        supabase
          .from("camly_coin_balances")
          .select("user_id, balance, lifetime_earned")
          .order("lifetime_earned", { ascending: false })
          .limit(LEADERBOARD_USER_LIMIT),
        supabase
          .from("user_suspensions")
          .select("user_id")
          .is("lifted_at", null),
      ]);

      const { data: balances, error: balancesError } = balancesResult;
      if (balancesError) throw balancesError;

      const balanceUserIds = balances?.map(balance => balance.user_id) || [];
      let allProfiles: LeaderboardProfile[] = [];
      let profilesError = null;
      if (balanceUserIds.length > 0) {
        const profilesResult = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, handle")
          .in("user_id", balanceUserIds);
        allProfiles = profilesResult.data || [];
        profilesError = profilesResult.error;
      }
      if (profilesError) throw profilesError;

      const suspendedUserIds = new Set(
        suspensionsResult.data?.map(s => s.user_id) || []
      );

      const profileMap = new Map(
        allProfiles.map(p => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url, handle: p.handle }])
      );

      const combinedUsers: LeaderboardUser[] = [];
      
      balances?.forEach(balance => {
        if (suspendedUserIds.has(balance.user_id)) return;
        const profile = profileMap.get(balance.user_id);
        combinedUsers.push({
          user_id: balance.user_id,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          handle: profile?.handle || null,
          balance: balance.balance || 0,
          lifetime_earned: balance.lifetime_earned || 0,
          rank: 0,
        });
      });

      // Separate named users and anonymous users
      const namedUsers = combinedUsers.filter(u => u.display_name && u.display_name.trim() !== "");
      const anonymousUsers = combinedUsers.filter(u => !u.display_name || u.display_name.trim() === "");

      // Shuffle each group randomly (No Ego)
      for (let i = namedUsers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [namedUsers[i], namedUsers[j]] = [namedUsers[j], namedUsers[i]];
      }
      for (let i = anonymousUsers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [anonymousUsers[i], anonymousUsers[j]] = [anonymousUsers[j], anonymousUsers[i]];
      }

      // Named users first, anonymous last
      combinedUsers.length = 0;
      combinedUsers.push(...namedUsers, ...anonymousUsers);

      combinedUsers.forEach((user, index) => {
        user.rank = index + 1;
      });

      // Fetch light levels for all displayed users
      const displayUserIds = combinedUsers.map(u => u.user_id);
      if (displayUserIds.length > 0) {
        try {
          const { data: lightData } = await supabase.rpc("get_community_light_summary", {
            _user_ids: displayUserIds,
          });

          if (lightData && Array.isArray(lightData)) {
            const lightMap = new Map(
              lightData.map((l: any) => [l.user_id, {
                level: l.light_level ?? l.level,
                name_vi: l.level_name_vi ?? l.name_vi,
                name_en: l.level_name_vi ?? l.name_en,
                icon: l.level_icon ?? l.icon,
                color: l.level_color ?? l.color,
                trend: l.trend ?? 'stable',
                total_score: l.total_score ?? 0,
              }])
            );

            combinedUsers.forEach(user => {
              const info = lightMap.get(user.user_id);
              if (info) user.light_info = info;
            });
          }
        } catch (e) {
          console.warn("Could not fetch light levels:", e);
        }
      }

      setAllUsers(combinedUsers);
      setTopUsers(combinedUsers.slice(0, 9));

      // Stats
      const totalCoins = (balances || []).reduce((sum, b) => sum + (b.lifetime_earned || 0), 0);
      const { count: activeUsersCount } = await supabase
        .from('camly_coin_balances')
        .select('*', { count: 'exact', head: true })
        .gt('lifetime_earned', 0);

      let profilesCount: number | null = null;
      if (suspendedUserIds.size > 0) {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .not('user_id', 'in', `(${[...suspendedUserIds].join(',')})`);
        profilesCount = count;
      } else {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        profilesCount = count;
      }

      setStats({
        total_users: profilesCount || 0,
        active_users: activeUsersCount || 0,
        total_coins_distributed: totalCoins,
      });

      // Fetch top questions
      const { data: questions, error: questionsError } = await supabase
        .from("chat_questions")
        .select("id, question_text, likes_count, user_id, created_at")
        .eq("is_rewarded", true)
        .eq("is_spam", false)
        .gt("likes_count", 0)
        .order("likes_count", { ascending: false })
        .limit(10);

      if (questionsError) throw questionsError;

      if (questions && questions.length > 0) {
        const questionUserIds = [...new Set(questions.map(q => q.user_id))];
        const { data: questionProfiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", questionUserIds);

        const qProfileMap = new Map(
          questionProfiles?.map(p => [p.user_id, p]) || []
        );

        const enrichedQuestions: TopQuestion[] = questions.map(q => ({
          id: q.id,
          question_text: q.question_text,
          likes_count: q.likes_count || 0,
          user_id: q.user_id,
          user_display_name: qProfileMap.get(q.user_id)?.display_name || "Ẩn danh",
          user_avatar_url: qProfileMap.get(q.user_id)?.avatar_url || null,
          created_at: q.created_at,
        }));

        setTopQuestions(enrichedQuestions);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    const interval = window.setInterval(fetchLeaderboard, LEADERBOARD_REFRESH_MS);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    topUsers,
    allUsers,
    topQuestions,
    stats,
    isLoading,
    refreshLeaderboard: fetchLeaderboard,
  };
}
