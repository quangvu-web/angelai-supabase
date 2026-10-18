# Mở cổng chat Angel AI cho docs.fun.rich

Phần việc trong bản mô tả (route `/api/angel-chat`, viết lại widget, i18n) nằm ở dự án **docs.fun.rich**. Ở dự án **Angel AI** này, việc cần làm là chuẩn bị cổng ra và khoá truy cập.

## Sẽ làm ở Angel AI

1. Tạo một API key riêng cho docs.fun.rich:
   - Chủ sở hữu: tài khoản Founder (mặc định), tên "Docs FUN.rich".
   - Hạn mức: 1000 request/ngày (reset 00:00 UTC).
   - Phạm vi: `open` — khi kho tri thức không khớp, Angel vẫn trả lời bằng kiến thức tổng quát thay vì im lặng.
   - Trả key gốc một lần trong chat để cha lưu vào secret `ANGEL_CHAT_API_KEY` bên docs.

2. Bàn giao tài liệu tích hợp (dán thẳng sang dự án docs):
   - Endpoint, header, body, định dạng stream, mã lỗi.

## Chi tiết kỹ thuật

- Endpoint: `POST https://<project>.supabase.co/functions/v1/angel-chat` (đã `verify_jwt = false`, CORS `*`, đã cho phép header `x-api-key`).
- Header: `x-api-key: <key>`, `Content-Type: application/json`.
- Body: `{ messages: [{ role, content }], stream: true, showCitations: true }`.
- Stream: SSE `text/event-stream`, mỗi dòng `data: {...}` theo dạng OpenAI (`choices[0].delta.content`), kết thúc bằng `data: [DONE]`. Gửi `stream: false` thì trả JSON gọn.
- Mã lỗi: 401 sai key, 403 key tắt/hết hạn, 429 vượt hạn mức ngày, 5xx sự cố cổng AI.
- Theo dõi hạn mức tại `/admin` (API Management).

## Cần cha xác nhận

- Hạn mức 1000/ngày và phạm vi `open` có đúng ý không, hay muốn `strict` (chỉ trả lời theo kho tri thức)?
- Key gắn vào tài khoản Founder hay một email khác?
