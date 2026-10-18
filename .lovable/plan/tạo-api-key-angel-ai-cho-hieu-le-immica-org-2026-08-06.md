# Tạo API key Angel AI cho hieu.le@immica.org

## Xác nhận
Tài khoản `hieu.le@immica.org` đã tồn tại trong hệ thống (tạo ngày 06/08/2026), user id `64ceb17f-…c2c1ac2`.

## Sẽ làm
1. Sinh một API key mới dạng `ak_<prefix>_<random>`, băm SHA-256 và lưu vào bảng khóa API gắn với user trên.
2. Cấu hình: tên "Immica – hieu.le", hạn mức **1000 request/ngày**, trạng thái bật, phạm vi `open` (khi kho tri thức không có dữ liệu, Angel vẫn trả lời bằng kiến thức tổng quát). Nếu muốn chặt chẽ hơn (chỉ trả lời theo kho tri thức) thì đổi sang `strict`.
3. Trả key gốc cho Cha ngay trong chat — key chỉ hiện một lần, hệ thống chỉ lưu bản băm.
4. Kèm tài liệu endpoint + ví dụ request (curl / JavaScript), mô tả chế độ stream và không stream, cùng các mã lỗi (401 sai key, 403 khóa tắt, 429 vượt hạn mức 1000/ngày, reset 00:00 UTC).

## Chi tiết kỹ thuật
- Endpoint: `POST https://<project>.supabase.co/functions/v1/angel-chat`
- Header: `x-api-key: <key>`, `Content-Type: application/json`
- Body: `{ "messages": [{ "role": "user", "content": "..." }], "stream": false }`
- Với `stream: false` trả JSON; mặc định trả SSE `text/event-stream`.
- Hạn mức đếm qua `validate_api_key` + `increment_api_key_usage`, theo dõi tại /admin (API Management).
