import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DIBProfile {
  id: string;
  did_id: string;
  user_id: string;
  identity_vault_hash: string | null;
  trust_vault_hash: string | null;
  reputation_vault_hash: string | null;
  contribution_vault_hash: string | null;
  credential_vault_hash: string | null;
  governance_vault_hash: string | null;
  economic_access_hash: string | null;
  snapshot_root_hash: string | null;
  last_snapshot_at: string | null;
  updated_at: string;
}

export function useDIB(didId: string | undefined | null) {
  return useQuery({
    queryKey: ["dib-profile", didId],
    queryFn: async () => {
      if (!didId) return null;
      const { data, error } = await supabase
        .from("dib_profile")
        .select("*")
        .eq("did_id", didId)
        .maybeSingle();
      if (error) throw error;
      return data as DIBProfile | null;
    },
    enabled: !!didId,
  });
}

/**
 * Recompute 7 vault hashes + snapshot root for a DID.
 * Calls SECURITY DEFINER RPC `compute_dib_vault_hashes`.
 */
export function useRecomputeDIB() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (didId: string) => {
      const { data, error } = await supabase.rpc("compute_dib_vault_hashes", {
        _did_id: didId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, didId) => {
      toast.success("Đã làm mới 7 vault hashes");
      qc.invalidateQueries({ queryKey: ["dib-profile", didId] });
      qc.invalidateQueries({ queryKey: ["user-did", user?.id] });
    },
    onError: (e: any) => toast.error(`Lỗi: ${e?.message || "unknown"}`),
  });
}
