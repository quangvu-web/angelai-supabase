# 🪙 MINT FUN PIPELINE — End‑to‑End Spec (v1.0)

> Tài liệu đóng gói toàn bộ quy trình **Mint FUN Money** của FUN Ecosystem để áp dụng nguyên trạng (hoặc fork) sang một dự án Lovable / Supabase / EVM khác.
>
> Cập nhật: 2026‑04‑21 · Stack: React 18 + Vite + Tailwind · Supabase (Postgres + Edge Functions Deno) · Solidity 0.8.x trên BSC Testnet (chain 97).

---

## 0) Bản đồ tổng quan

```
┌─────────────────────────────────────────────────────────────────────────┐
│  USER (Profile)                                                         │
│  ─ Light Score (engine v2)                                              │
│  ─ Pending allocations (FUN chờ claim)                                  │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ 1. ClaimFUNButton  → edge: pplp-claim-fun
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  DB: pplp_mint_requests (status = pending_sig)                          │
│      pplp_mint_allocations  (status = claimed)                          │
│      fun_distribution_logs   (99/1 split log)                           │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ 2a. Multisig 3-of-3 (will / wisdom / love)  ← legacy v1
               │      → status = signed
               │ 2b. Authorized Minter (v2)  ← khuyến nghị
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Edge cron: pplp-epoch-batch-minter (mỗi 5')                            │
│  ─ Lấy status='signed' → contract.mintValidatedAction()                 │
│  ─ Update status = minted, lưu tx_hash                                  │
└──────────────┬──────────────────────────────────────────────────────────┘
               │ 3. On-chain split 99/1 (USER_BPS=9900, PLATFORM_BPS=100)
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Smart contract: FUNMoneyMinter (BSC Testnet 97)                        │
│  ─ mintValidatedAction(actionId, user, total, validationDigest)         │
│  ─ mintValidatedActionLocked(... , lockDuration)                        │
│  ─ processedActionIds(bytes32) → bool   (replay protection)             │
└─────────────────────────────────────────────────────────────────────────┘

Monitoring:
  • /admin/mint-approval        — duyệt / ký multisig + tab Batch Stats
  • /admin/mint-stuck           — Stuck Mint Panel (nudge / cancel / force expire)
  • /admin/founder-dashboard    — Mint Pipeline Health Card
  • cron: pplp-mint-auto-expire (mỗi 6h)
  • cron: cleanup-banned-mint-requests (daily)
```

---

## 1) Smart contract — `FUNMoneyMinter`

**Mục tiêu:** thay thế multisig EIP‑712 phức tạp bằng *authorized minter model*. Backend ký bằng 1 ví duy nhất, contract enforce 99/1 split on‑chain.

**Hàm chính:**

| Function | Mô tả |
|---|---|
| `mintValidatedAction(bytes32 actionId, address user, uint256 totalMint, bytes32 validationDigest)` | Mint instant. 99% → user, 1% → `platformTreasury`. |
| `mintValidatedActionLocked(..., uint256 lockDuration)` | Mint nhưng phần user vào `LockedGrant` cho đến `block.timestamp + lockDuration`. |
| `releaseLockedGrant(uint256 index)` | Beneficiary tự release sau khi hết lock. |
| `processedActionIds(bytes32) view returns (bool)` | Replay‑protection: 1 actionId chỉ mint 1 lần. |
| `setAuthorizedMinter(address, bool)` | Owner ủy quyền backend wallet. |

**Hằng số:** `USER_BPS = 9900`, `PLATFORM_BPS = 100`. Đặt cứng trong contract.

**Sự kiện:** `ActionMinted`, `GrantLocked`, `GrantReleased`, `MinterUpdated`, `TreasuryUpdated`.

ABI đầy đủ: `src/lib/funMoneyABI.ts` (đính kèm).

> Trong kit, file Solidity gốc có thể tham khảo memory `architecture/contract/fun-money-minter-v2`. Khi triển khai sang dự án mới, bạn chỉ cần deploy contract trên chain mong muốn rồi cập nhật `FUN_MONEY_ADDRESSES` cho đúng `chainId`.

---

## 2) Database schema

### 2.1 Bảng cốt lõi

| Bảng | Mục đích |
|---|---|
| `pplp_mint_requests` | 1 row = 1 yêu cầu mint cho 1 action (hoặc 1 epoch batch). Trạng thái di chuyển: `pending → pending_sig → signing → signed → submitted → minted` (hoặc `rejected/expired/cancelled/failed`). |
| `pplp_mint_allocations` | FUN đã được phân bổ cho user theo từng epoch. `status: pending → claimed → minted`. |
| `fun_distribution_logs` | Log 99/1 split để đối soát treasury (`user_amount`, `platform_amount`, `genesis_amount`, `partners_amount`). |
| `pplp_mint_audit` | Log mọi action quản trị: `nudge`, `cancel`, `force_expire`, `recreate`. |
| `pplp_backlog_audit` | Phân loại 3 nhóm Aa/Ab/Ac cho việc cứu FUN kẹt. |
| `treasury_vaults` | Cấu hình các vault (strategic, reward_reserve, community_growth, …). |

### 2.2 Cột quan trọng trong `pplp_mint_requests`

```
id, action_id, actor_id, recipient_address, amount,
action_hash, evidence_hash, policy_version, nonce,
status, tx_hash, on_chain_error, minted_at,

-- Multisig v1 (giữ tương thích ngược, có thể bỏ ở v2):
multisig_required_groups   text[]  -- ['will','wisdom','love']
multisig_completed_groups  text[]
multisig_signatures        jsonb   -- { will: '0x...', wisdom: '0x...', love: '0x...' }

-- Routing:
mint_destination           text    -- 'angel_ai' | 'fun_profile'
destination_note           text
fun_profile_sync_status    text    -- 'pending' | 'synced' | 'failed'

-- Time gates:
valid_after, valid_before, created_at, updated_at
```

### 2.3 RLS

* `Users can view their own mint requests` — `actor_id = auth.uid()`
* `Admins can view/update all mint requests` — `has_role(auth.uid(),'admin')`
* `Service role bypass` cho edge functions.

### 2.4 Trigger an toàn

`trg_validate_mint_request_amount` — chặn `amount <= 0` hoặc lớn hơn `daily_cap` (config trong `epoch_config`).

---

## 3) RPC (Postgres functions)

| RPC | Caller | Mô tả |
|---|---|---|
| `check_mint_gate(_user_id uuid)` | client | Trả `{ tier, cap_pct }` (Identity+Trust v1). Soft‑mint gate. |
| `cancel_mint_request_safe(_request_id uuid, _reason text)` | admin | Atomic: set request `cancelled`, allocation về `pending`, insert `pplp_mint_audit`. |
| `notify_attesters(_request_id uuid)` | admin | Insert 9 row vào `notifications` (1 row/Attester) với deeplink `/admin/mint-approval`. |
| `get_mint_pipeline_health()` | admin client | Aggregate: `pending_sig>24h`, oldest age, total stuck FUN. |
| `get_mint_request_stats()` | admin | Tổng hợp KPI cho `/admin/mint-approval`. |
| `get_treasury_overview()` | admin | Tổng FUN distributed + pending. |

---

## 4) Edge Functions (Deno)

| Function | Trigger | Mô tả |
|---|---|---|
| `pplp-claim-fun` | client (POST) | User bấm Claim. Validate dedup, tạo `pplp_mint_request` + log distribution. |
| `pplp-authorize-mint` | admin client | Multisig v1: nhận EIP‑712 signature từ Attester, gắn vào request, chuyển `signing → signed`. |
| `pplp-batch-lock` | admin/cron | Khóa các request đã `signed` để batch minter xử lý. |
| `pplp-epoch-batch-minter` | cron 5′ | Cron lấy `signed` → gọi `mintValidatedAction()` → cập nhật `minted` + `tx_hash`. |
| `pplp-epoch-allocate` | cron monthly | Snapshot Light Score → tính share → tạo `pplp_mint_allocations`. |
| `pplp-mint-auto-expire` | cron 6h | `pending_sig` quá 14 ngày → `expired` + audit + notification. |
| `pplp-backlog-audit` | admin | Phân loại Aa/Ab/Ac. |
| `cleanup-banned-mint-requests` | cron daily | Reject mọi pending của user bị ban. |
| `pplp-distribution-settler` | cron daily | Đối soát `fun_distribution_logs` → vault. |
| `sync-to-fun-rich` | event | Forward sang FUN Profile khi `mint_destination = fun_profile`. |

Tất cả edge function dùng:

```ts
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

Secrets cần có (Lovable Cloud → Connectors → Secrets):

* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
* `BSC_TESTNET_RPC_URL` (hoặc mainnet)
* `MINTER_PRIVATE_KEY` (ví authorized minter — chỉ ở backend)
* `PLATFORM_TREASURY_ADDRESS`
* (legacy v1) `ATTESTER_*_PRIVATE_KEY` × 9

---

## 5) Frontend (React + ethers v6)

### 5.1 Hooks

| Hook | Mô tả |
|---|---|
| `useMintRequest` | CRUD/list mint request của user. |
| `useMintSubmit` | Admin submit on‑chain (gọi `mintValidatedAction`). Áp `check_mint_gate` cap_pct trước khi mint. |
| `useFUNMoneyContract` | Wrapper ethers v6 cho contract (read state, format, owner check). |
| `useMintGate` | Soft gate ở UI khi tier < T2. |
| `useEpochPreview` | Preview share trước khi epoch finalize. |
| `useMintCycle` | Trạng thái epoch hiện tại. |

### 5.2 Components

| Component | Vị trí | Mô tả |
|---|---|---|
| `ClaimFUNButton` | profile / mint pages | Gọi `pplp-claim-fun`. |
| `MintDestinationSelector` | claim flow | Chọn `angel_ai` hoặc `fun_profile`. |
| `FUNMoneyBalanceCard` | `/mint` | Show balance + locked grants. |
| `MintActionsList` / `MintActionRow` | `/admin/mint-approval` | Bảng request chờ duyệt. |
| `BatchMintStats` | `/admin/mint-approval` tab | KPI + heatmap 24h × 7 ngày + filter multisig. |
| `MintPipelineHealthCard` | `/admin/founder-dashboard` | Cảnh báo stuck. |
| `MintStuckPanel` (page) | `/admin/mint-stuck` | Nudge / Cancel / Force Expire. |
| `BacklogAuditPanel` (page) | `/admin/backlog-audit` | Phân loại Aa/Ab/Ac. |
| `TokenLifecyclePanel` | mint page | Giải thích vòng đời lock → unlock. |

### 5.3 Routing chuẩn

```
/mint                    → trang user mint
/admin/mint-approval     → duyệt + Batch Stats
/admin/mint-stuck        → cứu request kẹt
/admin/backlog-audit     → audit FUN chờ claim
/admin/founder-dashboard → Health Card
/admin/contract-status   → diagnostic on-chain
```

---

## 6) Multisig v1 vs Authorized Minter v2

| Khía cạnh | v1 (multisig 3‑of‑3) | v2 (authorized minter) |
|---|---|---|
| Số chữ ký off‑chain | 3 (will + wisdom + love) | 0 |
| Backend wallet | Không cần private key on‑chain | Cần 1 private key có quyền `setAuthorizedMinter=true` |
| Replay protection | Off‑chain check + on‑chain `nonce` | On‑chain `processedActionIds[bytes32]` |
| 99/1 split | Off‑chain compute + 2 tx | On‑chain enforce trong 1 tx |
| Phù hợp dự án mới | ❌ Phức tạp | ✅ Khuyến nghị |

> **Khuyến nghị:** dự án mới chỉ triển khai v2. Bộ kit vẫn kèm v1 để tham khảo nhưng có thể bỏ qua các function `pplp-authorize-mint`, cột `multisig_*` trong DB và toàn bộ Attester UI.

---

## 7) Anti‑abuse / hardening

1. **Dedup** trong `pplp-claim-fun`: chặn nếu user còn bất kỳ request `pending/pending_sig/signing/signed`.
2. **Replay** on‑chain qua `processedActionIds[bytes32]` (v2) hoặc `nonce` (v1).
3. **Soft gate** `check_mint_gate` cắt cap_pct theo Trust Tier (T0–T4).
4. **Auto‑expire** 14 ngày để không giữ quota vô thời hạn.
5. **Cleanup banned**: cron daily reject pending của user bị ban.
6. **Audit log** mọi can thiệp admin → `pplp_mint_audit`.
7. **Rate‑limit** ở edge function (memory store đơn giản: 5 req / phút / IP).

---

## 8) Triển khai sang dự án mới — Checklist

1. **Deploy** contract `FUNMoneyMinter` (Solidity trong kit) lên chain đích, lưu address vào `src/lib/funMoneyABI.ts`.
2. **Tạo secrets** trong Lovable Cloud: `MINTER_PRIVATE_KEY`, `PLATFORM_TREASURY_ADDRESS`, RPC URL.
3. **Chạy migration** `supabase/migrations/*mint*` (đính kèm trong kit).
4. **Deploy edge functions** (auto qua Lovable, không cần lệnh).
5. **Bật cron** trong `supabase/functions/*/cron.json` hoặc dashboard:
   * `pplp-epoch-batch-minter` — `*/5 * * * *`
   * `pplp-mint-auto-expire` — `0 */6 * * *`
   * `cleanup-banned-mint-requests` — `0 3 * * *`
6. **Mount routes** trong `src/App.tsx` (xem mục 5.3).
7. **Test happy path**: claim → signed → minted (kiểm tra `tx_hash` trên BSCScan).
8. **Test edge cases**: replay, expire, banned user, cap_pct < 1.0.

---

## 9) Files đính kèm trong kit

```
mint-fun-kit/
├── README.md                              # Hướng dẫn áp dụng
├── docs/MINT_FUN_PIPELINE.md              # Spec này
├── contract/FUNMoneyMinter.sol            # (placeholder — copy từ memory)
├── src/
│   ├── lib/funMoneyABI.ts
│   ├── hooks/useMintRequest.ts
│   ├── hooks/useMintSubmit.ts
│   ├── hooks/useFUNMoneyContract.ts
│   ├── hooks/useMintGate.ts
│   ├── components/mint/ClaimFUNButton.tsx
│   ├── components/mint/MintDestinationSelector.tsx
│   ├── components/mint/FUNMoneyBalanceCard.tsx
│   ├── components/mint/TokenLifecyclePanel.tsx
│   ├── components/admin/BatchMintStats.tsx
│   ├── components/admin/MintPipelineHealthCard.tsx
│   ├── pages/admin/MintStuckPanel.tsx
│   ├── pages/admin/BacklogAuditPanel.tsx
│   └── pages/AdminMintApproval.tsx
├── supabase/functions/
│   ├── pplp-claim-fun/index.ts
│   ├── pplp-epoch-batch-minter/index.ts
│   ├── pplp-epoch-allocate/index.ts
│   ├── pplp-mint-auto-expire/index.ts
│   ├── pplp-backlog-audit/index.ts
│   ├── pplp-batch-lock/index.ts
│   ├── pplp-authorize-mint/index.ts        # legacy v1
│   ├── cleanup-banned-mint-requests/index.ts
│   └── _shared/{pplp-eip712.ts,pplp-helper.ts,pplp-types.ts}
└── supabase/migrations/                    # toàn bộ migration mint-related
```

---

## 10) Tham khảo nội bộ

* Memory `architecture/contract/fun-money-minter-v2` — Solidity gốc.
* Memory `features/web3/fun-money-minting-logic` — flow epoch.
* Memory `governance/multisig/roles-and-permissions` — phân quyền ví.
* Memory `security/mint-system-validation-rules` — trigger an toàn.
* Memory `features/admin/mint-approval-optimization` — RPC stats.

> **Lưu ý bản quyền & vận hành:** kit này dùng nội bộ FUN Ecosystem. Khi fork sang dự án khác, đổi tên token, chain, treasury và rebrand UI cho phù hợp.
