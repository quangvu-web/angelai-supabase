/**
 * FUN Money Contract ABI (FUNMoneyMinter)
 * 
 * Simplified authorized-minter model replacing EIP-712 multisig.
 * 99/1 split enforced on-chain (USER_BPS=9900, PLATFORM_BPS=100).
 * Flow: mintValidatedAction() or mintValidatedActionLocked() → releaseLockedGrant()
 * 
 * Contract: TODO — deploy FUNMoneyMinter and update address
 */

export const FUN_MONEY_ABI = [
  // ============================================
  // ERC-20 STANDARD (on the FUN token, not the minter)
  // ============================================
  // Note: balanceOf/transfer etc. are on the FUN token contract.
  // The minter calls funToken.mint() internally.

  // ============================================
  // MINTER — CORE FUNCTIONS
  // ============================================

  // Instant mint: 99% to user, 1% to platform treasury
  "function mintValidatedAction(bytes32 actionId, address user, uint256 totalMint, bytes32 validationDigest)",

  // Locked mint: same split but user portion goes to LockedGrant
  "function mintValidatedActionLocked(bytes32 actionId, address user, uint256 totalMint, bytes32 validationDigest, uint256 lockDuration)",

  // Release a locked grant (only beneficiary, after lock expires)
  "function releaseLockedGrant(uint256 index)",

  // ============================================
  // READ STATE
  // ============================================

  // Check if an actionId was already processed (replay protection)
  "function processedActionIds(bytes32) view returns (bool)",

  // Check if an address is an authorized minter
  "function authorizedMinters(address) view returns (bool)",

  // Get locked grants for a user
  "function getLockedGrants(address user) view returns (tuple(uint256 amount, uint256 releaseTime, bool released)[])",

  // Preview the 99/1 split for a given total
  "function previewSplit(uint256 totalMint) view returns (uint256 userShare, uint256 platformShare)",

  // Contract owner
  "function owner() view returns (address)",

  // Platform treasury address
  "function platformTreasury() view returns (address)",

  // FUN token address
  "function funToken() view returns (address)",

  // BPS constants
  "function USER_BPS() view returns (uint256)",
  "function PLATFORM_BPS() view returns (uint256)",

  // ============================================
  // OWNER-ONLY ADMIN
  // ============================================
  "function setAuthorizedMinter(address minter, bool authorized)",
  "function setPlatformTreasury(address newTreasury)",

  // ============================================
  // EVENTS
  // ============================================
  "event ActionMinted(bytes32 indexed actionId, address indexed user, uint256 userAmount, uint256 platformAmount)",
  "event GrantLocked(bytes32 indexed actionId, address indexed user, uint256 amount, uint256 releaseTime)",
  "event GrantReleased(address indexed user, uint256 index, uint256 amount)",
  "event MinterUpdated(address indexed minter, bool authorized)",
  "event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)",
] as const;

// Contract addresses per network
// TODO: Deploy FUNMoneyMinter and update this address
export const FUN_MONEY_ADDRESSES: Record<number, string> = {
  56: "", // BSC Mainnet — not deployed yet
  97: "", // BSC Testnet — TODO: deploy FUNMoneyMinter
};

// Legacy contract address (FUNMoneyProductionV1_2_1) — kept for reference
export const LEGACY_CONTRACT_ADDRESS = "0x39A1b047D5d143f8874888cfa1d30Fb2AE6F0CD6";

// ============================================
// INTERFACES
// ============================================

export interface LockedGrant {
  amount: bigint;
  releaseTime: bigint;
  released: boolean;
}

export interface MintSplit {
  userShare: bigint;
  platformShare: bigint;
}

// Error messages
export const PPLP_ERROR_MESSAGES: Record<string, string> = {
  "already processed": "Action này đã được mint trước đó.",
  "not authorized": "Ví này chưa được ủy quyền làm minter.",
  "not yet releasable": "Grant chưa hết thời gian khóa.",
  "already released": "Grant đã được giải phóng trước đó.",
  "invalid index": "Index grant không hợp lệ.",
  "only beneficiary": "Chỉ người thụ hưởng mới có thể giải phóng grant.",
};

// Legacy exports for backward compatibility
export interface UserAllocation {
  locked: bigint;
  activated: bigint;
  claimable: bigint;
}

export interface MintRequest {
  to: string;
  amount: bigint;
  actionId: string;
  evidenceHash: string;
  policyVersion: number;
  validAfter: number;
  validBefore: number;
  nonce: bigint;
}

export interface SignedMintRequest extends MintRequest {
  signature: string;
  signer: string;
}

export const MINT_ERROR_MESSAGES = PPLP_ERROR_MESSAGES;
