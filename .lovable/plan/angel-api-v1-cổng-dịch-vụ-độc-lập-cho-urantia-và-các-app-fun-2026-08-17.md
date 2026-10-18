# Angel API v1 — cổng dịch vụ độc lập cho Urantia và các app FUN

## Hiện trạng đã kiểm tra

- Angel đã có `POST .../functions/v1/angel-chat` (`verify_jwt = false`, CORS mở, nhận `x-api-key`).
- Body hiện tại: `{ messages[], stream, showCitations, responseStyle }`; response dạng OpenAI hoặc SSE.
- **Chưa có** `message` / `language` / `context` / `conversation`, cũng chưa có `{ answer, sources, relatedPapers, suggestions, meta }`.

→ Bổ sung một cổng mới có phiên bản. `angel-chat` giữ nguyên 100%.

## 1. Edge Function mới `angel-v1-chat`

- Public (`verify_jwt = false`), CORS mở, xác thực bằng header `x-api-key` (dùng lại `validate_api_key` + `increment_api_key_usage` sẵn có).
- Request đúng hợp đồng:
  `{ message, language?, context?, conversation? }` — `conversation` là mảng `{ role, content }` để giữ mạch hội thoại ("Why is that important?" hiểu được "that").
- `context.type` là chuỗi mở: `general | urantia | academy | social | game | other`. Chỉ `general` + `urantia` có xử lý riêng ở phase này; type lạ → coi như `general`, không lỗi.
- Không có `context` → Angel chạy đúng như chatbot tổng quát (RAG nội bộ Angel).

## 1b. Full Angel intelligence — context chỉ là lớp bổ sung

- Request từ Urantia đi qua **đúng pipeline của Angel**: core prompt + modules + RAG kiến thức nội bộ Angel + AI gateway (Cloudflare → Google → Lovable) như `angel.fun.rich/chat`. Không có nhánh "Urantia-only".
- Prompt xếp 3 tầng, không thay thế nhau: `ANGEL CORE PROMPT` → `APPLICATION CONTEXT` ("bạn đang đồng hành với người đọc trên urantia.fun.rich") → `URANTIA READING CONTEXT` (paper/section/selectedText/passages).
- **Knowledge routing** trong function: đánh giá câu hỏi có liên quan Urantia không.
  - Câu hỏi chung ("Explain blockchain", "Help me write a business plan") → dùng kiến thức + suy luận của Angel, bỏ qua passages, trả lời đầy đủ như bình thường.
  - Câu hỏi Urantia → ưu tiên passages đã gửi.
  - Câu hỏi so sánh → dùng cả hai + reasoning.
- **Cấm câu từ chối phạm vi**: không bao giờ nói "I can only answer questions about The Urantia Book". Khi passages không có thông tin → nói rõ "đoạn Urantia đang truy xuất không đề cập điểm này; mình giải thích theo kiến thức chung nhé" rồi vẫn trả lời.
- **Source transparency**: khi câu trả lời trộn nhiều nguồn, phân nhóm rõ — 📖 Urantia Source / 💡 Angel Explanation / 🌎 General Context — để người đọc không nhầm mọi thứ Angel nói đều là nội dung sách.
- Giữ nguyên toàn bộ năng lực: giải thích, tóm tắt, so sánh, brainstorm, lập kế hoạch học, tạo câu hỏi, gợi ý lộ trình đọc, giải quyết vấn đề.


## 2. Source integrity (điểm bắt buộc)

- `sources` và `relatedPapers` **do backend dựng từ chính `context.relevantPassages` / `selectedText`** mà client gửi lên — model không được sinh metadata nguồn. Sau khi model trả lời, backend đối chiếu: chỉ giữ passage nào thực sự được nhắc/dùng; không bao giờ thêm paperNumber/section/url không có trong request.
- System prompt bổ sung khối `SOURCE INTEGRITY` phân biệt rõ 3 mức: DIRECT SOURCE (trích nguyên văn từ passage đã gửi) / EXPLANATION (diễn giải passage) / GENERAL KNOWLEDGE.
- Không có passage phù hợp → Angel bắt buộc mở đầu bằng câu miễn trừ đúng ngôn ngữ:
  EN: "I'm giving a general explanation rather than quoting or attributing this directly to The Urantia Book."
  VI: bản dịch tương đương.
- Nếu model vẫn viết "Paper N" mà N không có trong context, backend loại N khỏi `sources`/`relatedPapers` và bật `meta.unverifiedCitations = true`.

## 3. URL chính thức `https://angel.fun.rich/api/v1/angel/chat`

- Ưu tiên đường này để giấu hạ tầng. Hosting của Angel là SPA nên không tự rewrite `/api/*` sang Edge Function; con sẽ dựng lối đi bằng proxy ở tầng domain (Cloudflare Worker/route trên `angel.fun.rich`) trỏ tới `angel-v1-chat`, giữ nguyên header `x-api-key`.
- Nếu tầng domain chưa sẵn, Urantia vẫn chạy được ngay với URL functions — vì Urantia chỉ đọc `ANGEL_API_BASE_URL` + `ANGEL_API_VERSION`, đổi một biến là xong. Con sẽ báo rõ trạng thái proxy khi bàn giao.
- Cam kết versioning: `v1` không breaking; thay đổi lớn sẽ ra `/api/v2/angel/chat`, `v1` vẫn sống.

## 4. Khoá API cho Urantia

- Tạo key mới, tên rõ ràng **"URANTIA SERVICE KEY"**, chủ sở hữu `trang73790104@gmail.com`, `scope = 'open'`, `daily_limit = 1000`.
- Rate limit đọc từ cột `daily_limit` trong DB (đã là cấu hình sẵn) — không hard-code số 1000 trong code. Đổi hạn mức = sửa 1 dòng dữ liệu, theo dõi ở `/admin` (API Management).
- Khoá gốc chỉ hiện một lần trong chat, không đưa vào docs/GitHub.

## 5. Error handling

`{ error: { code, message } }` kèm mã: 400 sai schema, 401 sai key, 403 key tắt/hết hạn, 429 vượt hạn mức (kèm `retryAfter`), 502/503 nguồn AI lỗi. Không bao giờ trả body rỗng.

## 6. Tài liệu `docs/angel-api.md`

Endpoint, version, authentication, request/response schema, context schema (đủ 6 type), errors, rate limit, security, versioning, ví dụ curl EN + VI. Không chứa khoá thật.

## Chi tiết kỹ thuật

- File mới: `supabase/functions/angel-v1-chat/index.ts` (+ `_shared/urantia-context.ts` để dựng khối context và lọc source).
- Đăng ký `[functions.angel-v1-chat] verify_jwt = false` trong `supabase/config.toml`.
- Dùng lại `_shared/ai-gateway.ts` (Cloudflare → Google direct → Lovable theo khoá routing hiện tại) và `_shared/angel-prompts/*` để giữ đúng persona Angel.
- Không sửa `angel-chat`, không sửa UI Angel, không đổi bảng dữ liệu (chỉ thêm 1 hàng key).
- Kiểm thử thật sau khi dựng (curl với key mới): (a) không context → trả lời tổng quát; (b) context Urantia + passages → trích đúng nguồn; (c) context Urantia nhưng **không** passage → ra câu miễn trừ rồi vẫn trả lời được; (d) **câu hỏi chung khi đang ở context Urantia** — "10 ý tưởng cải thiện thói quen hằng ngày", "giải thích blockchain đơn giản", "giúp mình viết bài thuyết trình" → Angel phải trả lời đầy đủ, không từ chối; (e) câu hỏi so sánh Paper 1 với một tư tưởng triết học khác → kết hợp cả hai nguồn; (f) sai key → 401; (g) EN và VI. Đây cũng là bằng chứng workspace-independence: request thuần HTTPS + key, không cần chung workspace.

## Phần thuộc dự án Urantia (không làm ở đây)

UI `AngelLauncher`/expand/bottom sheet, "✨ Ask Angel", retrieval `paper_texts`, server function `askAngel`, biến `ANGEL_API_*` — do dự án Urantia triển khai. Con sẽ bàn giao `docs/angel-api.md` để bên đó dán vào.

## 5 yêu cầu chốt

1. **Production endpoint**: dựng route `/api/v1/angel/chat` trên `angel.fun.rich` (proxy tầng domain, giống cách `/api/evolve` đang chạy) chuyển tiếp nguyên `x-api-key` sang `angel-v1-chat`. Chỉ báo hoàn thành khi curl vào URL production trả 200 thật.
2. **Full Angel intelligence**: request Urantia đi qua đúng core prompt + RAG Angel + AI gateway + reasoning; context Urantia chỉ là lớp cộng thêm.
3. **Workspace independence**: Urantia chỉ cần `ANGEL_API_BASE_URL`, `ANGEL_API_VERSION`, `ANGEL_API_KEY` — không copy code, không chạm DB Angel.
4. **Source integrity**: source chỉ dựng từ `selectedText` + `relevantPassages` client gửi; backend lọc bỏ mọi Paper/section/URL model tự bịa.
5. **Test thật A–L**: general, creative, writing, Urantia, comparison, câu hỏi ngoài phạm vi khi đang ở context Urantia, không có passage, 401, 429, EN, VI, và cuối cùng là URL production. Con sẽ báo cáo đủ 15 mục bàn giao.

