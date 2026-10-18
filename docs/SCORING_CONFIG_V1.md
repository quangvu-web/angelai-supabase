# SCORING CONFIG V1 — LS-Math-v1.0

**Version:** LS-Math-v1.0  
**Mục đích:** Config chuẩn cho dev test thật (unit test / integration test / simulation)  
**Tinh thần:** Copy dùng ngay • Số cụ thể • Logic rõ • Không nuôi Ego • Mint theo epoch

---

## PHẦN A — SCORING CONFIG (JSON CHUẨN V1)

```json
{
  "rule_version": "LS-Math-v1.0",
  "weights": {
    "base_action_weight": 0.4,
    "content_weight": 0.6
  },
  "reputation": {
    "alpha": 0.25,
    "w_min": 0.5,
    "w_max": 2.0
  },
  "content": {
    "gamma": 1.3,
    "type_multiplier": {
      "post": 1.0,
      "comment": 0.6,
      "video": 1.2,
      "course": 1.5,
      "bug_report": 1.1,
      "proposal": 1.3
    }
  },
  "consistency": {
    "beta": 0.6,
    "lambda": 30
  },
  "sequence": {
    "eta": 0.5,
    "kappa": 5
  },
  "penalty": {
    "theta": 0.8,
    "max_penalty": 0.5
  },
  "mint": {
    "epoch_type": "monthly",
    "anti_whale_cap": 0.03,
    "min_light_threshold": 10
  }
}
```

---

## PHẦN B — END-TO-END EXAMPLE (MÔ PHỎNG THỰC TẾ)

### Giả sử:
- **Epoch:** Tháng 02/2026
- **Mint Pool:** 100,000 FUN
- **Tổng Light hệ:** 10,000
- **User:** `u_ly`

### 1️⃣ Hoạt động trong tháng
- 3 bài post
- 1 mentor chain hoàn thành
- 30 ngày đóng góp liên tục
- 1 signal "interaction unstable" nhẹ (risk = 0.1)

### 2️⃣ Tính điểm nội dung

**Post 1** — Rating sau weight:
| Pillar | Score |
|--------|-------|
| Truth | 1.8 |
| Sustain | 1.5 |
| Healing | 1.9 |
| Service | 1.6 |
| Unity | 1.7 |

```
P_c = 8.5
h(P_c) = (8.5/10)^1.3 = (0.85)^1.3 ≈ 0.80
```

**Post 2** — Tổng = 7.2
```
h(P_c) = (0.72)^1.3 ≈ 0.65
```

**Post 3** — Tổng = 9.0
```
h(P_c) = (0.9)^1.3 ≈ 0.88
```

**Tổng Content Score:**
```
C = 0.80 + 0.65 + 0.88 = 2.33
```

### 3️⃣ Base Action Score
- Checkin đều: 3.0
- Mentor chain: 5.0
- Comment hỗ trợ: 2.0
```
B = 10
```

### 4️⃣ Raw Score
```
L_raw = 0.4 × 10 + 0.6 × 2.33
      = 4 + 1.398
      = 5.398
```

### 5️⃣ Consistency Multiplier
```
Streak = 30 ngày
M_cons = 1 + 0.6 × (1 - e^(-30/30))
       = 1 + 0.6 × (1 - 0.367)
       = 1 + 0.6 × 0.633
       = 1 + 0.379
       = 1.379
```

### 6️⃣ Sequence Multiplier
```
Mentor chain bonus = 3
M_seq = 1 + 0.5 × tanh(3/5)
      = 1 + 0.5 × 0.537
      = 1.268
```

### 7️⃣ Integrity Penalty
```
Risk = 0.1
Π = 1 - min(0.5, 0.8 × 0.1)
  = 1 - 0.08
  = 0.92
```

### 8️⃣ Final Light Score
```
L = 5.398 × 1.379 × 1.268 × 0.92
  = 7.44 × 1.268 × 0.92
  = 9.43 × 0.92
  = 8.67
```

**Light Score tháng = 8.67**

---

## PHẦN C — MINT CALCULATION

```
Tổng Light hệ = 10,000
User Light = 8.67
Share = 8.67 / 10,000 = 0.000867

Mint Pool = 100,000 FUN
Allocation = 100,000 × 0.000867 = 86.7 FUN
```

**Anti-Whale Check:**
```
Cap = 3% × 100,000 = 3,000 FUN
User nhận 86.7 → ✅ OK (dưới cap)
```

---

## PHẦN D — Unit Test Cases (Cho Dev)

| Test | Kịch bản | Kỳ vọng |
|------|----------|---------|
| **Test 1 — Spam burst** | 50 posts/ngày, rating thấp | Content exponent giảm mạnh → điểm thấp |
| **Test 2 — Viral drama** | Nhiều rating nhưng pillar healing = 0 | P_c thấp → không tăng mint |
| **Test 3 — Silent consistent** | 60 ngày ổn định, ít bài nhưng chất lượng cao | Multiplier tăng → vượt người ồn ào |
| **Test 4 — Rating ring** | 5 user chấm lẫn nhau | Reputation weight giảm + risk tăng → penalty kích hoạt |

---

## PHẦN E — HÀNH VI HỆ THỐNG ĐẢM BẢO

✔ Không có đột biến mint  
✔ Không có "post → tiền ngay"  
✔ Không có ranking  
✔ Không thể farm vô hạn  
✔ Chất lượng > số lượng  
✔ Bền vững > bùng nổ
