# LIGHT SCORE MATHEMATICAL SPEC (PPLP) — FUN Ecosystem

**Version:** LS-Math v2.0  
**Scope:** 5 Dimension Scores + Daily LS-Math + Mint Eligibility + Decay + Streak  

---

## 1. Tổng quan kiến trúc

```
┌──────────────────────────────────────────────────┐
│           LIGHT SCORE (Tổng hợp 0-500)           │
│  = Identity + Activity + OnChain                 │
│    + Transparency + Ecosystem                    │
│    × (1 + Streak) - Risk Penalty                 │
├──────────────────────────────────────────────────┤
│  Identity (0-100)     │ Profile, email, wallet,  │
│                       │ DID, account age         │
│  Activity (0-100)     │ LS-Math v1.0 normalized  │
│  OnChain (0-100)      │ Wallet, tx, contracts    │
│  Transparency (0-100) │ 100 - fraud signals      │
│  Ecosystem (0-100)    │ Camly, usage, community  │
└──────────────────────────────────────────────────┘
```

---

## 2. Dimension 1: Identity Score (max 100)

| Tiêu chí | Điểm |
|----------|------|
| display_name | +5 |
| avatar | +10 |
| bio (>10 ký tự) | +5 |
| handle | +10 |
| Email verified | +20 |
| Wallet linked | +30 |
| Account age >30d | +10 |
| DID active | +10 |

---

## 3. Dimension 2: Activity Score (max 100)

Tái sử dụng LS-Math v1.0 hiện tại (§3-§11 bên dưới).

```
Activity = min(100, Σ final_light_score trong 30 ngày) × decay_factor
```

### LS-Math v1.0 Components

**§3 Reputation Weight:** `w = clip(0.5, 2.0, 1 + 0.25 × log(1 + R))`

**§4 Content Quality:** `h(P_c) = (P_c / 10)^1.3`

**§6 Content Score:** `C_u(t) = Σ ρ(type) × h(P_c)`

**§7 Consistency:** `M_cons = 1 + 0.6 × (1 - e^(-S/30))`

**§8 Sequence:** `M_seq = 1 + 0.5 × tanh(Q/5)`

**§9 Integrity:** `Π = 1 - min(0.5, 0.8 × avgRisk)`

**§11 Daily:** `L(t) = (0.4×B + 0.6×C) × M_cons × M_seq × Π`

---

## 4. Dimension 3: On-Chain History Score (max 100)

| Tiêu chí | Điểm |
|----------|------|
| Wallet linked | +20 |
| Account >365d | +30 (>180d: +20, >90d: +10) |
| Completed withdrawals | +20 |
| Web3 gifts (sent/received) | +30 |

---

## 5. Dimension 4: Wallet Transparency Score (max 100)

```
Transparency = max(30, 100 - unresolvedFraudCount × 15)
```

Bắt đầu 100, giảm 15 điểm/mỗi fraud signal chưa resolved. Sàn 30.

---

## 6. Dimension 5: Ecosystem Alignment Score (max 100)

| Tiêu chí | Điểm |
|----------|------|
| Camly balance > 0 | +20 |
| Platform usage > 7 ngày | +20 |
| Có posts/comments | +20 |
| Đã gửi gifts | +20 |
| Holding > 30 ngày | +20 |

---

## 7. Decay Factor (Reputation Decay)

| Inactive Days | Multiplier |
|--------------|-----------|
| < 30 | 1.0 |
| 30-59 | 0.85 |
| 60-89 | 0.6 |
| 90-179 | 0.3 |
| ≥ 180 | 0 (ngủ đông) |

Áp dụng cho Activity Score: `Activity × decay_factor`

---

## 8. Streak Bonus

| Streak Days | Bonus |
|------------|-------|
| < 7 | 0% |
| 7-29 | +2% |
| 30-89 | +5% |
| ≥ 90 | +10% |

---

## 9. Risk Penalty

| Severity | Penalty |
|----------|---------|
| 1 (nhẹ) | -5 |
| 2 | -10 |
| 3 | -20 |
| ≥ 4 (mạnh) | -35 |

**Max penalty**: 80 điểm. Tính từ `pplp_fraud_signals` chưa resolved.

---

## 10. Công thức tổng

```
Light Score = (Identity + Activity + OnChain + Transparency + Ecosystem)
              × (1 + streak_bonus)
              - risk_penalty

Light Score = max(0, result)
```

---

## 11. Level Mapping

| Level | Score | Emoji |
|-------|-------|-------|
| Light Seed | 0-99 | 🌱 |
| Light Builder | 100-249 | 🔨 |
| Light Guardian | 250-499 | 🛡️ |
| Light Leader | 500-799 | ⭐ |
| Cosmic Contributor | 800+ | 🌟 |

---

## 12. Mint Eligibility (giữ nguyên)

```
Eligible iff:
  1. PPLP accepted
  2. avg_risk ≤ 0.7
  3. epoch_light_score ≥ 10
  4. No unresolved cluster review
```

---

## 13. Mint Allocation (giữ nguyên)

```
A_u(e) = I_u(e) × M(e) × L_u(e) / (T(e) + ε)
```

Anti-whale cap: 3%. Excess redistributed.

---

## 14. Tham số mặc định v2.0

| Param | Value | Description |
|-------|-------|-------------|
| Dimension weights | 20% each | 5 trụ cột đều nhau |
| decay_30d | 0.85 | Activity decay 30d |
| decay_60d | 0.6 | Activity decay 60d |
| decay_90d | 0.3 | Activity decay 90d |
| decay_180d | 0 | Ngủ đông |
| streak_7d | +2% | Bonus streak 7d |
| streak_30d | +5% | Bonus streak 30d |
| streak_90d | +10% | Bonus streak 90d |
| max_risk_penalty | 80 | Max penalty |
| fraud_signal_cost | 15 | Transparency deduction |
| ω_B | 0.4 | Action weight (LS-Math) |
| ω_C | 0.6 | Content weight (LS-Math) |
| cap | 0.03 | Anti-whale cap |

---

## 15. Database & RPC

| Resource | Description |
|----------|-------------|
| `user_dimension_scores` | Bảng lưu 5 dimension scores |
| `compute_user_dimensions(_user_id)` | SQL function tính toàn bộ |
| `pplp-compute-dimensions` | Edge function cron daily |
| `light_score_ledger` | LS-Math v1.0 data source |
| `features_user_day` | Activity & streak data |
| `pplp_fraud_signals` | Fraud data source |
