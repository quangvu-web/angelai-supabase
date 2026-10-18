# Light Score Activity Framework & Behavior Sequence Engine

> Phiên bản: 1.0 | Ngày: 2026-02-27 | Tác giả: Angel AI

## 1. Tổng quan

Hệ thống Light Score Activity Framework phân loại mọi hoạt động trong hệ sinh thái FUN thành **6 nhóm chính**, kết hợp với **Behavior Sequence Engine** (Chuỗi Hành Vi) để thưởng thêm cho người dùng duy trì chuỗi hành động có giá trị liên tục.

---

## 2. Sáu nhóm hoạt động (Activity Categories)

| # | Nhóm | Mô tả | Hành động tiêu biểu |
|---|------|--------|---------------------|
| 1 | **Self-Light** (Ánh sáng bản thân) | Hoàn thiện bản thân, nhật ký, biết ơn | `PROFILE_COMPLETE`, `KYC_VERIFY`, `DAILY_RITUAL`, `GRATITUDE_PRACTICE`, `JOURNAL_WRITE` |
| 2 | **Community Interaction** (Tương tác cộng đồng) | Bài viết, bình luận, hỗ trợ | `CONTENT_CREATE`, `COMMENT_CREATE`, `POST_ENGAGEMENT`, `MENTOR_HELP`, `QUESTION_ASK` |
| 3 | **Content & Value** (Nội dung & Giá trị) | Tạo/chia sẻ nội dung chất lượng | `CONTENT_REVIEW`, `CONTENT_SHARE`, `COURSE_CREATE`, `LEARN_COMPLETE`, `QUIZ_PASS`, `PROJECT_SUBMIT` |
| 4 | **Web3 & Economic** (Web3 & Kinh tế) | Giao dịch, stake, thanh khoản | `STAKE_LOCK`, `LIQUIDITY_PROVIDE`, `REFERRAL_INVITE`, `FARM_DELIVERY`, `MARKET_FAIR_TRADE`, `PRODUCT_REVIEW`, `SELLER_VERIFY` |
| 5 | **Ecosystem Contribution** (Đóng góp hệ sinh thái) | Từ thiện, môi trường, quản trị | `DONATE`, `VOLUNTEER`, `CAMPAIGN_CREATE`, `CAMPAIGN_SUPPORT`, `TREE_PLANT`, `CLEANUP_EVENT`, `CARBON_OFFSET`, `ECO_ACTION`, `GOV_PROPOSAL`, `GOV_VOTE`, `DISPUTE_RESOLVE`, `POLICY_REVIEW`, `BUG_BOUNTY` |
| 6 | **Behavior Sequence** (Chuỗi hành vi) | Thưởng cho chuỗi hành động liên tục | Tự động phát hiện khi hoàn thành chuỗi |

---

## 3. Behavior Sequence Engine

### 3.1 Năm chuỗi hành vi

| Chuỗi | Các bước | Hệ số thưởng |
|--------|----------|--------------|
| **LIGHT_GROWTH** | Đăng bài → Cộng đồng tương tác (≥3) → Phản hồi xây dựng → Tạo nội dung nâng cao | **2.0x** |
| **MENTORSHIP** | Hướng dẫn thành viên mới → Hoàn thiện hồ sơ → Tạo nội dung đầu tiên | **2.5x** |
| **VALUE_CREATION** | Hoàn thành khóa học → Tạo nội dung → Tương tác (≥5) → Chia sẻ | **2.0x** |
| **CONFLICT_HARMONY** | Giải quyết tranh luận → Phản hồi bình tĩnh → Cộng đồng xác nhận | **3.0x** |
| **ECONOMIC_INTEGRITY** | Hỏi đáp (≥5) → Quyên góp → Chia sẻ | **1.5x** |

### 3.2 Quy tắc chống farm điểm

- Mỗi chuỗi phải hoàn thành trong **7 ngày** (hết hạn → status = `expired`)
- Mỗi loại chuỗi tối đa **1 lần/tuần/người dùng**
- Giảm dần thưởng khi lặp lại chuỗi giống nhau
- Kiểm tra cảm xúc AI cho tín hiệu chất lượng nội dung

### 3.3 Luồng phát hiện chuỗi

```
Người dùng thực hiện hành động
  → pplp-score-action chấm điểm
    → Gọi detect_behavior_sequences(user_id, action_id, action_type)
      → Kiểm tra chuỗi đang active → cập nhật stage
      → Nếu chưa có chuỗi phù hợp → tạo mới
      → Nếu hoàn thành → áp dụng sequence_multiplier vào reward
```

---

## 4. Năm tầng Light Level

| Tầng | Tên tiếng Việt | Tên tiếng Anh | Điểm tối thiểu | Biểu tượng | Màu |
|------|----------------|---------------|-----------------|-------------|-----|
| 1 | Hiện diện tích cực | Light Presence | 0 | 🌱 | green |
| 2 | Người tạo giá trị | Light Contributor | 200 | 🌿 | blue |
| 3 | Người xây dựng | Light Builder | 500 | 🌳 | purple |
| 4 | Người bảo vệ | Light Guardian | 1000 | ⭐ | amber |
| 5 | Người thiết kế | Light Architect | 2000 | 👑 | rose |

### 4.1 Công thức tính Light Level

```sql
effective_score = avg_light_score + (completed_sequences * 50)

Light Level = CASE
  WHEN effective_score >= 2000 THEN 5
  WHEN effective_score >= 1000 THEN 4
  WHEN effective_score >= 500  THEN 3
  WHEN effective_score >= 200  THEN 2
  ELSE 1
END
```

---

## 5. Cấu trúc cơ sở dữ liệu

### 5.1 Bảng `pplp_behavior_sequences`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | uuid (PK) | Khóa chính |
| `user_id` | uuid | Người dùng |
| `sequence_type` | text | Loại chuỗi (light_growth, mentorship, ...) |
| `actions` | uuid[] | Danh sách action_id đã thực hiện |
| `stage` | int | Giai đoạn hiện tại |
| `max_stage` | int | Tổng số giai đoạn |
| `sequence_multiplier` | numeric | Hệ số thưởng khi hoàn thành |
| `status` | text | active / completed / expired |
| `started_at` | timestamptz | Thời điểm bắt đầu |
| `completed_at` | timestamptz | Thời điểm hoàn thành |
| `expires_at` | timestamptz | Thời điểm hết hạn (7 ngày) |

### 5.2 Bảng `pplp_activity_categories`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | uuid (PK) | Khóa chính |
| `action_type` | text (unique) | Loại hành động |
| `category` | text | Nhóm (self_light, community_interaction, ...) |
| `base_weight` | numeric | Trọng số cơ bản |
| `description_vi` | text | Mô tả tiếng Việt |
| `description_en` | text | Mô tả tiếng Anh |

### 5.3 Bảng `pplp_light_levels`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `level` | int (PK) | Cấp 1–5 |
| `name_vi` | text | Tên tiếng Việt |
| `name_en` | text | Tên tiếng Anh |
| `min_score` | numeric | Điểm tối thiểu |
| `max_score` | numeric | Điểm tối đa (null = vô hạn) |
| `icon` | text | Emoji biểu tượng |
| `color` | text | Mã màu |
| `perks` | jsonb | Quyền lợi |

---

## 6. Hàm cơ sở dữ liệu

### 6.1 `detect_behavior_sequences(_user_id, _action_id, _action_type)`

- Quét hành động mới để khớp với chuỗi đang active hoặc khởi tạo chuỗi mới
- Tự động chuyển status → `expired` nếu quá 7 ngày
- Giới hạn 1 chuỗi completed/tuần/loại

### 6.2 `get_user_light_level(_user_id)`

- Trả về JSON chứa: level, name, icon, color, total_score, avg_light_score, completed_sequences, min/max_score, perks

---

## 7. Tích hợp Edge Function

### `pplp-score-action`

Sau khi chấm điểm thành công (decision = pass):

```
Step 9: Detect Behavior Sequences
  → Gọi detect_behavior_sequences()
  → Nếu có chuỗi hoàn thành → sequenceBonus = sequence_multiplier
  → adjustedReward *= sequenceBonus
```

---

## 8. Giao diện (Frontend Components)

| Thành phần | Đường dẫn | Chức năng |
|------------|-----------|-----------|
| `LightLevelBadge` | `src/components/pplp/LightLevelBadge.tsx` | Hiển thị tầng Light Level + thanh tiến trình |
| `BehaviorSequenceTracker` | `src/components/pplp/BehaviorSequenceTracker.tsx` | Pipeline hiển thị chuỗi active/completed |
| `LightActivityCategories` | `src/components/pplp/LightActivityCategories.tsx` | Grid 6 nhóm hoạt động |

### Hooks

| Hook | Đường dẫn | Chức năng |
|------|-----------|-----------|
| `useLightLevel` | `src/hooks/useLightLevel.ts` | Lấy Light Level qua RPC |
| `useBehaviorSequences` | `src/hooks/useBehaviorSequences.ts` | Lấy chuỗi hành vi từ DB |
