# Cấp endpoint + khoá Angel AI cho funprofile-production

## Thông tin dùng ngay (không cần duyệt)

```
ANGEL_AI_CHAT_URL = https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/angel-chat
```

Cách gọi từ Edge Function bên funprofile-production:

- Method: `POST`
- Header: `x-api-key: <ANGEL_AI_API_KEY>`, `Content-Type: application/json`
- Body: `{ "messages": [{ "role": "user", "content": "..." }], "stream": true, "showCitations": true }`
- Stream: SSE `text/event-stream`, mỗi dòng `data: {...}` theo định dạng OpenAI (`choices[0].delta.content`), kết thúc bằng `data: [DONE]`. Gửi `stream: false` thì nhận JSON gọn.
- Mã lỗi: 401 sai khoá, 403 khoá tắt/hết hạn, 429 vượt hạn mức ngày, 5xx sự cố nguồn AI.
- Endpoint đã bật CORS và không yêu cầu JWT; chỉ xác thực bằng `x-api-key`.

## Việc cần duyệt: tạo khoá mới

Tạo một dòng khoá riêng trong bảng `user_api_keys`:

- Tên: "FUN Profile Production"
- Hạn mức: 1000 lượt/ngày
- Phạm vi: `open` (khi kho tri thức không khớp, Angel vẫn trả lời bằng kiến thức tổng quát)
- Chủ sở hữu: tài khoản Founder hiện đang dùng cho các khoá dịch vụ

Hệ thống chỉ lưu bản băm SHA-256, nên giá trị gốc sẽ hiện **một lần duy nhất** trong chat ngay sau khi tạo — dán thẳng vào Edge Function Secrets của funprofile-production với tên `ANGEL_AI_API_KEY`.

## Không đụng tới

Không sửa code, Edge Function, RLS, RPC hay cấu hình nào khác. Không publish. Khoá của docs.fun.rich và urantia.fun.rich giữ nguyên; tắt/đổi khoá mới không ảnh hưởng chúng.

## Thu hồi

Tắt riêng dòng khoá này (`is_active = false`) là ngắt truy cập của funprofile-production, các site khác không bị ảnh hưởng.
