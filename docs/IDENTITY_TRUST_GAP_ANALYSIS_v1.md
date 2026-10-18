# Identity + Trust Layer — Gap Analysis v1.0

> Đối chiếu **Architecture Spec v1.0** (`docs/IDENTITY_TRUST_LAYER_SPEC_v1.md`) với code hiện tại của FUN.Rich.
> Cột "Ưu tiên": **P0** = phải xong trước khi deploy testnet thật, **P1** = nên có ở Phase B, **P2** = future.

---

## 1. DID Layer

| Hạng mục | Spec v1.0 | Hiện tại | Khoảng trống | Ưu tiên |
|---|---|---|---|---|
| Format `did:fun:<chainId>:<wallet>` | ✅ | ✅ `FunDIDRegistry._buildDID` + `user_dids.did` | OK | — |
| Canonical identity (multi-wallet) | Một canonical DID, nhiều ví | Off-chain mới có DID 1-1 wallet | Chưa có bảng `did_wallet_links` + on-chain `linkWallet()` | P1 |
| Lifecycle (active/inactive/frozen/recovered) | ✅ | active/inactive (off-chain), active/inactive (on-chain) | Thiếu `frozen`, `recovered` cả 2 phía | P1 |
| Delegate | ✅ | `FunDIDRegistry.delegates` + off-chain | OK MVP | — |
| Recovery 2-of-3 guardian | ✅ | Off-chain có (`recovery_requests`, `trusted_guardians`) | Chưa bridge on-chain | P2 |
| Sync status (`did_onchain_tx`, `did_synced_at`) | ✅ | ❌ chưa có cột | **Thêm migration** | P0 |

---

## 2. SBT Layer

| Hạng mục | Spec v1.0 | Hiện tại | Khoảng trống | Ưu tiên |
|---|---|---|---|---|
| ERC721 non-transferable | ✅ | ✅ `_update` revert + approve revert | OK | — |
| Badge taxonomy uint16 | ✅ | ✅ comment trong contract | Chưa enforce range trong Solidity | P1 |
| `metadataURI` public-safe | ✅ | ⚠️ chưa có rule trong code/UI | Cần guideline + lint khi mint | P1 |
| `evidenceHash` (bytes32) | ✅ | ❌ chưa có | Thêm field vào `BadgeData` + `mintBadge` | P0 |
| `revocationReasonHash` | ✅ | ❌ chỉ có flag `revoked` | Thêm bytes32 + event mới | P0 |
| Sync `onchain_token_id`/`onchain_tx` | ✅ | ⚠️ một phần qua `sbt_onchain_queue` | Chuẩn hóa cột trên `sbt_registry` | P0 |
| Simulation vs live mode | ✅ | ✅ trong `sbt-auto-mint` | Cần log `mode` rõ ràng vào audit | P1 |

---

## 3. DIB Layer

| Hạng mục | Spec v1.0 | Hiện tại | Khoảng trống | Ưu tiên |
|---|---|---|---|---|
| 7 vault hashes | ✅ | ✅ off-chain `dib_profile` đầy đủ | Chưa mirror on-chain | P1 |
| `snapshot_root_hash` | ✅ | ✅ off-chain | Chưa mirror on-chain | P1 |
| Epoch checkpoint | ✅ | Có `identity-snapshot` weekly | Chưa có `epoch_id` rõ ràng + commit on-chain | P1 |
| Negative delta (penalty) | ✅ | ❌ `addScoreDelta` chỉ cộng | Thêm hàm `applyPenalty(...)` cho `RISK_ROLE` | P0 |
| Nonce / EIP-712 signed update | ✅ | ❌ chưa có | Bổ sung trong Phase B | P1 |
| Mirror lightScore on-chain | ✅ | ✅ MVP additive | Đổi sang công thức production sau khi off-chain ổn | P2 |

---

## 4. Trust Engine

| Hạng mục | Spec v1.0 | Hiện tại | Khoảng trống | Ưu tiên |
|---|---|---|---|---|
| Tier T0–T4 | ✅ | ✅ `trust_profile.trust_tier` | OK | — |
| Risk gates (low/med/high/critical) | ✅ | ✅ sybil_risk + fraud_risk | Cần unify "effective_risk" duy nhất cho mint gate | P1 |
| Decay/trend | ✅ | ✅ `decay_factor`, `trust_history` | OK | — |
| Mint gate đọc trust + risk | ✅ | ✅ một phần (PPLP eligibility) | Chuẩn hóa thành 1 RPC `can_user_mint(user)` | P1 |
| Reward hook view on-chain | ✅ | ❌ chưa có | Thêm `getRewardTier(user)` ở `FunDIB` Phase B | P1 |

---

## 5. Bridge Off-chain ↔ On-chain

| Hạng mục | Spec v1.0 | Hiện tại | Khoảng trống | Ưu tiên |
|---|---|---|---|---|
| Queue chuẩn pending→processing→confirmed/failed | ✅ | ✅ `sbt_onchain_queue` | Tạo queue tương tự cho DID + DIB checkpoint | P1 |
| Dead-letter sau retry≤3 | ✅ | ⚠️ retry++ rồi fail, chưa dedicated DLQ | Thêm trạng thái `dead_letter` | P1 |
| `mode` (simulation/live) trong audit | ✅ | ⚠️ log nhưng chưa chuẩn cột | Thêm cột `exec_mode` | P1 |
| Admin dashboard sync health | ✅ | ⚠️ một phần ở `/admin/trust-engine` tab On-chain | Bổ sung panel "Sync Health" tổng | P1 |

---

## 6. AI Governance

| Hạng mục | Spec v1.0 | Hiện tại | Khoảng trống | Ưu tiên |
|---|---|---|---|---|
| AI = analyzer/risk detector | ✅ | ✅ memory `ai-role-limitation` | OK | — |
| AI submit qua `AI_ROLE` | ✅ | ✅ `updateReputationByAI` | OK MVP | — |
| AI KHÔNG đụng reward trực tiếp | ✅ | ✅ tách qua mint engine | Cần verify lại trong audit checklist | P0 |

---

## 7. Smart Contract Tests cần bổ sung (Phase B)

- [ ] `evidenceHash` được set đúng khi mint, không thay đổi sau revoke.
- [ ] `revokeBadge` ghi đúng `revocationReasonHash` + emit event mới.
- [ ] `applyPenalty` chỉ chạy được với `RISK_ROLE`, không underflow.
- [ ] EIP-712 signed score update: nonce++, replay revert.
- [ ] Reward hook: `risk = critical` → từ chối; `active = false` → từ chối.
- [ ] Role separation: `AI_ROLE` không gọi được `ISSUER_ROLE`/`RISK_ROLE` functions.

---

## 8. Backend & UI cần bổ sung

- [ ] Migration thêm cột sync (`did_onchain_tx`, `sbt_registry.onchain_token_id`, `dib_profile.dib_checkpoint_tx`).
- [ ] RPC `can_user_mint(user_id)` trả về `{ allowed, reason, tier, risk }`.
- [ ] Edge function `did-sync-onchain` (mirror `sbt-auto-mint`).
- [ ] Edge function `dib-checkpoint-commit` chạy theo epoch.
- [ ] Admin panel "Identity Sync Health" tổng hợp DID + SBT + DIB.
- [ ] User UI: badge hiển thị "Đã sync on-chain ✅ / Đang chờ ⏳ / Lỗi ❌".

---

## 9. Ưu tiên thực thi (gợi ý thứ tự)

```text
P0 → 1. Migration cột sync DID/SBT/DIB
P0 → 2. Solidity Phase B: evidenceHash, revocationReasonHash, applyPenalty
P0 → 3. Tests bảo mật mới (role separation, replay, penalty)
P1 → 4. RPC can_user_mint + unify effective_risk
P1 → 5. Edge function did-sync-onchain + dib-checkpoint-commit
P1 → 6. Admin "Identity Sync Health" panel
P1 → 7. EIP-712 signed update + nonce
P2 → 8. ZK proof thật, multi-wallet on-chain, recovery on-chain
```

---

_Gap analysis này dùng để dẫn dắt từng PR nâng cấp. Mỗi khi đóng được một dòng, đánh dấu ✅ và link PR/commit tương ứng._
