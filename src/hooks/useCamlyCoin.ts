import { useState, useEffect, useCallback } from "react";
import { createRealtimeChannelId } from "@/lib/realtime";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CamlyCoinData {
  balance: number;
  lifetimeEarned: number;
  isLoading: boolean;
  dailyStatus: {
    questionsRewarded: number;
    questionsRemaining: number;
    journalsRewarded: number;
    journalsRemaining: number;
    canWriteJournal: boolean;
  } | null;
  recentTransactions: {
    id: string;
    amount: number;
    transaction_type: string;
    description: string | null;
    purity_score: number | null;
    created_at: string;
  }[];
}

export function useCamlyCoin() {
  const { user } = useAuth();
  const [data, setData] = useState<CamlyCoinData>({
    balance: 0,
    lifetimeEarned: 0,
    isLoading: true,
    dailyStatus: null,
    recentTransactions: [],
  });

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const [balanceResult, dailyStatusResult, transactionsResult] = await Promise.all([
        supabase
          .from("camly_coin_balances")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("get_extended_daily_reward_status", { _user_id: user.id }),
        supabase
          .from("camly_coin_transactions")
          .select("id,amount,transaction_type,description,purity_score,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (dailyStatusResult.error) {
        throw dailyStatusResult.error;
      }

      if (balanceResult.error) {
        throw balanceResult.error;
      }

      if (transactionsResult.error) {
        throw transactionsResult.error;
      }

      const status = dailyStatusResult.data?.[0];

      setData({
        balance: balanceResult.data?.balance || 0,
        lifetimeEarned: balanceResult.data?.lifetime_earned || 0,
        isLoading: false,
        dailyStatus: status ? {
          questionsRewarded: status.questions_rewarded,
          questionsRemaining: status.questions_remaining,
          journalsRewarded: status.journals_rewarded,
          journalsRemaining: status.journals_remaining,
          canWriteJournal: status.can_write_journal,
        } : null,
        recentTransactions: transactionsResult.data || [],
      });
    } catch (error) {
      console.error("Error fetching Camly coin data:", error);
      setData(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  const refreshBalance = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;

    // Initial fetch on mount / user change.
    // Không polling — dựa vào realtime subscribe bên dưới (giảm 100k+ query/tuần
    // trên bảng camly_coin_transactions). Gọi refreshBalance() thủ công sau
    // hành động phát sinh coin (chat, gift, quest...) để có UX cập nhật tức thì.
    fetchData();
  }, [user, fetchData]);

  // Subscribe to realtime balance updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(createRealtimeChannelId(`camly_coins_${user.id}`))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "camly_coin_balances",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  return {
    ...data,
    refreshBalance,
  };
}
