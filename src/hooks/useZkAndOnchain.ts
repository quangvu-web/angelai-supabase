import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/** Compute SHA-256 hash hex of a string (browser-side) */
async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a random nonce */
export function genNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build commitment hash from attestation params */
export async function buildCommitmentHash(params: {
  fromDid: string;
  toDid: string;
  attestationType: string;
  weight: number;
  nonce: string;
}): Promise<string> {
  const { fromDid, toDid, attestationType, weight, nonce } = params;
  return sha256Hex(`${fromDid}|${toDid}|${attestationType}|${weight}|${nonce}`);
}

export interface ZkCommitment {
  id: string;
  commitment_hash: string;
  attestation_type_hint: string | null;
  privacy_level: string;
  status: "committed" | "revealed" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
  revealed_at: string | null;
}

export function useMyCommitments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-zk-commitments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("zk_attestation_commitments")
        .select("*")
        .eq("from_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as ZkCommitment[];
    },
    enabled: !!user,
  });
}

export function useCommitPrivateAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      commitment_hash: string;
      attestation_type_hint?: string;
      privacy_level?: "private" | "permissioned";
    }) => {
      const { data, error } = await supabase.rpc("commit_private_attestation", {
        _commitment_hash: params.commitment_hash,
        _attestation_type_hint: params.attestation_type_hint ?? "private_endorsement",
        _privacy_level: params.privacy_level ?? "private",
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      if (res?.success) {
        toast.success("Đã commit chứng thực riêng tư");
        qc.invalidateQueries({ queryKey: ["my-zk-commitments"] });
      } else toast.error(res?.error || "Lỗi");
    },
    onError: (e: any) => toast.error(e?.message),
  });
}

export function useRevealAttestation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      commitment_id: string;
      to_did: string;
      attestation_type: string;
      weight: number;
      nonce: string;
      expected_hash: string;
      evidence?: any;
    }) => {
      const { data, error } = await supabase.rpc("reveal_private_attestation", {
        _commitment_id: params.commitment_id,
        _to_did: params.to_did,
        _attestation_type: params.attestation_type,
        _weight: params.weight,
        _nonce: params.nonce,
        _expected_hash: params.expected_hash,
        _evidence: params.evidence ?? {},
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      if (res?.success) {
        toast.success("Đã tiết lộ chứng thực");
        qc.invalidateQueries({ queryKey: ["my-zk-commitments"] });
      } else toast.error(res?.error || "Lỗi");
    },
    onError: (e: any) => toast.error(e?.message),
  });
}

// =========================================================
// SBT On-chain Mint Queue
// =========================================================
export interface SbtQueueItem {
  id: string;
  sbt_id: string;
  network: string;
  contract_address: string | null;
  wallet_address: string;
  status: "pending" | "processing" | "minted" | "failed" | "cancelled";
  tx_hash: string | null;
  on_chain_token_id: string | null;
  error_message: string | null;
  enqueued_at: string;
  minted_at: string | null;
}

export function useMySbtQueue() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-sbt-queue", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("sbt_onchain_queue")
        .select("*")
        .eq("user_id", user.id)
        .order("enqueued_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as SbtQueueItem[];
    },
    enabled: !!user,
  });
}

export function useEnqueueSbtMint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      sbt_id: string;
      wallet_address: string;
      network?: string;
      metadata_uri?: string;
    }) => {
      const { data, error } = await supabase.rpc("enqueue_sbt_mint", {
        _sbt_id: params.sbt_id,
        _wallet_address: params.wallet_address,
        _network: params.network ?? "bsc-testnet",
        _metadata_uri: params.metadata_uri ?? null,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      if (res?.success) {
        toast.success("Đã thêm SBT vào hàng đợi mint on-chain");
        qc.invalidateQueries({ queryKey: ["my-sbt-queue"] });
        qc.invalidateQueries({ queryKey: ["sbt-queue-admin"] });
      } else toast.error(res?.error || "Lỗi");
    },
    onError: (e: any) => toast.error(e?.message),
  });
}

export function useSbtQueueStats() {
  return useQuery({
    queryKey: ["sbt-queue-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sbt_mint_queue_stats");
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 30_000,
  });
}

export function useAdminSbtQueue(status: string = "pending") {
  return useQuery({
    queryKey: ["sbt-queue-admin", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sbt_onchain_queue")
        .select("*")
        .eq("status", status)
        .order("enqueued_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as SbtQueueItem[];
    },
    refetchInterval: 30_000,
  });
}

export function useMarkSbtMinted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      queue_id: string;
      tx_hash: string;
      block_number: number;
      on_chain_token_id: string;
      contract_address: string;
    }) => {
      const { data, error } = await supabase.rpc("mark_sbt_minted", {
        _queue_id: params.queue_id,
        _tx_hash: params.tx_hash,
        _block_number: params.block_number,
        _on_chain_token_id: params.on_chain_token_id,
        _contract_address: params.contract_address,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      if (res?.success) {
        toast.success("Đã đánh dấu mint thành công");
        qc.invalidateQueries({ queryKey: ["sbt-queue-admin"] });
        qc.invalidateQueries({ queryKey: ["sbt-queue-stats"] });
      } else toast.error(res?.error || "Lỗi");
    },
    onError: (e: any) => toast.error(e?.message),
  });
}
