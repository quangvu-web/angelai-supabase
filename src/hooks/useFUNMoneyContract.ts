import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import { useWeb3WalletContext as useWeb3Wallet } from "@/contexts/Web3WalletContext";
import {
  FUN_MONEY_ABI,
  FUN_MONEY_ADDRESSES,
  PPLP_ERROR_MESSAGES,
  LockedGrant,
} from "@/lib/funMoneyABI";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MintStatus {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
}

interface ContractInfo {
  name: string;
  owner: string;
  platformTreasury: string;
  funToken: string;
  userBps: number;
  platformBps: number;
}

export interface ContractDiagnostics {
  isContractValid: boolean;
  contractCodeExists: boolean;
  blockNumber: number | null;
  error: string | null;
}

function getEthereumProvider(): ethers.BrowserProvider | null {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  return null;
}

function extractErrorReason(error: any): string {
  const msg = error?.message || error?.reason || error?.shortMessage || "";
  for (const [pattern, message] of Object.entries(PPLP_ERROR_MESSAGES)) {
    if (msg.toLowerCase().includes(pattern.toLowerCase())) {
      return message;
    }
  }
  if (msg.includes("user rejected") || msg.includes("User denied")) {
    return "Người dùng từ chối giao dịch";
  }
  if (msg.includes("insufficient") || msg.includes("exceeds balance")) {
    return "Số dư không đủ để thực hiện giao dịch";
  }
  return msg || "Giao dịch thất bại";
}

export function useFUNMoneyContract() {
  const {
    isConnected,
    address,
    chainId,
    connect,
    disconnect,
    hasWallet,
    resetBSCNetwork,
    networkDiagnostics,
    error: walletError,
  } = useWeb3Wallet();
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [contractDiagnostics, setContractDiagnostics] = useState<ContractDiagnostics | null>(null);
  const [lockedGrants, setLockedGrants] = useState<LockedGrant[]>([]);
  const [mintStatus, setMintStatus] = useState<MintStatus>({
    isLoading: false,
    txHash: null,
    error: null,
  });

  const initializingRef = useRef(false);

  const getContractAddress = useCallback(() => {
    if (!chainId) return null;
    return FUN_MONEY_ADDRESSES[chainId] || null;
  }, [chainId]);

  const verifyContract = useCallback(
    async (provider: ethers.BrowserProvider, contractAddress: string): Promise<ContractDiagnostics> => {
      const diagnostics: ContractDiagnostics = {
        isContractValid: false,
        contractCodeExists: false,
        blockNumber: null,
        error: null,
      };
      try {
        const blockNumber = await provider.getBlockNumber();
        diagnostics.blockNumber = blockNumber;
        if (blockNumber < 10_000_000) {
          diagnostics.error = `Block number quá thấp (${blockNumber.toLocaleString()}). RPC có thể đang trỏ sai network.`;
          return diagnostics;
        }
        const code = await provider.getCode(contractAddress);
        diagnostics.contractCodeExists = code !== "0x" && code.length > 2;
        if (!diagnostics.contractCodeExists) {
          diagnostics.error = "Contract FUNMoneyMinter chưa được deploy tại địa chỉ này.";
          return diagnostics;
        }
        diagnostics.isContractValid = true;
        return diagnostics;
      } catch (error: any) {
        diagnostics.error = error.message || "Không thể xác minh contract";
        return diagnostics;
      }
    },
    []
  );

  // Initialize contract
  useEffect(() => {
    const initContract = async () => {
      if (initializingRef.current) return;
      initializingRef.current = true;

      const contractAddress = getContractAddress();
      const provider = getEthereumProvider();

      if (!contractAddress || !provider || !isConnected) {
        setContract(null);
        setSigner(null);
        setContractDiagnostics(null);
        initializingRef.current = false;
        return;
      }

      try {
        const diagnostics = await verifyContract(provider, contractAddress);
        setContractDiagnostics(diagnostics);
        if (!diagnostics.isContractValid) {
          setContract(null);
          setSigner(null);
          initializingRef.current = false;
          return;
        }

        const walletSigner = await provider.getSigner();
        setSigner(walletSigner);
        const contractInstance = new ethers.Contract(contractAddress, FUN_MONEY_ABI, walletSigner);
        setContract(contractInstance);

        // Fetch contract info
        try {
          const [owner, platformTreasury, funToken, userBps, platformBps] = await Promise.all([
            contractInstance.owner(),
            contractInstance.platformTreasury(),
            contractInstance.funToken(),
            contractInstance.USER_BPS(),
            contractInstance.PLATFORM_BPS(),
          ]);
          setContractInfo({
            name: "FUNMoneyMinter",
            owner,
            platformTreasury,
            funToken,
            userBps: Number(userBps),
            platformBps: Number(platformBps),
          });
        } catch (fetchErr) {
          console.warn("[FUNMoney] Auto-fetch after init failed:", fetchErr);
        }

        // Fetch locked grants
        try {
          const grants = await contractInstance.getLockedGrants(address);
          setLockedGrants(grants.map((g: any) => ({
            amount: g.amount,
            releaseTime: g.releaseTime,
            released: g.released,
          })));
        } catch {}
      } catch (error) {
        console.error("Failed to initialize FUNMoneyMinter contract:", error);
        setContract(null);
        setSigner(null);
      } finally {
        initializingRef.current = false;
      }
    };
    initContract();
  }, [isConnected, address, getContractAddress, verifyContract]);

  // Fetch contract info
  const fetchContractInfo = useCallback(async () => {
    if (!contract || !address) return null;
    if (contractDiagnostics && !contractDiagnostics.isContractValid) return null;

    try {
      const [owner, platformTreasury, funToken, userBps, platformBps] = await Promise.all([
        contract.owner(),
        contract.platformTreasury(),
        contract.funToken(),
        contract.USER_BPS(),
        contract.PLATFORM_BPS(),
      ]);
      const info: ContractInfo = {
        name: "FUNMoneyMinter",
        owner,
        platformTreasury,
        funToken,
        userBps: Number(userBps),
        platformBps: Number(platformBps),
      };
      setContractInfo(info);

      // Also refresh locked grants
      try {
        const grants = await contract.getLockedGrants(address);
        setLockedGrants(grants.map((g: any) => ({
          amount: g.amount,
          releaseTime: g.releaseTime,
          released: g.released,
        })));
      } catch {}

      return info;
    } catch (error) {
      console.error("Failed to fetch contract info:", error);
      return null;
    }
  }, [contract, address, contractDiagnostics]);

  // Release a locked grant
  const releaseLockedGrant = useCallback(
    async (index: number): Promise<string | null> => {
      if (!contract || !signer) {
        toast.error("Vui lòng kết nối ví trước");
        return null;
      }
      setMintStatus({ isLoading: true, txHash: null, error: null });
      try {
        toast.loading("Đang giải phóng grant...", { id: "release-grant" });
        const tx = await contract.releaseLockedGrant(index);
        const receipt = await tx.wait();
        const txHash = receipt.hash;
        setMintStatus({ isLoading: false, txHash, error: null });
        toast.success("Giải phóng grant thành công!", { id: "release-grant" });
        await fetchContractInfo();
        return txHash;
      } catch (error: any) {
        const errorMessage = extractErrorReason(error);
        setMintStatus({ isLoading: false, txHash: null, error: errorMessage });
        toast.error(errorMessage, { id: "release-grant" });
        return null;
      }
    },
    [contract, signer, fetchContractInfo]
  );

  // Preview split
  const previewSplit = useCallback(
    async (totalMint: bigint) => {
      if (!contract) return null;
      try {
        const [userShare, platformShare] = await contract.previewSplit(totalMint);
        return { userShare, platformShare };
      } catch {
        return null;
      }
    },
    [contract]
  );

  // Request backend to mint (calls pplp-authorize-mint edge function)
  const requestPPLPLock = useCallback(
    async (actionId: string): Promise<{ txHash: string } | null> => {
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        toast.error("Vui lòng kết nối ví MetaMask trước");
        return null;
      }
      if (address.startsWith("0x1234567890")) {
        toast.error("Địa chỉ ví không hợp lệ. Vui lòng kết nối ví thật.");
        return null;
      }

      setMintStatus({ isLoading: true, txHash: null, error: null });
      try {
        toast.loading("Đang tạo yêu cầu mint...", { id: "pplp-lock" });
        const { data, error } = await supabase.functions.invoke("pplp-authorize-mint", {
          body: { action_id: actionId, wallet_address: address },
        });
        if (error) {
          const errMsg = typeof error === 'object' ? JSON.stringify(error) : String(error);
          if (errMsg.includes('already minted') || errMsg.includes('already processed')) {
            toast.info("ℹ️ Action này đã được mint on-chain trước đó.", { id: "pplp-lock" });
            setMintStatus({ isLoading: false, txHash: null, error: null });
            return null;
          }
          throw error;
        }
        if (!data.success) throw new Error(data.error || "Authorization failed");

        if (data.tx_hash) {
          setMintStatus({ isLoading: false, txHash: data.tx_hash, error: null });
          toast.success("Mint thành công! Token đã được mint.", { id: "pplp-lock" });
          await fetchContractInfo();
          return { txHash: data.tx_hash };
        }

        toast.info("Yêu cầu đã được ký. Token sẽ được mint sớm.", { id: "pplp-lock" });
        setMintStatus({ isLoading: false, txHash: null, error: null });
        return null;
      } catch (error: any) {
        const errorMessage = error.message || "Không thể tạo yêu cầu mint";
        setMintStatus({ isLoading: false, txHash: null, error: errorMessage });
        toast.error(errorMessage, { id: "pplp-lock" });
        return null;
      }
    },
    [address, fetchContractInfo]
  );

  const executeMint = useCallback(
    async (actionId: string): Promise<string | null> => {
      const result = await requestPPLPLock(actionId);
      return result?.txHash || null;
    },
    [requestPPLPLock]
  );

  const isActionMinted = useCallback(
    async (actionId: string): Promise<boolean> => {
      try {
        const { data } = await supabase
          .from("pplp_mint_requests")
          .select("status, tx_hash")
          .eq("action_id", actionId)
          .maybeSingle();
        return data?.status === "minted" && !!data?.tx_hash;
      } catch {
        return false;
      }
    },
    []
  );

  return {
    // State
    isConnected,
    address,
    chainId,
    hasWallet,
    contract,
    contractInfo,
    contractDiagnostics,
    networkDiagnostics,
    walletError,
    mintStatus,
    lockedGrants,

    // Actions
    fetchContractInfo,
    releaseLockedGrant,
    previewSplit,
    requestPPLPLock,
    executeMint,
    isActionMinted,
    connect,
    disconnect,
    resetBSCNetwork,

    // Helpers
    getContractAddress,
  };
}
