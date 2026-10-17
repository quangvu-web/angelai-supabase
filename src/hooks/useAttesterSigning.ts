/**
 * useAttesterSigning — Reads pending/signed mint requests from pplp_mint_requests
 * and allows GOV attesters to sign them (add their group to multisig_completed_groups).
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWeb3WalletContext } from "@/contexts/Web3WalletContext";
import { useSavedWalletAddress } from "@/hooks/useSavedWalletAddress";
import { detectWallets, getActiveProvider } from "@/lib/walletProviders";
import { toast } from "sonner";
import {
  getAttesterGroup,
  getAttesterName,
  GovGroupName,
} from "@/lib/govGroups";

const REQUIRED_GROUPS = ["will", "wisdom", "love"] as const;
const REQUIRED_GROUP_SET = new Set<string>(REQUIRED_GROUPS);

const getWalletProviders = () => {
  if (typeof window === "undefined") return [];
  const win = window as any;
  const providers: any[] = [];
  const seen = new Set<any>();
  const add = (provider: any) => {
    if (provider?.request && !seen.has(provider)) {
      seen.add(provider);
      providers.push(provider);
    }
  };

  add(getActiveProvider());
  detectWallets().forEach((wallet) => add(wallet.provider));
  add(win.ethereum);
  win.ethereum?.providers?.forEach?.(add);

  return providers;
};

const buildAttesterSigningMessage = ({
  group,
  signerAddress,
  requestIds,
  timestamp,
}: {
  group: GovGroupName;
  signerAddress: string;
  requestIds: string[];
  timestamp: number;
}) => [
  "FUN Attester Signature",
  `Group: ${group}`,
  `Signer: ${signerAddress.toLowerCase()}`,
  `Requests: ${[...requestIds].sort().join(",")}`,
  `Timestamp: ${timestamp}`,
].join("\n");

type MultisigSignature = {
  signer_address?: string;
  signer_name?: string;
  signed_at?: string;
};

const normalizeGroups = (groups: unknown): string[] =>
  Array.isArray(groups)
    ? groups.map((g) => String(g).toLowerCase()).filter((g) => REQUIRED_GROUP_SET.has(g))
    : [];

export interface MultisigMintRequest {
  id: string;
  action_id: string;
  actor_id: string;
  recipient_address: string;
  amount: number;
  amount_wei: string | null;
  action_hash: string;
  evidence_hash: string;
  nonce: number;
  status: string;
  multisig_signatures: Record<string, MultisigSignature>;
  multisig_completed_groups: string[];
  multisig_required_groups: string[];
  platform_id: string;
  created_at: string;
  tx_hash: string | null;
  actor_display_name?: string | null;
  actor_avatar_url?: string | null;
}

async function fetchRequests(): Promise<MultisigMintRequest[]> {
  try {
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      "attester-sign-mint-requests",
      { body: { action: "list" } }
    );

    if (functionError) {
      console.warn("[AttesterPanel] Edge function error, falling back to client query:", functionError.message);
    } else if (Array.isArray(functionData?.requests)) {
      console.info("[AttesterPanel] Loaded", functionData.requests.length, "requests via edge function");
      return functionData.requests as MultisigMintRequest[];
    } else {
      console.warn("[AttesterPanel] Edge function returned unexpected shape, falling back");
    }
  } catch (err) {
    console.warn("[AttesterPanel] Edge function call failed, falling back:", err);
  }

  // Fetch mint requests that are waiting for GOV 3/3 signatures.
  const { data, error } = await supabase
    .from("pplp_mint_requests")
    .select("*")
    .in("status", ["pending", "pending_sig", "signing", "signed"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Fetch actor profiles for display names
  const actorIds = [...new Set(data.map((r) => r.actor_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name, avatar_url")
    .in("user_id", actorIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  return data.map((r) => {
    const requiredGroups = normalizeGroups(r.multisig_required_groups);
    return {
    id: r.id,
    action_id: r.action_id ?? "",
    actor_id: r.actor_id,
    recipient_address: r.recipient_address ?? "",
    amount: Number(r.amount ?? 0),
    amount_wei: r.amount_wei,
    action_hash: r.action_hash ?? "",
    evidence_hash: r.evidence_hash ?? "",
    nonce: Number(r.nonce ?? 0),
    status: r.status,
    multisig_signatures: (r.multisig_signatures as Record<string, MultisigSignature>) ?? {},
    multisig_completed_groups: normalizeGroups(r.multisig_completed_groups),
    multisig_required_groups: requiredGroups.length > 0
      ? requiredGroups
      : [...REQUIRED_GROUPS],
    platform_id: r.platform_id ?? "angel_ai",
    created_at: r.created_at,
    tx_hash: r.tx_hash,
    actor_display_name: profileMap.get(r.actor_id)?.display_name ?? null,
    actor_avatar_url: profileMap.get(r.actor_id)?.avatar_url ?? null,
    };
  });
}

export function useAttesterSigning() {
  const { isConnected, address } = useWeb3WalletContext();
  const { savedAddress } = useSavedWalletAddress();
  const queryClient = useQueryClient();
  const [isSigning, setIsSigning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [detectedWalletAddress, setDetectedWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    const readConnectedAccount = async () => {
      const accounts: string[] = [];
      try {
        for (const provider of getWalletProviders()) {
          try {
            const providerAccounts = (await provider.request({ method: "eth_accounts" })) as string[];
            providerAccounts?.forEach((account) => {
              if (account && !accounts.some((a) => a.toLowerCase() === account.toLowerCase())) {
                accounts.push(account);
              }
            });
          } catch {
            // Ignore a single wallet provider failure; another provider may hold the GOV account.
          }
        }

        if (!cancelled) {
          const govAccount = accounts.find((account) => !!getAttesterGroup(account));
          setDetectedWalletAddress(govAccount ?? accounts[0] ?? null);
        }
      } catch {
        if (!cancelled) setDetectedWalletAddress(null);
      }
    };

    readConnectedAccount();
    const handleAccountsChanged = () => {
      readConnectedAccount();
    };
    const providers = getWalletProviders();
    providers.forEach((provider) => provider.on?.("accountsChanged", handleAccountsChanged));

    return () => {
      cancelled = true;
      providers.forEach((provider) => provider.removeListener?.("accountsChanged", handleAccountsChanged));
    };
  }, []);

  const connectedAddresses = [address, detectedWalletAddress].filter(Boolean) as string[];
  const liveGovAddress = connectedAddresses.find((walletAddress) => !!getAttesterGroup(walletAddress)) ?? null;
  const liveAddress = liveGovAddress || address || detectedWalletAddress;
  const connectedAttesterGroup = liveGovAddress ? getAttesterGroup(liveGovAddress) : null;
  const savedAttesterGroup = savedAddress ? getAttesterGroup(savedAddress) : null;
  const effectiveAddress = connectedAttesterGroup
    ? liveGovAddress
    : savedAttesterGroup
      ? savedAddress
      : liveAddress || savedAddress || null;
  const signingAddress = liveGovAddress || liveAddress || null;
  const detectedGroup = effectiveAddress ? getAttesterGroup(effectiveAddress) : null;
  const myGroup: GovGroupName | null = detectedGroup;
  const myName: string | null = effectiveAddress ? getAttesterName(effectiveAddress) : null;
  const isAttester = !!detectedGroup;
  // Allow signing if:
  // 1. Live wallet matches the group (best case), OR
  // 2. Saved wallet matches the group AND wallet providers exist (MetaMask installed)
  //    → signRequestIds() will handle eth_requestAccounts internally
  const hasWalletProviders = typeof window !== "undefined" && getWalletProviders().length > 0;
  const liveCanSign = !!signingAddress && !!myGroup && getAttesterGroup(signingAddress) === myGroup;
  const savedCanSign = !!savedAttesterGroup && savedAttesterGroup === myGroup && hasWalletProviders;
  const canSign = liveCanSign || savedCanSign;

  const { data: allRequests = [], isLoading, error } = useQuery({
    queryKey: ["attester-mint-requests", effectiveAddress?.toLowerCase() ?? "no-wallet", myGroup ?? "no-group"],
    queryFn: fetchRequests,
    enabled: true,
    refetchInterval: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Split into pending (needs my group's signature) and signed (already has it)
  const pendingRequests = useMemo(
    () =>
      allRequests.filter(
        (r) => {
          if (!myGroup) return false;
          const required = normalizeGroups(r.multisig_required_groups);
          const requiredGroups = required.length > 0 ? required : [...REQUIRED_GROUPS];
          const completed = normalizeGroups(r.multisig_completed_groups);
          return requiredGroups.includes(myGroup) && !completed.includes(myGroup);
        }
      ),
    [allRequests, myGroup]
  );

  const signedRequests = useMemo(
    () =>
      allRequests.filter(
        (r) => myGroup && normalizeGroups(r.multisig_completed_groups).includes(myGroup)
      ),
    [allRequests, myGroup]
  );

  const signRequestIds = useCallback(
    async (requestIds: string[]) => {
      if (!myGroup) {
        toast.error("Vui lòng kết nối đúng ví GOV Attester để ký");
        return 0;
      }

      const providers = getWalletProviders();
      let activeSigningAddress = signingAddress && getAttesterGroup(signingAddress) === myGroup
        ? signingAddress
        : null;
      let signingProvider: any = null;

      const scanProvider = async (provider: any, method: "eth_accounts" | "eth_requestAccounts") => {
        const accounts = (await provider.request({ method })) as string[];
        const groupAccount = accounts?.find((account) => getAttesterGroup(account) === myGroup) ?? null;
        if (groupAccount) {
          activeSigningAddress = groupAccount;
          signingProvider = provider;
          setDetectedWalletAddress(groupAccount);
          return true;
        }
        return false;
      };

      for (const provider of providers) {
        try {
          if (await scanProvider(provider, "eth_accounts")) break;
        } catch {
          // Continue to the next provider.
        }
      }

      if (!activeSigningAddress) {
        for (const provider of providers) {
          try {
            if (await scanProvider(provider, "eth_requestAccounts")) break;
          } catch {
            // Continue to the next provider.
          }
        }
      }

      if (!activeSigningAddress || !signingProvider?.request) {
        toast.error("Không tìm thấy đúng ví GOV. Vui lòng mở MetaMask và chọn ví GOV Thu Trang.");
        return 0;
      }

      const timestamp = Date.now();
      const message = buildAttesterSigningMessage({
        group: myGroup,
        signerAddress: activeSigningAddress,
        requestIds,
        timestamp,
      });

      const signature = await signingProvider.request({
        method: "personal_sign",
        params: [message, activeSigningAddress],
      });

      const { data, error } = await supabase.functions.invoke("attester-sign-mint-requests", {
        body: {
          request_ids: requestIds,
          group: myGroup,
          signer_address: activeSigningAddress,
          signature,
          timestamp,
        },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message || "Không ký được lệnh");
      await queryClient.invalidateQueries({ queryKey: ["attester-mint-requests"] });
      return Number(data?.signed_count ?? 0);
    },
    [myGroup, signingAddress, queryClient]
  );

  const signRequest = useCallback(
    async (request: MultisigMintRequest) => {
      setIsSigning(true);
      try {
        const signedCount = await signRequestIds([request.id]);
        if (signedCount > 0) toast.success(`Đã ký xác nhận (${myGroup?.toUpperCase()})`);
        return signedCount > 0;
      } catch (err: unknown) {
        toast.error("Lỗi ký: " + (err instanceof Error ? err.message : "Unknown"));
        return false;
      } finally {
        setIsSigning(false);
      }
    },
    [myGroup, signRequestIds]
  );

  const signBatchRequests = useCallback(
    async (requests?: MultisigMintRequest[]) => {
      const toSign = requests ?? pendingRequests;
      if (toSign.length === 0) return;

      setIsSigning(true);
      setBatchProgress({ current: 1, total: toSign.length });
      try {
        const success = await signRequestIds(toSign.map((request) => request.id));
        toast.success(`Đã ký ${success}/${toSign.length} yêu cầu`);
      } catch (err: unknown) {
        toast.error("Lỗi ký hàng loạt: " + (err instanceof Error ? err.message : "Unknown"));
      } finally {
        setBatchProgress(null);
        setIsSigning(false);
      }
    },
    [pendingRequests, signRequestIds]
  );

  const refreshRequests = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["attester-mint-requests"] });
    await queryClient.refetchQueries({ queryKey: ["attester-mint-requests"], type: "active" });
  }, [queryClient]);

  const debugInfo = {
    web3ContextAddress: address ?? null,
    web3ContextConnected: isConnected,
    savedAddress: savedAddress ?? null,
    savedAttesterGroup: savedAttesterGroup ?? null,
    detectedWalletAddress,
    liveGovAddress,
    connectedAttesterGroup: connectedAttesterGroup ?? null,
    effectiveAddress: effectiveAddress ?? null,
    signingAddress: signingAddress ?? null,
    detectedGroup: detectedGroup ?? null,
    providersFound: typeof window !== "undefined" ? getWalletProviders().length : 0,
  };

  return {
    isAttester,
    myGroup,
    myName,
    isConnected: isConnected || !!detectedWalletAddress,
    effectiveAddress,
    address: signingAddress,
    canSign,
    pendingRequests,
    signedRequests,
    allRequests,
    isLoading,
    error,
    isSigning,
    batchProgress,
    signRequest,
    signBatchRequests,
    refreshRequests,
    debugInfo,
  };
}
