# Chuyển khoá "Docs FUN.rich" sang trang73790104@gmail.com

## Xác nhận hiện trạng
- Tài khoản `trang73790104@gmail.com` đã tồn tại (tạo 19/01/2026), hiện chưa có khoá API nào.
- Khoá "Docs FUN.rich" (`ak_docsf…`, 1000 request/ngày, scope `open`, đang bật) hiện gắn với tài khoản Founder.

## Sẽ làm
1. Vô hiệu hoá khoá `ak_docsf…` đang gắn Founder (giữ lịch sử dùng, không xoá).
2. Sinh khoá mới `ak_<prefix>_<random>`, băm SHA-256, lưu gắn với `trang73790104@gmail.com`:
   - Tên: "Docs FUN.rich"
   - Hạn mức: 1000 request/ngày (reset 00:00 UTC)
   - Phạm vi: `open`
3. Trả khoá gốc một lần trong chat để cha lưu vào secret `ANGEL_CHAT_API_KEY` bên docs.fun.rich.
4. Kèm lại tài liệu tích hợp (endpoint, header, body, stream, mã lỗi).

## Chi tiết kỹ thuật
- Endpoint: `POST https://<project>.supabase.co/functions/v1/angel-chat` (verify_jwt = false, CORS `*`, cho phép header `x-api-key`).
- Header: `x-api-key: <key>`, `Content-Type: application/json`.
- Body: `{ messages: [{ role, content }], stream: true, showCitations: true }`.
- Stream SSE dạng OpenAI, kết thúc `data: [DONE]`; `stream: false` trả JSON gọn.
- Mã lỗi: 401 sai key · 403 key tắt/hết hạn · 429 vượt hạn mức · 5xx sự cố cổng AI.
- Theo dõi hạn mức tại /admin → API Management.

## Lưu ý
Khoá cũ `ak_docsf…` sẽ ngừng hoạt động ngay sau khi tắt — cần thay khoá mới bên docs.fun.rich để chat không gián đoạn.
