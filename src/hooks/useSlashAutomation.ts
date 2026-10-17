import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SlashCandidate {
  stake_id: string;
  did_id: string;
  user_id: string;
  did: string;
  display_name: string;
  stake_amount: number;
  detection_type: string;
  severity: "low" | "medium" | "high" | "critical";
  suggested_slash_pct: number;
  reason: string;
  evidence: Record<string, any>;
}

export interface SlashProposal {
  id: string;
  stake_id: string;
  did_id: string;
  user_id: string;
  detection_type: string;
  severity: string;
  suggested_slash_pct: number;
  reason: string;
  evidence: Record<string, any>;
  status: "pending" | "approved" | "rejected" | "expired";
  detected_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  applied_slash_pct: number | null;
  slashed_amount: number | null;
}

export function useSlashCandidates(limit = 50) {
  return useQuery({
    queryKey: ["slash-candidates", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("detect_slash_candidates", { _limit: limit });
      if (error) throw error;
      return (data || []) as SlashCandidate[];
    },
    refetchInterval: 120_000,
  });
}

export function useSlashProposals(status: string = "pending") {
  return useQuery({
    queryKey: ["slash-proposals", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slash_proposals")
        .select("*")
        .eq("status", status)
        .order("detected_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as SlashProposal[];
    },
    refetchInterval: 60_000,
  });
}

export function useProposeAutoSlash() {
  const qc = useQueryClient();
  return useMutation<any, Error, number | undefined>({
    mutationFn: async (limit?: number) => {
      const { data, error } = await supabase.rpc("propose_auto_slash", { _limit: limit ?? 20 });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      if (res?.success) toast.success(`Tạo ${res.created} đề xuất (bỏ qua ${res.skipped} trùng)`);
      else toast.error(res?.error || "Lỗi");
      qc.invalidateQueries({ queryKey: ["slash-proposals"] });
      qc.invalidateQueries({ queryKey: ["slash-candidates"] });
    },
    onError: (e: any) => toast.error(e?.message),
  });
}

export function useApproveSlashProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { proposal_id: string; override_pct?: number; notes?: string }) => {
      const { data, error } = await supabase.rpc("approve_slash_proposal", {
        _proposal_id: params.proposal_id,
        _override_pct: params.override_pct ?? null,
        _notes: params.notes ?? null,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      if (res?.success) toast.success(`Đã slash ${Number(res.slashed_amount).toLocaleString()} CLY`);
      else toast.error(res?.error || "Lỗi");
      qc.invalidateQueries({ queryKey: ["slash-proposals"] });
      qc.invalidateQueries({ queryKey: ["top-validators"] });
    },
    onError: (e: any) => toast.error(e?.message),
  });
}

export function useRejectSlashProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { proposal_id: string; notes?: string }) => {
      const { data, error } = await supabase.rpc("reject_slash_proposal", {
        _proposal_id: params.proposal_id,
        _notes: params.notes ?? null,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      if (res?.success) toast.success("Đã từ chối đề xuất");
      else toast.error(res?.error || "Lỗi");
      qc.invalidateQueries({ queryKey: ["slash-proposals"] });
    },
    onError: (e: any) => toast.error(e?.message),
  });
}
