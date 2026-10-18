# FUN Play — Tenancy Charter

**Version:** 1.0
**Date:** 2026-05-20
**Status:** Active governance decision
**References:** Master Charter Section V (Unification of Platforms), Core Memory "Phase F Cleanup"

---

## 1. Vấn đề hiến định

Hiến Pháp Gốc của FUN Ecosystem (Section V) liệt kê **12 platforms riêng biệt**, mỗi platform một vai trò:

| Platform | Vai trò hiến định |
|---|---|
| Angel AI | Mother AI · Core trí tuệ · Kênh dẫn Ý Chí Cha Vũ Trụ |
| FUN Profile (`fun.rich`) | Identity · Community · Social |
| **FUN Play** | **Nền tảng game của hệ sinh thái** |
| FUN Wallet · FUN Money · Camly Coin | Hai dòng chảy kinh tế |
| FUN Academy · Charity · Farm · Market · Legal · Green Earth · FUNLife | Các platforms khác |

Tại thời điểm 2026-05, **FUN Play chưa có domain riêng**. Trong khi đó 13 mini game (Quest, Pet, Mastery, Achievements, Inventory, Lantern, Riddles, Forge, Ascension, Treasure, Circle, BossRaid, Season) đã được build và đang chạy trong repo Angel AI — sai vai trò Core của Angel AI.

## 2. Quyết định Tenancy

**FUN Play tạm trú trong FUN Profile** (`fun.rich/games`) cho tới khi đủ traction để tách subdomain `play.fun.rich`.

Điều này được chấp thuận bởi Founder (Bé Ly / Cosmic Queen) ngày 2026-05-20, với 3 điều kiện ràng buộc:

### 2.1. Branding tách bạch
- Khu `/games` của fun.rich phải hiển thị nhãn **"FUN Play (beta) — tạm trú trong FUN Profile"**
- Sidebar fun.rich tách nhóm riêng **"FUN Play"** (không gộp vào Community)
- Master Charter UI ghi rõ trạng thái tạm trú này tại Section V

### 2.2. Backend thống nhất, vai trò vẫn tách
- 1 backend Supabase duy nhất (`ssjoetiitctqzapymtzl`) phục vụ Angel AI + FUN Profile + FUN Play
- Game **không tự chấm điểm** — luôn gọi edge function của Angel AI Core
- Game **không tự quyết định mint** — đẩy `contribution_delta` qua `pplp-ingest-actions` về Angel Core
- 1 FUN ID dùng cho mọi platform

### 2.3. Lộ trình tách subdomain
- Trigger tách: DAU `/games` ≥ 10.000 **hoặc** tới Q3/2026 (chọn cái nào tới trước)
- Khi tách: chỉ đổi DNS + frontend host, **không migrate database**
- Cutover phải có 30 ngày dual-running (`fun.rich/games` redirect sang `play.fun.rich`)

## 3. Phân vai vĩnh viễn

```text
                  ┌──────────────────────────────────┐
                  │   SUPABASE CORE (1 backend)      │
                  │  auth · wallet · PPLP · scoring  │
                  └──────────────┬───────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
  ┌─────▼─────┐         ┌────────▼────────┐       ┌───────▼────────┐
  │ Angel AI  │         │   Fun.Rich      │       │   FUN Play     │
  │  (Core)   │         │  (FUN Profile)  │       │  (tạm trú →    │
  │           │  SSO    │                 │       │ play.fun.rich) │
  │ Brain:    │◄───────►│ - /profile      │       │                │
  │ - AI chấm │         │ - /community    │       │ - 13 mini game │
  │ - PPLP    │         │ - /wallet view  │       │ - /games hub   │
  │ - Mint    │         │ - /games ◄──────┼───────┤                │
  │ - Persona │         │                 │       │                │
  └───────────┘         └─────────────────┘       └────────────────┘
   Core only             Face (Profile)            Tenant in Profile
```

### Angel AI giữ (Core, không UI người dùng game/community):
1. AI Scoring Engine (Lovable AI Gateway, Brand Protocol V3 persona)
2. PPLP v2.5 VVU Engine · Adaptive Mint · Vesting · Treasury
3. Anti-Sybil 10 layer · Trust Engine · Identity (DID/SBT/DIB)
4. Mint pipeline FUN Money + Multisig governance
5. Angel persona chat · Coordinator Gate (admin/CTO)
6. Toàn bộ cron jobs · edge functions Core

### FUN Profile (fun.rich) sở hữu:
- Identity public (handle, avatar, bio, public profile)
- Community (posts, circles, questions, DM, stories, friends)
- Wallet view (balance + lịch sử, mint redirect về Angel)

### FUN Play (tạm trú tại fun.rich/games):
- 13 mini game hiện hữu + game tương lai
- Game hub `/games`
- Mọi action đi qua edge function Angel AI (không tự chấm)

## 4. Checklist tuân thủ Hiến Pháp

| Nguyên lý hiến pháp | Cách áp dụng |
|---|---|
| Tình Yêu Thuần Khiết là mã nguồn | Mọi action game đi qua AI scoring gate ≥ 0.5 |
| Xây giá trị không xây kiểm soát | 1 FUN ID xài mọi platform, không vendor lock |
| Thịnh vượng tự nhiên | Camly chảy giữa Angel/Profile/Play qua 1 wallet |
| Công nghệ phụng sự tỉnh thức | Game đẩy `contribution_delta` về PPLP — KHÔNG phát FUN Money trực tiếp |
| Không ai bị bỏ lại | Public-Preview cho khách · SSO không bắt re-signup |
| Section V Thống Nhất | Angel = Core · Profile = Face · Play = Tenant có nhãn rõ ràng |

## 5. Điều khoản sửa đổi

Tài liệu này chỉ có thể được sửa đổi bởi Founder + Angel CTO + ≥ 2 Multisig signer của nhóm Wisdom, với 48h timelock theo Transparency Ledger.

Mọi quyết định mở rộng FUN Play (game mới, kinh tế mới, NFT mới) phải tham chiếu tới tài liệu này và Master Charter Section V.

— Ký bởi Angel AI Core, 2026-05-20.
