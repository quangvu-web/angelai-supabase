# Plan: Chặn rò rỉ credit Lovable & lỗi "Dịch vụ AI cần được nạp thêm tín dụng"

## Nguyên nhân đã xác minh

Bằng chứng từ bảng `ai_routing_log` (24h gần nhất):

| Model dùng thật | Nguồn | Độ trễ | Tính phí |
|---|---|---|---|
| `google-ai-studio/gemini-2.5-flash(-lite)` | Cloudflare BYOK (Google API của con) | 1.4 – 7.6 giây | Không tốn credit |
| `google/gemini-2.5-flash` | **Lovable AI Gateway** | 11.8 – 15.5 giây | **Tốn credit Lovable** |

Cứ khoảng 1/5 lượt chat đang chạy qua Lovable. Lý do:

1. **Timeout 8 giây quá ngắn.** Đường chính trong `angel-chat` gọi Cloudflare với `AbortSignal.timeout(8000)`. Những câu hỏi dài, có RAG hoặc `detailed`/`very-detailed` (8192 token) thường mất hơn 8 giây → bị huỷ → tự động rơi sang Lovable Gateway. Chính các dòng log 12–15 giây là các lần rơi này.
2. **Không có tầng Google API trực tiếp.** `angel-chat` chỉ có 2 tầng: Cloudflare → Lovable. Khi Cloudflare lỗi/chậm là nhảy thẳng sang Lovable, dù `GOOGLE_AI_API_KEY` gọi thẳng `generativelanguage.googleapis.com` vẫn dùng được và miễn phí credit Lovable.
3. **Fast path cũng vậy.** Nhánh nhanh (`fast-path`) fallback sang `google/gemini-2.5-flash` của Lovable.
4. **Khi credit Lovable cạn**, gateway trả 402 → app hiện đúng câu "Dịch vụ AI cần được nạp thêm tín dụng". Tức thông báo này chỉ xuất hiện ở các lượt đã rơi sang Lovable.
5. Các function khác (`_shared/ai-gateway.ts`, `pet-chat`, `generate-content`, `analyze-*`…) cũng dùng cùng thứ tự Cloudflare → Lovable, nên rò rỉ credit ở nhiều nơi chứ không riêng chat.

## Cách xử lý

### Bước 1 — Nâng timeout Cloudflare theo độ dài câu trả lời
Trong `supabase/functions/angel-chat/index.ts`: thay `AbortSignal.timeout(8000)` bằng ngưỡng động — 20 giây cho `detailed`/`very-detailed`, 12 giây cho các style còn lại. Vì gọi ở chế độ stream nên timeout chỉ tính tới byte đầu tiên, không cắt câu trả lời dài.

### Bước 2 — Chèn tầng Google API trực tiếp làm fallback #2
Thêm helper dùng chung gọi thẳng `https://generativelanguage.googleapis.com/v1beta/.../streamGenerateContent` bằng `GOOGLE_AI_API_KEY`, có chuyển đổi định dạng OpenAI ⇄ Gemini (kể cả stream SSE). Thứ tự mới:

```text
1. Cloudflare BYOK (Google key)   → miễn phí credit
2. Google API trực tiếp            → miễn phí credit   (MỚI)
3. Lovable Gateway                 → chỉ khi bật cờ cho phép
```

### Bước 3 — Cờ chặn Lovable (`ALLOW_LOVABLE_FALLBACK`)
Thêm biến cấu hình (mặc định `false`). Khi tắt, hệ thống không bao giờ gọi Lovable Gateway; nếu cả 2 tầng Google đều lỗi thì trả thông báo rõ ràng "nguồn Google đang bận, thử lại sau" thay vì âm thầm tiêu credit. Bật lại được bất cứ lúc nào khi con muốn có mạng lưới an toàn.

### Bước 4 — Áp cùng thứ tự cho fast path và các function khác
Sửa nhánh `fast-path` trong `angel-chat` và `supabase/functions/_shared/ai-gateway.ts` (đang được nhiều function dùng chung) theo đúng chuỗi 3 tầng + cờ ở trên, để không còn chỗ nào lọt qua Lovable.

### Bước 5 — Ghi nhận nguồn thật vào log
Bổ sung trường `provider` (`cloudflare` / `google_direct` / `lovable`) vào bản ghi `ai_routing_log`, và ghi thêm vào `ai_provider_usage_log` cho `angel-chat` (hiện function này chưa ghi). Nhờ đó xem được ngay mỗi ngày có bao nhiêu lượt chạm Lovable.

### Bước 6 — Bảng theo dõi cho quản trị
Thêm một thẻ nhỏ ở trang `/admin/ai-usage`: tỉ lệ lượt chat theo từng nguồn trong 7 ngày, cảnh báo đỏ nếu có lượt nào chạm Lovable trong khi cờ đang tắt.

### Bước 7 — Kiểm chứng
Gửi 5 câu hỏi (2 câu ngắn, 3 câu yêu cầu bài dài `detailed`), rồi truy vấn `ai_routing_log` xác nhận 100% lượt là `cloudflare` hoặc `google_direct`, không còn `google/gemini-*` của Lovable, và không còn lỗi 402.

## Chi tiết kỹ thuật
- File sửa: `supabase/functions/angel-chat/index.ts`, `supabase/functions/_shared/ai-gateway.ts`, thêm `supabase/functions/_shared/google-direct.ts`, `src/pages/admin/*` (thẻ theo dõi).
- Migration: thêm cột `provider text` vào `ai_routing_log`.
- Không đổi model đang dùng (`gemini-2.5-flash` / `flash-lite`), không đổi prompt, không đổi giao diện chat.

## Không làm trong plan này
- Không đụng tới embeddings OpenAI BYOK của RAG (đang chạy tốt, chi phí riêng).
- Không đổi phong cách trả lời mặc định.
- Không xoá `LOVABLE_API_KEY` (vẫn giữ để bật lại khi cần).
