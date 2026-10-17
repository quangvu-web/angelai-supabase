import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Guardian {
  id: string;
  guardian_user_id: string;
  status: "pending" | "active" | "revoked";
  invited_at: string;
  accepted_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface GuardianInbox {
  relationship_id: string;
  user_id: string;
  status: "pending" | "active" | "revoked";
  invited_at: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  pending_requests: number;
}

export interface RecoveryRequest {
  id: string;
  request_type: string;
  status: "pending" | "approved" | "rejected" | "executed" | "expired" | "cancelled";
  approvals_count: number;
  rejections_count: number;
  required_approvals: number;
  reason: string | null;
  expires_at: string;
  created_at: string;
  executed_at: string | null;
}

export interface PendingRecoveryForGuardian {
  request_id: string;
  user_id: string;
  request_type: string;
  reason: string | null;
  approvals_count: number;
  rejections_count: number;
  required_approvals: number;
  created_at: string;
  expires_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function useMyGuardians() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-guardians", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_guardians");
      if (error) throw error;
      return (data || []) as Guardian[];
    },
    enabled: !!user?.id,
  });
}

export function useGuardianInbox() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["guardian-inbox", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_guardian_inbox");
      if (error) throw error;
      return (data || []) as GuardianInbox[];
    },
    enabled: !!user?.id,
  });
}

export function useMyRecoveryRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-recovery-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_recovery_requests");
      if (error) throw error;
      return (data || []) as RecoveryRequest[];
    },
    enabled: !!user?.id,
  });
}

export function usePendingRecoveryForGuardian() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pending-recovery-guardian", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pending_recovery_for_guardian");
      if (error) throw error;
      return (data || []) as PendingRecoveryForGuardian[];
    },
    enabled: !!user?.id,
  });
}

export function useAddGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ guardian_user_id, note }: { guardian_user_id: string; note?: string }) => {
      const { data, error } = await supabase.rpc("add_guardian", {
        _guardian_user_id: guardian_user_id,
        _note: note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã gửi lời mời guardian");
      qc.invalidateQueries({ queryKey: ["my-guardians"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message || e}`),
  });
}

export function useAcceptGuardianInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relationship_id: string) => {
      const { data, error } = await supabase.rpc("accept_guardian_invite", { _relationship_id: relationship_id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã chấp nhận làm guardian");
      qc.invalidateQueries({ queryKey: ["guardian-inbox"] });
      qc.invalidateQueries({ queryKey: ["my-guardians"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message || e}`),
  });
}

export function useRevokeGuardian() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (relationship_id: string) => {
      const { data, error } = await supabase.rpc("revoke_guardian", { _relationship_id: relationship_id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã xoá guardian");
      qc.invalidateQueries({ queryKey: ["my-guardians"] });
      qc.invalidateQueries({ queryKey: ["guardian-inbox"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message || e}`),
  });
}

export function useCreateRecoveryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request_type, payload, reason,
    }: { request_type: string; payload?: any; reason?: string }) => {
      const { data, error } = await supabase.rpc("create_recovery_request", {
        _request_type: request_type,
        _payload: payload ?? {},
        _reason: reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã tạo yêu cầu khôi phục");
      qc.invalidateQueries({ queryKey: ["my-recovery-requests"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message || e}`),
  });
}

export function useVoteRecoveryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request_id, decision, reason,
    }: { request_id: string; decision: "approve" | "reject"; reason?: string }) => {
      const { data, error } = await supabase.rpc("vote_recovery_request", {
        _request_id: request_id,
        _decision: decision,
        _reason: reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Đã vote: ${data?.status || "pending"}`);
      qc.invalidateQueries({ queryKey: ["pending-recovery-guardian"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message || e}`),
  });
}

export function useExecuteRecovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request_id: string) => {
      const { data, error } = await supabase.rpc("execute_recovery", { _request_id: request_id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Đã thực thi khôi phục");
      qc.invalidateQueries({ queryKey: ["my-recovery-requests"] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message || e}`),
  });
}
