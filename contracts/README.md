# FUN Money Smart Contracts — v1.2.1 FINAL

## Overview

This directory contains the Solidity smart contract for the FUN Ecosystem's token economy.

**Tag**: `FUN-MONEY-v1.2.1-final`  
**Status**: ✅ Audit-grade, FROZEN, ready for external audit & mainnet

## Contract: FUNMoneyProductionV1_2_1

Standalone BEP-20/ERC-20 token with integrated PPLP Vesting Engine.

### Features

- **3-Step Vesting Flow**: Lock → Activate → Claim
- **EIP-712 Multi-Attester Signatures** for secure locking
- **Action Registry** (Master Charter 5D) with governance
- **Epoch-based Rate Limiting** (global mint cap)
- **guardianGov** governance with limited, safe powers
- **Community Pool** for excess recycling
- **Transparency Getters** for on-chain auditability

### Alignment (Hiến Chương 5D)

- Code = Law
- Money = Flow of Light
- No extraction, no control of user flow
- Errors return to Community

## Vesting Flow

```
lockWithPPLP()  →  activate()  →  claim()
   (Backend)       (User)          (User)
   ↓                ↓               ↓
  Locked          Activated       Spendable
```

1. **lockWithPPLP()** — Backend (Treasury) locks tokens with attester signatures
2. **activate()** — User activates locked tokens (requires `!pauseTransitions`)
3. **claim()** — User claims activated tokens to their wallet

## Constructor

```solidity
constructor(
    address _gov,           // Guardian Governance address
    address _community,     // Community Pool address
    address[] memory attesters,  // Initial attester addresses
    uint256 threshold       // Min signatures required
)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `_gov` | address | Guardian Governance (immutable) |
| `_community` | address | Community Pool (immutable) |
| `attesters` | address[] | Initial attester list |
| `threshold` | uint256 | Min attester signatures for lockWithPPLP |

## EIP-712 Domain

```solidity
EIP712Domain {
    name: "FUN Money",
    version: "1.2.1",
    chainId: 97,  // BSC Testnet (56 for mainnet)
    verifyingContract: <contract_address>
}
```

## PureLoveProof Typehash

```solidity
PureLoveProof(
    address user,
    bytes32 actionHash,
    uint256 amount,
    bytes32 evidenceHash,
    uint256 nonce
)
```

## Governance (guardianGov only)

| Function | Description |
|----------|-------------|
| `govRegisterAction(name, version)` | Register new action type |
| `govDeprecateAction(name, newVersion)` | Deprecate an action |
| `govSetAttester(attester, allowed)` | Add/remove attester |
| `govSetAttesterThreshold(threshold)` | Update signature threshold |
| `govPauseTransitions(paused)` | Pause/unpause Lock & Activate |
| `govRecycleExcessToCommunity(amount)` | Send excess to community pool |

## Events

| Event | Description |
|-------|-------------|
| `PureLoveAccepted` | Tokens locked via PPLP |
| `ActionRegistered` | New action type registered |
| `ActionDeprecated` | Action type deprecated |
| `AttesterUpdated` | Attester added/removed |
| `AttesterThresholdUpdated` | Threshold changed |
| `TransitionsPaused` | Transitions paused/unpaused |
| `ExcessRecycled` | Excess sent to community |

## Deployment

### Compile

```bash
npx hardhat compile
```

### Deploy to BSC Testnet

```bash
npx hardhat run scripts/deploy.js --network bscTestnet
```

### Deploy to BSC Mainnet

```bash
npx hardhat run scripts/deploy.js --network bscMainnet
```

## Current Deployment

| Network | Address |
|---------|---------|
| BSC Testnet | `0x39A1b047D5d143f8874888cfa1d30Fb2AE6F0CD6` |
| BSC Mainnet | To be deployed after audit |

## Governance Setup

### Registered Attesters

| # | Wallet | Role | Status |
|---|--------|------|--------|
| 1 | `0x02D5578173bd0DB25462BB32A254Cd4b2E6D9a0D` | Mint Signer (ký lockWithPPLP on-chain) | ✅ Active |

> ⚠️ **Attester wallet ĐỘC LẬP với Treasury wallet** (`0x416336c3b7ACAe89F47EAD2707412f20DA159ac8`).
> Treasury chỉ dùng để chi trả thưởng (Rút thưởng, Lì xì) — KHÔNG liên quan đến mint on-chain.

### Attester Threshold

- **Current**: `attesterThreshold = 1` (1-sig) — đủ 1 chữ ký để `lockWithPPLP()`
- **Future**: `attesterThreshold = 3` (3-sig) — sẽ áp dụng khi bổ sung thêm attester keys

### Registered Actions

| Action | Version | Description |
|--------|---------|-------------|
| `FUN_REWARD` | 1 | Unified action cho tất cả reward types (via `govRegisterAction`) |

## Security Considerations

1. **Multi-Attester**: Requires threshold signatures to lock tokens
2. **Nonce Protection**: Prevents signature replay attacks
3. **Epoch Rate Limiting**: Global mint cap per epoch
4. **Action Registry**: Only registered actions can lock tokens
5. **Pause Control**: Emergency stop for transitions
6. **Community Pool**: Excess recycled, never extracted

## Audit Status

- [x] Internal review
- [x] Code frozen (v1.2.1-final)
- [ ] External audit (planned)

## License

MIT
