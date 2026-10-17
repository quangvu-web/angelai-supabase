import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AttestationType =
  | "vouch_trust"
  | "vouch_skill"
  | "vouch_contribution"
  | "endorse_identity";

export interface AttestationRow {
  id: string;
  direction: "received" | "sent";
  counterparty_did: string;
  counterparty_label: string;
  attestation_type: AttestationType;
  weight: number;
  status: "active" | "revoked" | "expired";
  evidence: any;
  created_at: string;
  expires_at: string | null;
}

export function useAttestations(didId: string | null | undefined) {
  return useQuery({
    queryKey: ["attestations", didId],
    queryFn: async () => {
      if (!didId) return [];
      const { data, error } = await supabase.rpc("get_attestations_for_did", {
        _did_id: didId,
      });
      if (error) throw error;
      return (data ?? []) as AttestationRow[];
    },
    enabled: !!didId,
  });
}

export function useCreateAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      to_did_id: string;
      attestation_type: AttestationType;
      note?: string;
    }) => {
      const { data, error } = await supabase.rpc("create_attestation", {
        _to_did_id: params.to_did_id,
        _attestation_type: params.attestation_type,
        _evidence: params.note ? { note: params.note } : {},
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        const errMap: Record<string, string> = {
          no_did: "Bạn cần tạo DID trước",
          tier_too_low: "Cần Trust Tier T1+ để gửi attestation",
          no_self_attest: "Không thể tự attest chính mình",
          daily_limit: "Đã đạt giới hạn 5 attestation/ngày",
          pair_limit: "Tối đa 3 attestation/ngày cho cùng một người",
          cooldown: "Cần đợi 30 ngày kể từ attestation cùng loại trước đó",
          reciprocal_blocked: "Người này đã attest bạn trong 7 ngày qua — chống vòng đối ứng",
          loop3_blocked: "Phát hiện vòng lặp tin cậy 3 bước (A→B→C→A) — bị chặn để chống Sybil",
          invalid_type: "Loại attestation không hợp lệ",
        };
        throw new Error(result?.message || errMap[result?.error] || result?.error || "Không thể gửi attestation");
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attestations"] });
      qc.invalidateQueries({ queryKey: ["trust-profile"] });
      toast.success("Đã gửi attestation");
    },
    onError: (e: any) => toast.error(e?.message || "Lỗi gửi attestation"),
  });
}

export function useRevokeAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attestationId: string) => {
      const { data, error } = await supabase.rpc("revoke_attestation", {
        _attestation_id: attestationId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || "Không thể rút lại");
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attestations"] });
      qc.invalidateQueries({ queryKey: ["trust-profile"] });
      toast.success("Đã rút lại attestation");
    },
    onError: (e: any) => toast.error(e?.message || "Lỗi"),
  });
}

export const ATTESTATION_LABELS: Record<AttestationType, { label: string; desc: string; color: string }> = {
  vouch_trust: {
    label: "Bảo lãnh tin cậy",
    desc: "Tôi tin tưởng người này về mặt nhân cách & uy tín",
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  endorse_identity: {
    label: "Xác nhận danh tính",
    desc: "Tôi xác nhận đây là người thật, không phải tài khoản giả",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  vouch_skill: {
    label: "Xác nhận năng lực",
    desc: "Tôi xác nhận người này có năng lực/kỹ năng thực sự",
    color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
  vouch_contribution: {
    label: "Xác nhận đóng góp",
    desc: "Tôi xác nhận người này có đóng góp giá trị cho cộng đồng",
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
};
