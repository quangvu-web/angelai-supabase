import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createRealtimeChannelId } from "@/lib/realtime";

const DEFAULT_CAP = 300000;

function todayVN(): string {
  // YYYY-MM-DD theo Asia/Ho_Chi_Minh (UTC+7)
  const now = new Date();
  const vn = new Date(now.getTime() + (7 * 60 - now.getTimezoneOffset()) * 60000);
  return vn.toISOString().slice(0, 10);
}

export function useDailyCamlyCap() {
  const { user } = useAuth();
  const [earned, setEarned] = useState(0);
  const [clipped, setClipped] = useState(0);
  const [hitCapAt, setHitCapAt] = useState<string | null>(null);
  const [cap, setCap] = useState(DEFAULT_CAP);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const date = todayVN();
    const [{ data: row }, { data: cfg }] = await Promise.all([
      supabase
        .from("daily_camly_cap_ledger")
        .select("earned_total, clipped_total, hit_cap_at")
        .eq("user_id", user.id)
        .eq("cap_date", date)
        .maybeSingle(),
      supabase
        .from("pplp_parameter_config")
        .select("value")
        .eq("key", "daily_camly_cap")
        .maybeSingle(),
    ]);
    setEarned(Number(row?.earned_total ?? 0));
    setClipped(Number(row?.clipped_total ?? 0));
    setHitCapAt(row?.hit_cap_at ?? null);
    const capVal = Number(cfg?.value ?? DEFAULT_CAP);
    setCap(Number.isFinite(capVal) && capVal > 0 ? capVal : DEFAULT_CAP);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(createRealtimeChannelId(`camly_cap_${user.id}`))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "daily_camly_cap_ledger",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchData()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, fetchData]);

  const remaining = Math.max(0, cap - earned);
  const percent = cap > 0 ? Math.min(100, Math.round((earned / cap) * 100)) : 0;

  return { earned, clipped, hitCapAt, cap, remaining, percent, loading, refetch: fetchData };
}
