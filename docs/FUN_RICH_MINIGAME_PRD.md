# FUN.RICH Mini Game System — PRD v1.0

> Phiên bản chi tiết của master plan (xem `.lovable/plan.md`).
> Phase 1 (Daily Light Quest) đã được implement đầu tiên.

## Mục tiêu
Biến FUN Profile / FUN.Rich thành "Light Super-Game" — mọi hành động tích cực có ý nghĩa, được thưởng Camly Coin + Light Score, và có thể chuyển hoá thành FUN Money qua PPLP (không phát trực tiếp).

## 4 Phase (12 tuần)
1. **Phase 1 (W1-3)** — Daily Light Quest + Reward Engine + XP Ledger
2. **Phase 2 (W4-6)** — Mystery Box + NFT Inventory + Rarity Engine
3. **Phase 3 (W7-9)** — AI Companion Pet (Angel AI persona)
4. **Phase 4 (W10-12)** — Treasure Hunt + Telegram Mini App + Viral Bot

## Nguyên tắc bất biến
- KHÔNG competitive leaderboard.
- Game KHÔNG mint trực tiếp FUN Money.
- Mọi action cần proof, đi qua AI Scoring Engine + Anti-Sybil 10 layer.
- Reward freeze nếu severity ≥ 4.

---

## Phase 1 — Daily Light Quest (đã ship)

### Tables (migration 2026-05-14)
- `quest_templates` — kho 12 quest mẫu (5 dimension PPLP).
- `user_daily_quests` — 5 quest random gán cho user mỗi ngày.
- `user_quest_streaks` — current/longest streak, multiplier 1.0–2.0×, 1 grace day/tháng.
- `user_xp_ledger` — sổ cái XP.
- `quest_evidence_audit` — log AI chấm evidence.

### RPC
- `claim_quest_reward(quest_id, evidence_ref, ai_score, risk_score)`
  - Atomic: kiểm tra ownership → AI score gate (≥ 0.5) → update streak + multiplier → cộng Camly + ghi XP + ghi transaction.
  - Multiplier theo bảng: 3d=1.05× / 7d=1.15× / 14d=1.25× / 30d=1.40× / 60d=1.55× / 90d=1.75× / 180d=2.00×.

### Edge functions
- `quest-daily-rotate` — cron 00:00 UTC+7. Sinh 5 quest weighted-random cho user active 7 ngày qua.
- `quest-claim` — verify JWT → AI scoring (Lovable AI Gateway, gemini-3-flash-preview) → call RPC.
- `quest-streak-tick` — cron 00:30 UTC+7. Break streak nếu không claim, dùng grace day nếu còn.

### UI
- Route `/quest` (Quest.tsx) — list 5 quest, claim dialog với evidence textarea.
- Widget `DailyQuestWidget` — hiển thị tiến độ + streak ở Home.
- Hook `useDailyQuests` — quests + streak + claim mutation.

### Anti-cheat
- Tận dụng 10-layer anti-sybil sẵn có.
- AI gate evidence < 0.5 → freeze quest, ghi audit.
- Daily cap 1/quest qua UNIQUE constraint.

---

## Phase 2 — Mystery Box (chuẩn bị)

### Tier & probability
| Tier | Drop | Min Camly | Max Camly | NFT chance |
|---|---|---|---|---|
| Common | 60% | 5 | 50 | 0.1% |
| Rare | 25% | 50 | 300 | 1% |
| Epic | 10% | 300 | 1500 | 5% |
| Legendary | 4% | 1500 | 8000 | 25% |
| Cosmic | 1% | 8000 | 30000 | 100% |

Reveal: commit-reveal scheme (server seed + user reveal hash).

Anti-inflation: Camly từ box ≤ 30% emit/ngày, daily cap 5 box/user, box hết hạn 30 ngày.

### NFT Collection
| Collection | Supply | Trait |
|---|---|---|
| Light Spark (avatar skin) | 10,000 | Color × 5, Aura × 4, Glyph × 5 |
| Pet Genesis (Phase 3) | 5,000 | Element × 5, Personality × 4 |
| Lighthouse Badge (soulbound) | unlimited | Streak milestone |
| Treasure Map Fragment (Phase 4) | 8,000 | 5 fragment = jackpot |

Chain: BSC Testnet → Mainnet ở Phase 4. Lazy-mint khi user click Claim.

---

## Phase 3 — AI Companion Pet (chuẩn bị)

### Spec
- 5 element: Fire / Water / Earth / Air / Light (gắn dimension PPLP).
- 4 personality: Joyful / Wise / Bold / Gentle.
- 6 evolution: Spark → Glow → Flame → Star → Sun → Cosmos.
- Stats: Energy/Mood/Aura (0-100), XP, Level (1-100).

### AI behavior
- Lovable AI Gateway (gemini-3-flash-preview).
- Persona theo Brand Protocol V3 (mình - bạn).
- Memory 50 message gần nhất, biết quest đã hoàn thành hôm nay.

### Pet → multiplier
| Lv | Camly mult | Light Score |
|---|---|---|
| 1-10 | 1.00× | +0% |
| 11-30 | 1.05× | +2% |
| 31-60 | 1.10× | +5% |
| 61-90 | 1.15× | +8% |
| 91-100 | 1.20× | +10% |

Cap kết hợp (Streak × Pet × TC) ≤ 2.5×.

---

## Phase 4 — Treasure Hunt + Telegram Mini App

### Treasure Hunt
- 4 event/tháng, mỗi event 5 clue (in-app, Telegram, social, real-world QR).
- 5 fragment = 1 Treasure Map → unlock jackpot box (Cosmic).
- Co-op mode: team 3-5 user share progress, split jackpot.
- Anti-cheat: geo-spoof, QR rotate 24h signed JWT, rate limit 1 clue/10min/device.

### Telegram Mini App
- WebApp SDK + edge `telegram-auth` (verify HMAC) + SSO bridge.
- Bot commands: `/quest /streak /box /pet /hunt /invite`.
- Inline share + deep link `?ref=<userid>` → +10% Camly cho cả 2 nếu friend complete trong 24h.

---

## Tokenomics 5 năm

| Year | DAU | Camly emit/day | Camly/year | Burn (box+pet) | Net |
|---|---|---|---|---|---|
| Y1 | 5K | 700K | 256M | 30% (76M) | 180M |
| Y2 | 50K | 7M | 2.55B | 40% (1.0B) | 1.55B |
| Y3 | 200K | 28M | 10.2B | 50% (5.1B) | 5.1B |
| Y5 | 500K | 70M | 25.5B | 60% (15.3B) | 10.2B |

FUN Money pool 5M/tháng vẫn giữ — game đẩy contribution_delta vào PPLP. Khi DAU > 500K cần governance vote (48h timelock) raise pool.

Sustainability levers: burn 100% Camly khi mở box, pet evolution burn Camly + NFT item, treasury vault recycle 30% Camly inactive 90 ngày, Cosmos NFT seasonal scarce.

---

## Viral Growth Playbook

| Loop | Trigger | K-target |
|---|---|---|
| Quest share | Hoàn thành → share card | 0.3 |
| Box reveal | Mở rare+ → auto share | 0.4 |
| Pet milestone | Evolution → branded video | 0.5 |
| Treasure team | Mời 4 friend join hunt | 0.8 |
| Telegram invite | `/invite` deep link | 0.6 |

Tổng K-target 0.7-1.0.

Launch sequence: W1 200 trusted user → W4 2K → W7 10K (5 KOL spiritual VN) → W10 50K (Telegram bot + Treasure mùa 1).

---

## Rủi ro

| Risk | Impact | Mitigation |
|---|---|---|
| Bot farm Camly | Lạm phát | 10-layer anti-sybil + AI evidence gate |
| User burn-out | Retention drop | Grace day + pet greet + varied pool |
| FUN Money pool không đủ | Conflict | Governance timelock 48h raise pool |
| NFT gas BSC mainnet đắt | Friction | Lazy-mint + batch mint hàng tuần |
| Telegram ban (gambling-like) | Channel risk | Framing "Light gift" — không dùng từ lottery/casino |
