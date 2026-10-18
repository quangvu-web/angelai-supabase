# 💎 PPLP Reward Mechanism — Cơ chế Tính Thưởng & Mint FUN Money

> Tài liệu kỹ thuật v3.0 — Triển khai Phần 3–9: Rule Versioning, API, Reason Codes, Transparency  
> Cập nhật: 2026-02-27

---

## 0) Phân biệt 3 Lớp Thưởng

| Lớp | Tên | Mô tả |
|-----|-----|-------|
| 1 | **Light Score** | Thước đo năng lượng & hành vi — không đồng nghĩa quyền mint |
| 2 | **Mint Eligibility** | Điều kiện mint dựa trên Reputation, Consistency, Integrity |
| 3 | **FUN Money Flow** | Mint theo chu kỳ, phân bổ theo giá trị thật toàn hệ |

---

## 1) Công thức PPLP Score hoàn chỉnh

```
PPLP Score = (5 Pillars × Community Score)
           × Reputation Weight      [0.5 – 1.5]
           × Consistency Multiplier  [1.0 / 1.3 / 1.6]
           × Sequence Multiplier     [1.0 – 3.0]
           − Integrity Penalty       [0 – 50%]
```

### 1.1 Reputation Weight (0.5 – 1.5)

Tính theo 4 yếu tố:
- **Thời gian đóng góp**: max +0.25 cho 180 ngày hoạt động
- **Tỷ lệ pass/fail**: max +0.30 cho 100% pass rate
- **Chuỗi hoàn thành**: max +0.20 cho 20+ chuỗi completed
- **Trust score**: max +0.25 cho trust_score = 100

### 1.2 Consistency Multiplier

| Điều kiện | Multiplier |
|-----------|------------|
| < 20 ngày đóng góp / 30 ngày | ×1.0 |
| ≥ 20 ngày / 30 ngày (67%+) | ×1.3 |
| ≥ 60 ngày / 90 ngày (67%+) | ×1.6 |

### 1.3 Sequence Multiplier (1.0 – 3.0)

### 1.4 Integrity Penalty (0 – 50%)

---

## 2) Scoring Rule Versioning

### Bảng `scoring_rules`

| Cột | Mô tả |
|-----|-------|
| `rule_version` (PK) | V1.0, V1.1, V2.0... |
| `formula_json` | Công thức tính điểm (pillar weights, min score) |
| `weight_config_json` | Cấu hình Reputation Weight |
| `multiplier_config_json` | Consistency & Sequence config |
| `penalty_config_json` | Integrity penalty types & caps |
| `status` | draft / active / deprecated |
| `effective_from` / `effective_to` | Phạm vi áp dụng |

### Migration Strategy
- Không tính lại quá khứ khi chuyển V1 → V2
- Chỉ áp dụng từ epoch mới
- `light_score_ledger.rule_version` ghi nhận rule nào đã dùng

---

## 3) API Endpoints Chuẩn hoá

| # | Endpoint | Method | Mô tả |
|---|----------|--------|-------|
| 1 | `pplp-event-ingest` | POST | Nhận event → validate → insert `pplp_events` → trả `event_id` |
| 2 | `pplp-submit-rating` | POST | Rating 5 trụ → validate → insert `pplp_ratings` với `weight_applied` |
| 3 | `pplp-light-profile` | GET | Light Level + Trend + streak (public-safe, không raw score) |
| 4 | `pplp-light-me` | GET | Chi tiết riêng tư: period, multipliers, reason_codes, trend |
| 5 | `pplp-mint-summary` | GET | Epoch summary: mint_pool, total_light, rule_version, anti-whale cap |

---

## 4) Reason Codes (Ngôn ngữ tích cực)

### Tích cực
| Code | Ý nghĩa |
|------|---------|
| `CONSISTENCY_STRONG` | Đóng góp đều đặn ≥67% trong 30 ngày |
| `MENTOR_CHAIN_COMPLETED` | Hoàn thành chuỗi hành vi mentorship |
| `VALUE_LOOP_ACTIVE` | Hoàn thành chuỗi tạo giá trị |
| `COMMUNITY_VALIDATED` | Reputation weight cao ≥1.3 |
| `CROSS_PLATFORM_CONTRIBUTOR` | Đóng góp đa nền tảng |
| `HEALING_IMPACT_DETECTED` | Pillar H ≥ 70 |
| `GOVERNANCE_PARTICIPATION` | Tham gia quản trị cộng đồng |

### Điều chỉnh cân bằng
| Code | Ý nghĩa |
|------|---------|
| `QUALITY_SIGNAL_LOW` | Penalty nhẹ ≤10% |
| `TEMPORARY_WEIGHT_ADJUSTMENT` | Penalty > 10% |
| `INTERACTION_PATTERN_UNSTABLE` | Hành vi không ổn định |
| `RATING_CLUSTER_REVIEW` | Đánh giá cần xem xét |
| `CONTENT_REVIEW_IN_PROGRESS` | Nội dung đang được duyệt |

---

## 5) Level System (Không cạnh tranh)

| Light Score | Level | Icon |
|-------------|-------|------|
| 0–20 | Light Seed | 🌱 |
| 21–40 | Light Sprout | 🌿 |
| 41–60 | Light Builder | 🏗️ |
| 61–80 | Light Guardian | 🛡️ |
| 81+ | Light Architect | ✨ |

### Trend hiển thị
| Trend | Ý nghĩa |
|-------|---------|
| Growing 📈 | Score tăng >5 so với kỳ trước |
| Stable ➖ | Score ổn định |
| Reflecting 🔄 | Score giảm nhẹ |
| Rebalancing ⚖️ | Có integrity penalty đang áp dụng |

---

## 6) Mint Engine — Anti-Whale

### Epoch Flow
1. Freeze score snapshot
2. Remove flagged allocations
3. Calculate proportional share
4. **Apply anti-whale cap** (default 3% per user)
5. **Redistribute excess** proportionally
6. Finalize mint pool
7. Execute on-chain batch mint
8. **Publish transparency snapshot**

### Anti-Whale Two-Pass Algorithm
```
Pass 1: Identify users with share > max_share_per_user (3%)
        Calculate total excess to redistribute

Pass 2: Capped users → fixed at max_share
         Uncapped users → base_share + proportional_redistribution
```

---

## 7) Transparency Dashboard (Không nuôi Ego)

Hiển thị công khai:
- ☀️ Tổng Light toàn hệ
- 🪙 Tổng FUN Minted kỳ này
- 👥 Người dùng hoạt động
- 🔗 Mentor Chain hoàn thành
- ✨ Value Loop hoàn thành

**KHÔNG hiển thị**: thông tin cá nhân, xếp hạng, điểm số chi tiết.

---

## 8) Bảo vệ dài hạn

### 8.1 Model Drift Monitor
Nếu hành vi bắt đầu lệch về Ego → update rule version.

### 8.2 Community Council Review
Guardian + Architect review định kỳ.

### 8.3 Slow Mint Curve
Total supply tăng từ từ — max 5M FUN/tuần.

---

## 9) Files liên quan

| File | Mô tả |
|------|-------|
| `supabase/functions/pplp-score-action/index.ts` | Engine chấm điểm v2 (reason codes, rule version, trend) |
| `supabase/functions/process-mint-cycle/index.ts` | Xử lý chu kỳ mint (anti-whale, transparency snapshot) |
| `supabase/functions/pplp-event-ingest/index.ts` | API nhận event chuẩn |
| `supabase/functions/pplp-submit-rating/index.ts` | API submit rating 5 trụ |
| `supabase/functions/pplp-light-profile/index.ts` | API public light profile |
| `supabase/functions/pplp-light-me/index.ts` | API private score detail |
| `supabase/functions/pplp-mint-summary/index.ts` | API epoch summary |
| `src/components/pplp/TransparencyDashboard.tsx` | UI minh bạch hệ sinh thái |
| `src/components/pplp/LightLevelBadge.tsx` | Badge level + trend |
| `src/components/pplp/ScoreExplanationPanel.tsx` | Giải trình score + reason codes |
