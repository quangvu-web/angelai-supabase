import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TrustAdminStats {
  tier_distribution: Record<string, number>;
  sybil_distribution: Record<string, number>;
  tc_trend_30d: { day: string; avg_tc: number }[];
  sbt_status: Record<string, number>;
  recovery_pending: number;
  computed_at: string;
}

export function useTrustAdminStats() {
  return useQuery({
    queryKey: ["trust-admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_trust_admin_stats");
      if (error) throw error;
      return data as unknown as TrustAdminStats;
    },
    refetchInterval: 60_000,
  });
}

export function useAdminSBTList(filters: { sbt_type?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: ["admin-sbt-list", filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_sbts", {
        _sbt_type: filters.sbt_type || null,
        _status: filters.status || null,
        _search: filters.search || null,
        _limit: 200,
      });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAdminPendingRecovery() {
  return useQuery({
    queryKey: ["admin-pending-recovery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recovery_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });
}

export function useSBTAdminMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-sbt-list"] });
    qc.invalidateQueries({ queryKey: ["trust-admin-stats"] });
  };
  const freeze = useMutation({
    mutationFn: async ({ token_id, reason }: { token_id: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_freeze_sbt", { _token_id: token_id, _reason: reason || null });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Đã đóng băng SBT"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Lỗi"),
  });
  const revoke = useMutation({
    mutationFn: async ({ token_id, reason }: { token_id: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_revoke_sbt", { _token_id: token_id, _reason: reason || null });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Đã thu hồi SBT"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Lỗi"),
  });
  const extend = useMutation({
    mutationFn: async ({ token_id, new_expiry }: { token_id: string; new_expiry: string | null }) => {
      const { data, error } = await supabase.rpc("admin_extend_sbt", { _token_id: token_id, _new_expiry: new_expiry });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Đã cập nhật hạn SBT"); invalidate(); },
    onError: (e: any) => toast.error(e?.message || "Lỗi"),
  });
  return { freeze, revoke, extend };
}

export function useResolveRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ request_id, decision, reason }: { request_id: string; decision: "approve" | "reject"; reason?: string }) => {
      const { data, error } = await supabase.rpc("admin_resolve_recovery", {
        _request_id: request_id,
        _decision: decision,
        _reason: reason || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.decision === "approve" ? "Đã duyệt" : "Đã từ chối");
      qc.invalidateQueries({ queryKey: ["admin-pending-recovery"] });
      qc.invalidateQueries({ queryKey: ["trust-admin-stats"] });
    },
    onError: (e: any) => toast.error(e?.message || "Lỗi"),
  });
}
