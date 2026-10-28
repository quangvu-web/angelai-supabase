/**
 * PPLP EIP-712 Typed Data Signing — LEGACY
 * 
 * This module was used for EIP-712 structured data signing with the old
 * FUNMoneyProductionV1_2_1 contract (attester multisig model).
 * 
 * The new FUNMoneyMinter contract uses authorizedMinters instead of EIP-712
 * attester signatures. This file is kept for backward compatibility but
 * the signing functions are no longer needed for new mints.
 * 
 * New flow: Backend wallet (authorizedMinter) calls mintValidatedAction() directly.
 */

// ============================================
// LEGACY EIP-712 DOMAIN & TYPES (kept for reference)
// ============================================

export const PPLP_DOMAIN = {
  name: 'FUN Money',
  version: '1.2.1',
  chainId: 97,
  verifyingContract: '0x39A1b047D5d143f8874888cfa1d30Fb2AE6F0CD6', // Legacy contract
};

export const MINT_REQUEST_TYPES = {
  MintRequest: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'actionId', type: 'bytes32' },
    { name: 'evidenceHash', type: 'bytes32' },
    { name: 'policyVersion', type: 'uint32' },
    { name: 'validAfter', type: 'uint64' },
    { name: 'validBefore', type: 'uint64' },
    { name: 'nonce', type: 'uint256' },
  ],
};

// ============================================
// INTERFACES (still used by edge functions)
// ============================================

export interface MintRequestPayload {
  to: string;
  amount: bigint;
  actionId: string;
  evidenceHash: string;
  policyVersion: number;
  validAfter: number;
  validBefore: number;
  nonce: bigint;
}

export interface SignedMintRequest extends MintRequestPayload {
  signature: string;
  signer: string;
}

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

// ============================================
// HASH UTILITIES
// ============================================

export function uuidToBytes32(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  return '0x' + hex.padStart(64, '0');
}

// ============================================
// PAYLOAD BUILDERS (used by pplp-authorize-mint)
// ============================================

export function createMintPayload(params: {
  recipientAddress: string;
  amount: number;
  actionId: string;
  evidenceHash: string;
  policyVersion: number;
  nonce: bigint | number | string;
  validityHours?: number;
}): MintRequestPayload {
  const now = Math.floor(Date.now() / 1000);
  const validitySeconds = (params.validityHours || 24) * 3600;
  const validAfter = Math.max(0, now - 60);
  const WEI = 10n ** 18n;
  
  let evidenceHash = params.evidenceHash;
  if (!evidenceHash || evidenceHash === '0x' || evidenceHash.length < 10) {
    evidenceHash = '0x' + '0'.repeat(64);
  } else if (!evidenceHash.startsWith('0x')) {
    evidenceHash = '0x' + evidenceHash;
  }
  const hexPart = evidenceHash.slice(2);
  evidenceHash = '0x' + hexPart.padStart(64, '0');
  
  const normalizedNonce = typeof params.nonce === 'bigint' 
    ? params.nonce 
    : BigInt(params.nonce);
  
  return {
    to: params.recipientAddress,
    amount: BigInt(params.amount) * WEI,
    actionId: uuidToBytes32(params.actionId),
    evidenceHash,
    policyVersion: params.policyVersion,
    validAfter,
    validBefore: now + validitySeconds,
    nonce: normalizedNonce,
  };
}

export function serializeSignedRequest(request: SignedMintRequest): Record<string, string> {
  return {
    to: request.to,
    amount: request.amount.toString(),
    actionId: request.actionId,
    evidenceHash: request.evidenceHash,
    policyVersion: request.policyVersion.toString(),
    validAfter: request.validAfter.toString(),
    validBefore: request.validBefore.toString(),
    nonce: request.nonce.toString(),
    signature: request.signature,
    signer: request.signer,
  };
}

// ============================================
// VALIDATION
// ============================================

export function isMintRequestValid(request: MintRequestPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= request.validAfter && now < request.validBefore;
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}
