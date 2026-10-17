import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EvolutionLogRow {
  id: string;
  coordinator_id: string;
  phase: string;
  tool_call: any;
  status: string;
  reject_reason: string | null;
  pr_branch: string | null;
  pr_url: string | null;
  github_status: number | null;
  build_passed: boolean | null;
  reflection: string | null;
  created_at: string;
  updated_at: string;
}

export function useEvolutionLog(limit = 50) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string | "all">("all");

  const query = useQuery({
    queryKey: ["angel-evolution-log", limit, filterStatus],
    queryFn: async (): Promise<EvolutionLogRow[]> => {
      let q = supabase
        .from("angel_evolution_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EvolutionLogRow[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("angel-evolution-log-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "angel_evolution_log" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["angel-evolution-log"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    filterStatus,
    setFilterStatus,
    refetch: query.refetch,
  };
}

export function useEvolutionLogById(id: string | null) {
  return useQuery({
    queryKey: ["angel-evolution-log-row", id],
    queryFn: async (): Promise<EvolutionLogRow | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("angel_evolution_log")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as EvolutionLogRow | null) ?? null;
    },
    enabled: !!id,
    refetchInterval: (q) => {
      const row = q.state.data as EvolutionLogRow | null;
      if (!row) return 3000;
      // Stop polling once terminal state
      if (["pr_opened", "build_failed", "merged", "reverted", "rejected", "rate_limited"].includes(row.status)) {
        return false;
      }
      return 3000;
    },
  });
}
