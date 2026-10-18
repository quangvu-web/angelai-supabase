# Pronoun Contract — ANGEL AI ↔ FUNPROFILE

Bản quy ước xưng hô giữa dự án **ANGEL AI** (sinh nội dung) và dự án **FUNPROFILE** (proxy hiển thị trên Telegram / FUN.RICH).
Mục tiêu: chấm dứt lỗi ngôi thứ ba tự xưng "Angel" trong prose, đồng bộ trải nghiệm "Angel - bé" trên Telegram.

Phiên bản: v1.0 · Ngày: 2026-07-26 · Chủ trì: Angel CTO

---

## 1. Nguyên tắc chung

Xưng hô **2 lớp** — mỗi lớp có 1 chủ sở hữu duy nhất:

| Lớp | Chủ sở hữu | Cặp xưng hô | Áp dụng khi nào |
|---|---|---|---|
| A — Nội dung gốc | ANGEL AI | `mình` ↔ `bạn` (VI) / `I` ↔ `you` (EN) | Toàn bộ output do LLM sinh, bất kể kênh nào |
| B — Hiển thị Telegram | FUNPROFILE proxy | `Angel` ↔ `bé` | Chỉ khi render vào Telegram của FUN.RICH bot |

Quy tắc bất biến:
- ANGEL AI **KHÔNG BAO GIỜ** tự sinh cặp `Angel - bé` trong output. Nếu sinh sẵn, proxy sẽ nhân đôi rewrite và câu văn hỏng ngôi (ví dụ đã xảy ra: *"cho riêng Angel"*, *"Angel cần tìm lối đi..."*).
- FUNPROFILE **CHỈ** được rewrite ở lớp bề mặt, **không** được rewrite trong quote, code block, hay chuỗi đã chứa sẵn danh từ "Angel".
- Mọi lỗi ngôi xưng phát hiện trên Telegram được điều tra tại **cả 2 lớp** trước khi kết luận.

---

## 2. Trách nhiệm ANGEL AI (Layer A)

Đã ship trong `supabase/functions/_shared/angel-prompts/core.ts` mục `THIRD_PERSON_SELF_BAN`:

Cấm tuyệt đối trong prose (mọi biến thể):
- `Angel <động từ nội tâm/hành động tự thân>`: nghĩ, thấy, cảm thấy, tin, hiểu, biết, nhớ, cần, muốn, sẽ, đang, đã, xin, gửi, chia sẻ, gợi ý, đề xuất, khuyên, mong, hy vọng…
- `<giới từ> Angel`: theo Angel, với Angel, của Angel, cho Angel, từ Angel, cho riêng Angel…
- Tiếng Anh: `Angel thinks / feels / needs / wants / believes…`, `for Angel`, `to Angel`.

Được phép nhắc `Angel` / `Angel AI` trong 3 trường hợp:
1. User hỏi thẳng bot tên gì / là ai → *"Mình là Angel AI, thuộc FUN Ecosystem…"*
2. Câu giới thiệu thương hiệu chính thức → *"Angel AI thuộc FUN Ecosystem"*, *"Founder của Angel AI là Camly Duong"*.
3. Trích lại chính user vừa nói tên Angel (trong dấu ngoặc kép).

Guardrail server-side đã ship trong `supabase/functions/angel-chat/index.ts` — hàm `sanitizePronouns()`:
- Rewrite sau khi model sinh xong, trước khi cache và trước khi trả JSON non-stream.
- Bảo vệ: `Angel AI`, `Angel <TênViếtHoa…>` (Angel Thu Trang, Angel Kim, Angel Quang Vũ…), nội dung trong dấu ngoặc kép.
- Log số lần rewrite vào console (`[pronoun-guard] ... fixes { pattern: n }`) để theo dõi tần suất leak.

---

## 3. Trách nhiệm FUNPROFILE (Layer B)

Chỉ áp dụng khi render vào Telegram của FUN.RICH bot. Trên site chính `angel.fun.rich`, giữ nguyên `mình - bạn`.

### 3.1 Rewrite an toàn

```
\bmình\b        → Angel        (chỉ khi chủ ngữ là bot)
\bbạn\b         → bé
\bMình\b        → Angel
\bBạn\b         → Bé
```

Regex đề xuất (JS):
```js
const RE_MINH = /\bmình\b/g;
const RE_BAN  = /\bbạn\b/g;
```

### 3.2 Cấm rewrite (idempotent guard)

Trước khi rewrite, **skip** đoạn text nếu:
- Đã chứa sẵn `\bAngel\b` (tránh nhân đôi → *"cho riêng Angel"*).
- Nằm trong code block ` ``` … ``` ` hoặc inline code `` ` … ` ``.
- Nằm trong quote `"…"` hoặc `"…"`.
- Là URL, handle `@…`, hoặc địa chỉ ví BSC/BTC.

Gợi ý: chia text thành segment "an toàn để rewrite" và "bảo tồn nguyên trạng" bằng cách tokenize theo code block / quote / URL, chỉ rewrite ở segment an toàn.

### 3.3 Không rewrite các cụm sau (whitelist bảo tồn)

- `mình bảo`, `chính mình`, `của chính mình`, `bên mình` — có thể chuyển thành `chính bé` / `của chính bé` / `bên bé` (tùy chọn, cần bé Vũ chốt).
- `cho riêng mình` → **giữ nguyên** nếu chủ thể là user; hoặc rewrite thành `cho riêng bé` — **KHÔNG BAO GIỜ** thành `cho riêng Angel`.

### 3.4 Test case đối chiếu

| Input từ ANGEL AI (Layer A) | Output kỳ vọng trên Telegram (Layer B) |
|---|---|
| `Mình nghĩ bạn nên nghỉ ngơi.` | `Angel nghĩ bé nên nghỉ ngơi.` |
| `Mình cần tìm lối đi giữa sương mù.` | `Angel cần tìm lối đi giữa sương mù.` |
| `Cho riêng mình, đây là bản đồ bạn tự vẽ.` | `Cho riêng bé, đây là bản đồ bé tự vẽ.` |
| `Angel AI thuộc FUN Ecosystem.` | `Angel AI thuộc FUN Ecosystem.` *(nguyên trạng — đã chứa "Angel")* |
| Trong quote: `"mình yêu bạn"` | `"mình yêu bạn"` *(nguyên trạng — trong quote)* |

---

## 4. Điều kiện tiên quyết trước khi bật rewrite

- [x] ANGEL AI đã ship `THIRD_PERSON_SELF_BAN` trong core prompt.
- [x] ANGEL AI đã ship `sanitizePronouns()` server-side.
- [ ] FUNPROFILE cập nhật hàm rewrite theo mục 3, có unit test cho 5 case ở 3.4.
- [ ] Hai bên cùng chạy 6 regression prompt (mục 5) và pass 100%.

---

## 5. Regression test (Bước 4 của plan)

Chạy trực tiếp trên Telegram bot FUN.RICH, mỗi câu 1 hội thoại mới:

1. *"The hard thing about hard things là gì"* → sau đó *"giải thích sâu hơn"*
2. *"Kể mình nghe về hành trình chuyển hoá"*
3. *"Viết giúp mình một đoạn động viên"*
4. *"Tình yêu là gì"* (user tên chứa "Angel")
5. *"Bé Angel Kim là ai"*
6. *"Cha muốn Angel giới thiệu về bản thân"*

Pass criteria:
- 0 lần xuất hiện `Angel <động từ>` (nghĩ, cần, muốn, thấy…) trong output.
- 0 lần `cho riêng Angel` / `của Angel` / `theo Angel`.
- Tên `Angel AI` chỉ xuất hiện ở câu 6 (giới thiệu) hoặc khi trích thương hiệu.
- Tên riêng user chứa `Angel` (Angel Kim, Angel Thu Trang…) được bảo toàn nguyên trạng.

Cách kiểm tra thống kê phía ANGEL AI: xem console log `[pronoun-guard]` trong Edge Function logs — con số càng gần 0 càng tốt. >5% traffic có rewrite thì cần siết prompt thêm.

---

## 6. Liên hệ

- Chủ trì contract: Angel CTO (dự án ANGEL AI).
- Đối tác proxy: bé Vũ (dự án FUNPROFILE).
- Kênh trao đổi: chat trực tiếp — thay đổi contract cần 2 bên cùng ký.
