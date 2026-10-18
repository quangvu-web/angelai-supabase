# Plan: Khắc phục tin nhắn Angel AI bị cắt ngắn giữa chừng

## Tóm tắt vấn đề
Người dùng phản ánh nhiều tin nhắn của Angel AI bị cắt ngắn khi chưa nói hết ý (ví dụ: dừng lại ở "một t" trong một bài "PHẦN I — THE VISION..."). Hiện tại hệ thống **đã có cấu hình giới hạn token đầu ra** (`max_tokens`), nhưng vẫn xảy ra tình trạng cắt cụt.

## Trạng thái hiện tại đã xác nhận
- `src/pages/Chat.tsx`: gửi `responseStyle: userResponseStyle || 'detailed'`.
- `src/pages/Profile.tsx`: mặc định `responseStyle` là `"detailed"`.
- `supabase/functions/angel-chat/index.ts`:
  - `RESPONSE_STYLES.detailed.maxTokens = 8000`.
  - Main path truyền `max_tokens: styleConfig.maxTokens` (tức 8000 cho detailed).
  - Fast path truyền `max_tokens: styleConfig?.maxTokens ?? 1024` (cũng 8000 khi có style).
- `supabase/functions/_shared/ai-gateway.ts`: fallback default `max_tokens = 1024` khi không truyền `maxTokens`.
- `supabase/functions/angel-router/index.ts`: không set `max_tokens`, để model tự quyết định.

## Nguyên nhân nghi ngờ
1. **Provider clamp / reject `max_tokens` cao**: Cloudflare BYOK (`google-ai-studio/gemini-2.5-flash`) hoặc Lovable fallback (`google/gemini-2.5-flash`) có thể clamp hoặc không hỗ trợ đầy đủ 8000 tokens, đặc biệt nếu request đi qua gateway compat.
2. **Edge Function / gateway timeout**: Stream dài bị đóng sớm do Supabase Edge Function hoặc Cloudflare Worker timeout.
3. **Model tự dừng (finish_reason = stop)**: Prompt yêu cầu "dài" nhưng model vẫn dừng sớm do cấu trúc câu hoặc không nhận ra cần tiếp tục.
4. **Frontend parse stream**: Có thể bỏ lỡ phần cuối nếu stream bị ngắt đột ngột hoặc `[DONE]` đến sớm.
5. **Fast path áp dụng sai**: Câu hỏi ngắn (<80 ký tự) đi fast path với `gemini-2.5-flash-lite` / `gemini-3.6-flash`, có output limit thấp hơn.

## Các bước thực hiện

### Bước 1: Thêm observability để xác định nguyên nhân thực sự
- Thêm cột `finish_reason` (text) vào `ai_routing_log`.
- Trong `angel-chat/index.ts`, khi stream kết thúc hoặc non-stream response trả về, ghi lại `finish_reason` (ví dụ: `choices[0].finish_reason` hoặc từ SSE event cuối).
- Thêm cột `truncated_hint` (boolean) để đánh dấu nếu response kết thúc bằng dấu câu chưa trọn vẹn hoặc finish_reason = length.
- Viết truy vấn kiểm tra 50 log gần nhất để xem tokens_out và finish_reason phân bố như thế nào.

### Bước 2: Kiểm tra và điều chỉnh `max_tokens` theo từng provider/model
- Xác minh output token limit của:
  - `google-ai-studio/gemini-2.5-flash` qua Cloudflare BYOK.
  - `google/gemini-2.5-flash` qua Lovable Gateway.
  - `google/gemini-3.6-flash` (lovable fast fallback).
- Nếu provider hỗ trợ 8192, nâng `detailed.maxTokens` từ 8000 → 8192.
- Nếu provider clamp thấp hơn (ví dụ 4096), điều chỉnh `detailed.maxTokens` xuống mức an toàn và bù bằng cơ chế "continue".
- Đảm bảo `ai-gateway.ts` shared helper cũng nhận `maxTokens` đúng, không để fallback 1024 bất ngờ.

### Bước 3: Cơ chế tự động "tiếp tục" khi bị cắt
- Sau khi stream kết thúc, nếu `finish_reason === "length"` hoặc response kết thúc không trọn vẹn (không có dấu kết thúc câu / đoạn), tự động gọi một lần nữa với prompt:
  - `"Tiếp tục hoàn thiện câu trả lời từ đoạn sau: \"...<last 200 chars>\""`.
- Giới hạn tối đa 1 lần continue để tránh loop tốn credit.
- Append phần tiếp theo vào cùng một assistant message trong UI.

### Bước 4: Cải thiện prompt và response style
- Trong `detailed` style instruction, thêm rõ ràng:
  - "Luôn kết thúc bằng một câu đầy đủ. Nếu cần nhiều hơn 1 phần, hãy viết đủ đến kết luận trong phạm vi cho phép."
- Thêm một style mới `"very-detailed"` với `maxTokens` cao nhất cho người dùng muốn bài dài thực sự.
- Cập nhật `concise` style để phù hợp với yêu cầu mặc định ~100 từ (nếu user chọn concise).

### Bước 5: Cải thiện frontend
- Trong `src/pages/Chat.tsx`:
  - Khi stream kết thúc, kiểm tra nếu `assistantContent` kết thúc bất thường (không có dấu kết thúc câu, dừng giữa từ) thì hiển thị badge nhỏ "Có thể chưa hoàn chỉnh".
  - Thêm nút "Tiếp tục" cho phép user chủ động yêu cầu Angel AI nối tiếp.
- Đảm bảo parse SSE không bỏ sót phần cuối do `textBuffer` chưa flush hết khi `done`.

### Bước 6: Kiểm tra fast path
- Trong `angel-chat/index.ts`, nếu `responseStyle === 'detailed'` hoặc `'very-detailed'`, **bỏ qua fast path** và luôn dùng model đầy đủ (`gemini-2.5-flash`) để có output limit cao nhất.
- Nếu vẫn dùng fast path, giới hạn `max_tokens` của fast path theo model cụ thể (`flash-lite` / `3.6-flash`), không dùng 8000.

### Bước 7: Test và xác nhận
- Gửi 3-5 câu hỏi yêu cầu bài dài (ví dụ: "Giải thích chi tiết tầm nhìn của FUN Ecosystem") với style `detailed`.
- Kiểm tra log `ai_routing_log`: `tokens_out` và `finish_reason`.
- Xác nhận response không còn bị cắt giữa chừng.

## Ảnh hưởng
- `supabase/functions/angel-chat/index.ts`: thêm logic continue, log finish_reason, điều chỉnh fast path.
- `supabase/functions/_shared/ai-gateway.ts`: đảm bảo `maxTokens` được tôn trọng.
- `src/pages/Chat.tsx`: thêm UI indicator và nút continue.
- Database: migration thêm cột `finish_reason` và `truncated_hint` vào `ai_routing_log`.

## Không làm trong plan này
- Không đổi model mặc định sang OpenAI (tốn credit Lovable).
- Không thêm caching mới.
- Không thay đổi response style mặc định của người dùng (vẫn là detailed).
