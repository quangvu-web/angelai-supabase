# 🏗 FUN Ecosystem Core Architecture

## Digital Identity Bank + Light Score PPLP

**Version:** 1.0.0
**Date:** 2026-02-27
**Author:** Angel CTO
**Status:** Phase 1 - Active Development

---

## 📐 Architecture Overview

```
            ┌──────────────────────────┐
            │      User + Wallet       │  ← LAYER 1
            └────────────┬─────────────┘
                         ↓
            ┌──────────────────────────┐
            │   Digital Identity Bank  │  ← LAYER 1 (DID + SBT)
            └────────────┬─────────────┘
                         ↓
            ┌──────────────────────────┐
            │     Event Engine         │  ← LAYER 2
            └────────────┬─────────────┘
                         ↓
            ┌──────────────────────────┐
            │    Light Score Engine    │  ← LAYER 3 (PPLP Core)
            └────────────┬─────────────┘
                         ↓
            ┌──────────────────────────┐
            │ Reward & Governance      │  ← LAYER 4 + 6
            └──────────────────────────┘
```

---

## 🌐 LAYER 0 – Infrastructure Layer

| Component | Current (Phase 1) | Future (Phase 3) |
|-----------|-------------------|-------------------|
| Cloud | Lovable Cloud (Supabase) | AWS/GCP with K8s |
| CDN | Lovable CDN | CloudFront/Fastly |
| API Gateway | Supabase Edge Functions | Kong/AWS API Gateway |
| Monitoring | Console logs + Admin Dashboard | Prometheus + Grafana |
| Database | PostgreSQL (Supabase) | Distributed PostgreSQL |

**Design Goals:**
- Horizontal scaling via stateless Edge Functions
- Zero-downtime deploy via Lovable Cloud
- Service isolation via function-per-endpoint pattern

---

## 🧬 LAYER 1 – Identity Layer (Digital Identity Bank Core)

### Architecture Flow

```
User → Wallet (MetaMask / FUN Wallet) → DID Service → Soulbound Identity NFT → Identity Metadata Store
```

### Database Schema

#### `user_dids` - Decentralized Identity Records
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Unique per user |
| `did` | TEXT | `did:fun:0x...` format |
| `did_hash` | TEXT | SHA-256 hash for on-chain anchoring |
| `wallet_address` | TEXT | Primary bound wallet |
| `secondary_wallets` | TEXT[] | Optional additional wallets |
| `trust_seed` | TEXT | Cryptographic randomness |
| `status` | TEXT | active / suspended / revoked |
| `on_chain_anchor_hash` | TEXT | Transaction hash on BSC |

#### `soulbound_nfts` - Non-Transferable Identity Tokens
| Column | Type | Description |
|--------|------|-------------|
| `token_id` | BIGINT | On-chain NFT ID (null until minted) |
| `did_hash` | TEXT | Stored in NFT metadata |
| `trust_seed` | TEXT | Creation trust anchor |
| `mint_status` | TEXT | pending / minted / failed |
| `metadata_hash` | TEXT | Hash of off-chain metadata |

#### `identity_metadata` - Encrypted Off-chain Storage
| Column | Type | Description |
|--------|------|-------------|
| `data_type` | TEXT | profile / kyc / reputation / credentials |
| `encrypted_data` | TEXT | Encrypted payload |
| `data_hash` | TEXT | Hash pointer for on-chain anchoring |
| `version` | INTEGER | Versioned history |

#### `did_events` - Full Audit Trail
| Column | Type | Description |
|--------|------|-------------|
| `event_type` | TEXT | created / wallet_bound / sbt_minted / suspended / revoked |
| `event_data` | JSONB | Event-specific data |
| `on_chain_hash` | TEXT | Anchor transaction |

### Components

#### 1️⃣ Wallet Binding
- 1 Primary Wallet per DID
- Optional secondary wallets
- Anti-multi-account via `user_wallet_addresses` lock (existing)
- Fingerprint cross-reference with `deviceFingerprint.ts`

#### 2️⃣ DID Engine (`generate-did` Edge Function)
- Generates unique `did:fun:0x{hash}` identifier
- Hash = SHA-256(user_id + email + wallet + trust_seed + timestamp)
- 1 DID = 1 Light Root (immutable binding)

#### 3️⃣ Soulbound NFT (Phase 1: Database Record)
- Non-transferable by design
- Stores: DID hash, creation timestamp, trust seed
- Phase 2: Deploy SBT smart contract on BSC
- Phase 3: Cross-chain SBT bridging

#### 4️⃣ Identity Metadata Store
- Encrypted off-chain storage with versioning
- On-chain hash pointers for integrity verification
- KYC module slot (future Phase 3)

---

## ⚙️ LAYER 2 – Activity & Event Engine

### Event Flow
```
Platform Events → Event Validator → Event Normalizer → Event Ledger (pplp_actions)
```

### Event Types (40+ standardized)
- Learn & Earn: `ask_question`, `quality_question`
- Give & Gain: `tip_sent`, `tip_received`, `donate`
- Governance: `governance_vote` (future)
- Community: `community_post`, `community_comment`, `community_share`
- Content: `journal_entry`, `vision_board`, `knowledge_upload`
- Referral: `referral_signup` (weighted)
- Charity: `charity_contribution`

### Validation Requirements
Every event MUST have:
- ✅ Verified DID (user_dids.status = 'active')
- ✅ Verified Wallet (user_wallet_addresses binding)
- ✅ Context Validation (metadata enrichment)
- ✅ Anti-bot filter (device fingerprint + rate limit)

### Current Implementation
- `pplp-submit-action` Edge Function handles event ingestion
- `pplp-score-action` Edge Function processes scoring
- Anti-sybil checks via `pplp-detect-fraud`

---

## 💡 LAYER 3 – Light Score Engine (PPLP Core)

### Scoring Flow
```
Event Ledger → Scoring Algorithm → Contribution Weighting → Score Snapshot Generator → On-chain Hash Anchor
```

### Light Score Formula

```
Light Score = Σ (Verified Contribution × Weight × Time Decay Factor × Trust Multiplier)

Where:
  Contribution = S(0.25) + T(0.20) + H(0.20) + C(0.20) + U(0.15)
  S = Service to Life
  T = Truth/Transparency
  H = Healing/Compassion
  C = Contribution Durability
  U = Unity Alignment
```

### Components

#### 1️⃣ Weight Engine
- Platform-specific coefficients (Charity > Content spam)
- Long-term contribution multiplier via `pplp_action_caps`
- Quality scoring: Q multiplier [0.5, 3.0]

#### 2️⃣ Trust Multiplier
Based on:
- Account age (via `get_account_age_gate`)
- User tier (0-4 via `pplp_user_tiers`)
- Governance participation (future)
- Community validation (PoPL score)

#### 3️⃣ Time Decay (Phase 2)
- Old contributions lose partial weight
- Encourages continuous value creation
- Configurable decay curve per action type

#### 4️⃣ Score Snapshots (`light_score_snapshots`)
- Periodic snapshots (daily/weekly/monthly)
- SHA-256 hash of all snapshot data
- Hash stored on-chain via BSC transaction
- Prevents tampering and provides audit trail

---

## 💰 LAYER 4 – Reward & Token Engine

### Reward Flow
```
Light Score Snapshot → Reward Allocator → FUN Money Mint Logic → Distribution Smart Contract
```

### Current Model (Phase 1)
```
User Reward = BaseReward × Q × I × K × TierMultiplier × DiminishingFactor
```

### Future Model (Phase 2+)
```
User Reward = (User Light Score / Total Ecosystem Light Score) × Reward Pool
```
- **No fixed rewards** - always proportional
- Reward pool replenished by ecosystem activity
- On-chain distribution via FUN Money contract (0x39A1b...)

### Distribution Split
| Recipient | Percentage |
|-----------|-----------|
| User | 70% |
| Platform Operations | 15% |
| Genesis Fund | 10% |
| Partner Fund | 5% |

---

## 🛡 LAYER 5 – Protection & Anti-Manipulation

### Anti-Abuse Framework (Active)

| Layer | Implementation | Status |
|-------|---------------|--------|
| Sybil Detection | `pplp-detect-fraud` + `fraud-scanner` | ✅ Active |
| Device Fingerprint | `deviceFingerprint.ts` (canvas/WebGL/UA) | ✅ Active |
| Wallet Lock | Permanent binding after first connect | ✅ Active |
| Rate Limiting | Cooldown 30s + daily caps per tier | ✅ Active |
| Content Similarity | `detect_cross_account_content_similarity()` | ✅ Active |
| Wallet Clustering | `detect_wallet_clusters()` + `scan-collector-wallet` | ✅ Active |
| Timing Analysis | `detect_coordinated_timing()` | ✅ Active |
| AI Behavior | Velocity check + pattern matching | ✅ Active |
| Score Freezing | Auto-freeze if fraud_risk > 50 | ✅ Active |

### Phase 2 Additions
- Behavior similarity clustering (ML-based)
- Governance weight locking during disputes
- Cross-platform anomaly detection

---

## 🏛 LAYER 6 – Governance Layer (Phase 2+)

### Flow
```
Light Score → Governance Weight → Proposal Engine → Voting Smart Contract
```

### Design
- Higher Light Score = Higher vote weight
- Quadratic voting model to prevent dominance
- Proposal eligibility thresholds
- Time-locked governance tokens

---

## 🌎 LAYER 7 – Cross-Platform Integration

### API Endpoints
| API | Purpose | Status |
|-----|---------|--------|
| DIB API | `generate-did`, DID lookup | ✅ Phase 1 |
| Event API | `pplp-submit-action` | ✅ Active |
| Light Score API | `pplp-score-action`, snapshots | ✅ Active |
| Reward API | `pplp-authorize-mint`, distribution | ✅ Active |

### Connected Platforms
- ✅ FUN Profile (angel.fun.rich)
- 🔜 FUN Play (play.fun.rich)
- 🔜 FUN Academy (academy.fun.rich)
- 🔜 FUN Charity (charity.fun.rich)
- 🔜 FUN Market
- ✅ Angel A.I.
- 🔜 COSMIC GAME

---

## 🔐 Critical Design Rules

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | 1 DID = 1 Soulbound NFT | UNIQUE constraint on user_id |
| 2 | 1 Soulbound NFT = 1 Light Root | Foreign key did_id |
| 3 | No Light Score without verified event | pplp_actions.status check |
| 4 | No Reward without snapshot hash | pplp_scores.decision check |
| 5 | All important states anchored on-chain | on_chain_anchor_hash fields |
| 6 | No manual score editing | RLS + service_role only |
| 7 | Wallet permanently locked | user_wallet_addresses immutable |

---

## 🚀 Scalability Roadmap

### Phase 1 (Current) ✅
- Centralized scoring via Edge Functions
- On-chain hash anchoring for snapshots
- Database-level SBT records
- Anti-sybil 7-layer protection

### Phase 2 (Q3-Q4 2026)
- Soulbound NFT smart contract deployment on BSC
- Hybrid scoring (partial on-chain)
- Time decay factor implementation
- Proportional reward model
- Governance voting contract

### Phase 3 (2027)
- Full modular smart contract scoring
- Cross-chain DID bridging (BSC ↔ Ethereum ↔ Polygon)
- Decentralized identity verification (ZK-proofs)
- Multi-platform DID federation
- Community-governed parameter updates

---

## 📊 Data Flow Summary

```
User Action
   ↓
[Anti-bot + Fingerprint Validation]
   ↓
Event Engine (pplp-submit-action)
   ↓
Light Score Engine (pplp-score-action)
   ↓
Score Snapshot + Hash
   ↓
Reward Engine (pplp-authorize-mint)
   ↓
Token Distribution (FUN Money on-chain)
   ↓
Identity anchors everything via DID
```

---

*"DIB là tầng không được phép sai. Light Score là tầng dễ bị game nhất. Phải thiết kế anti-abuse ngay từ ngày đầu."*
— Angel CTO
