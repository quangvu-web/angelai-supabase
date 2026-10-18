# Identity + Trust Layer — Architecture Spec v1.0

> Nguồn chân lý cho DID, SoulboundNFT (SBT), DIB và Trust Engine của FUN Ecosystem.
> Mọi thay đổi code (off-chain DB, edge function, smart contract, UI) liên quan tới identity/trust phải bám theo tài liệu này.

---

## 0. Triết lý cốt lõi

1. **DID = danh tính tự sở hữu** — không bị khóa vào một NFT, một ví, một app.
2. **SBT = dấu ấn đóng góp** — bằng chứng on-chain, không chuyển nhượng, có thể thu hồi (kèm lý do).
3. **DIB = ngân hàng danh tính số** — kho hash + checkpoint, không lưu dữ liệu thô lên chain.
4. **Light Score = kết quả động** — có thể evolve, không khóa cứng công thức cuối cùng on-chain.
5. **AI hỗ trợ, không phán xét** — AI phân tích & đề xuất rủi ro; con người + governance giữ quyền cuối.
6. **Reward hook = cổng nối** — identity contract chỉ "mở khóa" quyền mint/claim, không tự phát tiền.

---

## 1. DID Model

### 1.1 Format

```
did:fun:<chainId>:<wallet>
```

- `chainId` cố định theo mạng deploy (97 testnet, 56 mainnet).
- `wallet` lowercase hex 20 bytes.
- Off-chain `user_dids.did` phải khớp on-chain `FunDIDRegistry.walletToDid` sau khi sync.

### 1.2 Canonical Identity

- Một user có thể link nhiều ví, nhưng chỉ có **một canonical DID**.
- Các ví phụ trỏ về canonical DID qua bảng linking (off-chain trước, on-chain mở rộng sau).
- Mục tiêu: chống Sybil chia tài khoản, đồng thời giữ quyền multi-wallet hợp pháp.

### 1.3 Lifecycle

| Trạng thái | Ý nghĩa | Ai có quyền chuyển |
|---|---|---|
| `active` | DID hoạt động bình thường | n/a |
| `inactive` | User tự deactivate | owner |
| `frozen` | Bị admin/governance đóng băng | admin/governance |
| `recovered` | Đã chuyển owner sau recovery 2-of-3 | guardian quorum |

### 1.4 Delegate

- Mỗi DID có thể uỷ quyền cho `N` địa chỉ thực hiện một số hành động giới hạn (ví dụ ký attestation thay).
- Delegate KHÔNG được transfer DID, KHÔNG được rút wallet binding.

---

## 2. SoulboundNFT (SBT) Model

### 2.1 Bản chất

- ERC721 non-transferable. `transferFrom`, `approve`, `setApprovalForAll` đều revert.
- Mỗi badge có `badgeType` (uint16) theo taxonomy chuẩn.

### 2.2 Taxonomy chuẩn (uint16)

| Range | Domain |
|---|---|
| 1–8 | Core ecosystem (Early Believer, Contributor, Trusted Collaborator, Pure Creator, Teacher, Community Giver, Governance Steward, Milestone Achiever) |
| 100–199 | FUN Profile |
| 200–299 | FUN Academy |
| 300–399 | FUN Charity |
| 400–499 | FUN Coordinator / Validator |
| 900–999 | Reserved cho governance event |

### 2.3 Privacy rule

- `metadataURI` chỉ chứa thông tin **public-safe**: tên badge, mô tả, hình ảnh, version.
- Dữ liệu nhạy cảm (PII, lịch sử hành vi, evidence chi tiết) **không được lưu lên IPFS public**.
- Mọi bằng chứng nhạy cảm chỉ lưu **hash** (`evidenceHash`) trên chain; bản gốc nằm trong DB nội bộ + ZK reveal nếu cần.

### 2.4 Evidence & Revocation

- `evidenceHash` (bytes32): keccak256 của payload bằng chứng off-chain.
- `revocationReasonHash` (bytes32): keccak256 của lý do thu hồi (có thể public hoặc không).
- SBT bị revoke vẫn tồn tại on-chain (audit), nhưng có flag `revoked = true` và bị loại khỏi mọi phép tính reward.

---

## 3. DIB Model (Digital Identity Bank)

### 3.1 7 Vault Hashes

DIB không lưu raw data on-chain. Mỗi vault chỉ lưu một `bytes32` hash đại diện:

| Vault | Mô tả |
|---|---|
| `identity_vault_hash` | Snapshot DID + canonical link |
| `trust_vault_hash` | Snapshot trust profile (TC, tier, decay) |
| `reputation_vault_hash` | Snapshot reputation/light score |
| `contribution_vault_hash` | Snapshot đóng góp (PPLP pillars) |
| `credential_vault_hash` | Snapshot SBT đã earn |
| `governance_vault_hash` | Snapshot quyền quản trị |
| `economic_access_hash` | Snapshot quyền mint/claim/withdraw |

### 3.2 Snapshot Root

- `snapshot_root_hash = keccak256(concat(7 vaults + epoch + did))`
- Cho phép verify nhanh "DIB của user X tại epoch Y có khớp với snapshot công bố không".

### 3.3 Epoch Checkpoint

- Mỗi tuần (hoặc theo cấu hình PPLP epoch), backend tạo checkpoint mới.
- On-chain DIB lưu `latestSnapshotRoot` + `latestEpochId` để audit.

### 3.4 Mapping off-chain ↔ on-chain

| Off-chain (`dib_profile`) | On-chain (`FunDIB`) |
|---|---|
| 7 vault hashes | (Phase B) thêm vào struct `IdentityProfile` |
| `snapshot_root_hash` | `latestSnapshotRoot` |
| `last_snapshot_at` | `latestSnapshotAt` |
| `lightScore` (computed) | `lightScore` (mirror) |

---

## 4. Trust / Light Score Model

### 4.1 Trust Tier

| Tier | TC range | Quyền mint/claim |
|---|---|---|
| T0 | 0.00–0.20 | Cap 50% + warning |
| T1 | 0.20–0.45 | 100% theo công thức |
| T2 | 0.45–0.65 | 100% + bonus eligibility |
| T3 | 0.65–0.85 | Validator-eligible |
| T4 | 0.85–1.00 | Governance-eligible |

### 4.2 Risk Gates

| Risk | Hành vi |
|---|---|
| `low` | Không chặn |
| `medium` | Cảnh báo, log audit |
| `high` | Giảm cap reward 50%, cần manual review cho mint lớn |
| `critical` | Chặn mint/claim/withdraw, đưa vào slash review |

### 4.3 Decay & Trend

- Trust giảm dần nếu user không hoạt động (`decay_factor`).
- Trend được tính qua `trust_history` để phát hiện tăng đột biến đáng ngờ.

### 4.4 Light Score (production form)

```
LightScore = (Contribution + VerifiedTrust + Consistency + EcosystemImpact)
             × IntegrityMultiplier
             - RiskPenalty
```

- On-chain chỉ lưu kết quả cuối + checkpoint.
- Công thức chi tiết được quản lý ở `scoring_rules` (versioned, có timelock).

---

## 5. Smart Contract Architecture

### 5.1 4 Contract chính (đã có MVP)

1. `FunDIDRegistry` — registry-first DID.
2. `FunSoulboundBadge` — ERC721 non-transferable.
3. `FunDIB` — reputation profile + vault hashes (Phase B).
4. `FunIdentityAuthority` — coordinator: mint SBT + update DIB atomically.

### 5.2 Phase A (MVP — đã xong)

- Compile + 21/21 test pass.
- Chưa deploy thật.

### 5.3 Phase B (Safer v1.1 — kế hoạch)

- `FunSoulboundBadge`:
  - Thêm `evidenceHash` + `revocationReasonHash`.
  - Thêm event `BadgeRevoked(tokenId, revocationReasonHash)`.
- `FunDIB`:
  - Thêm 7 vault hash fields + `snapshot_root` + `epoch_id`.
  - Cho phép delta âm có kiểm soát (chỉ `RISK_ROLE` hoặc `GOVERNANCE_ROLE`).
  - Bổ sung nonce + EIP-712 signed update để chống replay.
- `FunIdentityAuthority`:
  - Tách rõ `ISSUER_ROLE`, `SCORER_ROLE`, `AI_ROLE`, `RISK_ROLE`, `REWARD_HOOK_ROLE`.
  - AI chỉ submit tín hiệu, không trực tiếp đụng reward.

### 5.4 Phase C (Advanced — future)

- ZK proof thực (Groth16/PLONK) thay commit-reveal sha256.
- Cross-chain identity mirror.
- Multi-wallet linking on-chain.
- Governance recovery multisig on-chain.
- `getRewardTier(user)` view cho FUN mint engine.

---

## 6. Off-chain ↔ On-chain Bridge

```text
FUN.Rich DB
  → DID/SBT/DIB queue
  → backend worker (auto-minter, scorer)
  → smart contract
  → tx receipt
  → DB sync status
  → Admin/User UI
```

### 6.1 Trạng thái queue chuẩn

`pending → processing → confirmed | failed (retry≤3) → dead_letter`

### 6.2 Cột mapping cần đảm bảo

| Bảng | Cột | Mục đích |
|---|---|---|
| `user_dids` | `did_onchain_tx`, `did_onchain_chain_id`, `did_synced_at` | DID đã đăng ký on-chain |
| `sbt_registry` | `onchain_token_id`, `onchain_tx`, `synced_at` | SBT đã mint thật |
| `dib_profile` | `dib_checkpoint_tx`, `dib_synced_epoch` | DIB checkpoint đã commit |

### 6.3 Mode

- `simulation` (mặc định khi chưa có contract address/minter key).
- `live` (sau khi deploy contract & set secret).
- Hai mode KHÔNG được lẫn dữ liệu — log rõ `mode` trong mọi audit row.

---

## 7. AI Governance Boundary

| AI được làm | AI KHÔNG được làm |
|---|---|
| Phân tích pattern hành vi | Quyết định ai là "người tốt/xấu" |
| Phát hiện sybil cluster | Tự ý ban/freeze account |
| Đề xuất risk score | Tự ý phát/giữ tiền user |
| Submit tín hiệu vào `AI_ROLE` | Bypass `ISSUER_ROLE` / `RISK_ROLE` |
| Hỗ trợ admin review nhanh | Thay thế phán quyết con người |

---

## 8. Reward Hook (cổng nối FUN mint)

- Identity contract KHÔNG mint FUN.
- FUN mint engine **đọc** từ DIB:
  - `getProfile(user).lightScore`
  - `getProfile(user).active`
  - Trust tier (qua off-chain hoặc on-chain mirror)
  - Risk flag
- Nếu `risk = critical` hoặc `active = false` → mint engine từ chối.

---

## 9. Versioning & Governance

- Spec này là v1.0. Mọi thay đổi lớn phải:
  1. Tạo PR cập nhật spec.
  2. Cập nhật `scoring_rules` nếu liên quan công thức.
  3. Áp dụng timelock 48h trước khi đổi tham số nhạy cảm (theo Transparency Ledger).
  4. Giữ tương thích ngược cho DID/SBT đã issue.

---

## 10. Roadmap rollout

| Phase | Nội dung | Trạng thái |
|---|---|---|
| A | MVP 4 contract + tests | ✅ Done (chưa deploy) |
| B | Safer v1.1: evidenceHash, vault hashes, nonce/epoch | 🔜 Tiếp theo |
| C | ZK proof, multi-wallet on-chain, governance recovery | Future |

---

_Tài liệu này được duy trì bởi Angel AI CTO. Mọi nâng cấp Identity + Trust Layer đều phải được ánh xạ trở lại file này._

---

## 11. Connector Layer — First On-chain Giver

> *Referral is claimed by words. Connector is proven by giving.*

### 11.1 Định nghĩa

**Connector** = ví/người đầu tiên gửi token on-chain hợp lệ đến user mới trong vòng **48h** kể từ `profiles.created_at`. Mỗi user có **tối đa 1 Connector**, khoá vĩnh viễn sau khi xác nhận.

### 11.2 Quy tắc hợp lệ

- Token thuộc whitelist (CAMLY/BNB/FUN Money testnet).
- Giá trị ≥ ngưỡng tối thiểu (0.001 BNB hoặc 1 token cấu hình).
- `tx.status = success`, ≥ 12 confirmations.
- `from ≠ to`, không phải ví của chính newcomer (cross-check `user_dids.secondary_wallets` + `user_wallet_addresses`).
- Sender không có `sybil_risk = critical` hoặc `fraud_risk = critical`.
- 1 ví không làm Connector quá 5 user/ngày.

### 11.3 Tie-break

`block_number ASC → transaction_index ASC`. Atomic claim qua RPC `claim_connector_slot()` với `UNIQUE(newcomer_user_id)`.

### 11.4 Reward

- +Light Score base (Network pillar) — cấu hình `pplp_parameter_config`.
- SBT `LIGHT_CONNECTOR` (badge type `7` trong taxonomy core 1–8).
- Tăng `profiles.connector_count` của Connector.

### 11.5 Dispute

- 7 ngày kể từ `confirmed_at`, raise dispute qua edge function `connector-dispute`.
- Admin resolve `upheld` → revoke Connector + reset `has_connector = false` (cho phép indexer tìm Connector khác trong window còn lại) + trừ count.
- SBT bị revoke với `revocationReasonHash = keccak256(dispute_reason)`.

### 11.6 Bảng & Edge functions

| Bảng | Vai trò |
|---|---|
| `connectors` | 1 record/newcomer, lưu Connector chính thức |
| `connector_events` | Log mọi ứng viên (eligible/below_threshold/same_owner/sybil_blocked/wallet_daily_cap/slot_taken/no_wallet_linked) |
| `connector_disputes` | Tranh chấp do user/admin raise |

| Edge function | Cron / Trigger |
|---|---|
| `connector-indexer` | Mỗi 5 phút (cron) hoặc POST `{user_id}` |
| `connector-stats` | UI gọi để render trang `/connector` |
| `connector-dispute` | User raise / admin resolve |

### 11.7 Evidence Hash

```
evidenceHash = sha256(tx_hash | chain_id | newcomer_did | connector_wallet)
```

Lưu trên cột `connectors.evidence_hash`. Khi mint SBT `LIGHT_CONNECTOR` on-chain (Phase B), dùng làm `evidenceHash` của contract `FunSoulboundBadge`.

### 11.8 Roadmap

| Phase | Nội dung | Trạng thái |
|---|---|---|
| A | Off-chain indexer + DB + UI + dispute | ✅ v1 |
| B | Mint SBT `LIGHT_CONNECTOR` on-chain qua queue (`sbt_onchain_queue` + `sbt-auto-mint`, simulation→live) | ✅ v1.8 |
| C | Contract `FunConnectorRegistry.sol` (optional) | Future |

