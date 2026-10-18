# Cấp khoá ingest riêng cho FUN RICH BOT

## Kết quả kiểm tra (đã đọc code)
- Endpoint: `POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/knowledge-external-ingest`, `Content-Type: application/json`. Chỉ có một môi trường (production), dùng chung cho cả bản xem trước.
- Xác thực: header `x-api-key`. Hiện chỉ có **một khoá dùng chung** (secret `ANGEL_KNOWLEDGE_INGEST_KEY`), so khớp nguyên chuỗi. Sai hoặc thiếu khoá → `401 {"error":"unauthorized"}`, và lỗi này **không được ghi vào nhật ký kiểm tra**.
- Vì vậy lỗi 401 của FUN RICH BOT có nghĩa là giá trị bot gửi **không khớp** khoá hiện tại. Có thể bot chưa từng nhận khoá, dùng khoá cũ, hoặc gắn sai tên header (ví dụ gửi `Authorization` thay cho `x-api-key`). Khoá này dùng được cả upsert, status và delete, không chia quyền.
- Giá trị khoá hiện tại không xem lại được. Nếu đổi khoá chung thì FUN Profile sẽ bị gián đoạn, nên cách an toàn là **cấp khoá riêng** cho bot.

## Việc sẽ làm
1. Cho cổng nhận thêm một khoá riêng tên `ANGEL_KNOWLEDGE_INGEST_KEY_FUNRICHBOT`. Khoá chung cũ giữ nguyên, FUN Profile không bị ảnh hưởng.
2. Ghi vào nhật ký mỗi lần xác thực thất bại, gồm thời điểm, 4 ký tự đầu của khoá và tên header nhận được. Không ghi giá trị khoá. Nhờ vậy lần sau tra được ngay nguyên nhân 401.
3. Nhật ký thành công ghi rõ khoá của client nào đã gọi (`fun_profile` hoặc `fun_rich_bot`).
4. Mở ô nhập bảo mật để bạn dán khoá mới. Bạn tự tạo một chuỗi ngẫu nhiên mạnh (`openssl rand -hex 32`) rồi dán cùng một giá trị vào hai nơi: ô nhập bên này và Supabase Secrets của project `xoiceivuqbxnmpfdiklg`. Không gửi giá trị này qua chat.
5. Kiểm tra bằng lệnh gọi `status` (không ghi dữ liệu) để xác nhận khoá sai trả về 401 và khoá đúng được chấp nhận.

## Gửi lại đội FUN RICH BOT sau khi xong
- Header: `x-api-key: <ANGEL_KNOWLEDGE_INGEST_KEY_FUNRICHBOT>`. Chỉ gọi từ máy chủ.
- Kiểm tra trạng thái (không ghi dữ liệu):
  `{"action":"status","source":"telegram","source_refs":["<ref>"]}`. Kết quả trả về `status` là một trong `persisted`, `pending`, `processing`, `failed` hoặc `missing`.
- Đẩy bài: `{"action":"upsert","documents":[{source, source_ref, title, content, url?, folder?, metadata?}],"options":{"chunk_now":false}}`. Giới hạn: tối đa 200 bài mỗi lần, 200.000 ký tự mỗi bài, 60 lần gọi mỗi phút. Sau khi upsert, gọi lại `status` để xác nhận bài đã lưu.

## Rollback
Xoá secret `ANGEL_KNOWLEDGE_INGEST_KEY_FUNRICHBOT` là khoá của bot mất hiệu lực ngay. Khoá chung không thay đổi.
