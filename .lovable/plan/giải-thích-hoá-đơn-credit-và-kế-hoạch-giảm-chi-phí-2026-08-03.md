# Giải thích hoá đơn credit và kế hoạch giảm chi phí

## Con đang tốn credit vào đâu (đọc từ ảnh)

| Hạng mục | 30 ngày | Thực chất là gì |
|---|---|---|
| Database server | 7,43 | Tiền **thuê máy chủ chạy 24/7** (CPU + RAM), tính theo giờ bật máy — không tính theo số câu truy vấn |
| Database storage | 0 | Dung lượng lưu trữ, hiện 1.475 MB — vẫn nằm trong mức miễn phí |
| AI | 1,32 | Các lượt gọi qua AI Gateway của Lovable |
| Network / Storage / Realtime / Compute khác | phần nhỏ còn lại | Băng thông và edge function |
| **Tổng** | **9,65** | Trong đó ~77% là tiền thuê máy chủ |

Điểm quan trọng: **Database KHÔNG "ngốn" vì truy vấn nhiều.** 7,43 credit đó là phí thuê máy tính theo giờ. Máy bật cả tháng thì tính cả tháng, dù có ai dùng hay không. Biểu đồ chỉ hiện 3 cột (31/7 – 2/8) vì trước đó Cloud đang tạm dừng nên không phát sinh giờ chạy — nay chạy lại thì mỗi ngày đều đặn ~3 credit.

Phần AI 1,32 credit: kiểm tra `ai_routing_log` 7 ngày gần nhất cho thấy 118 lượt `cloudflare`, 4 lượt `google_direct`, **0 lượt `lovable`** — tức khoá luồng Google đang có hiệu lực. 756 lượt cũ chưa có nhãn provider (ghi trước khi thêm cột). Phần AI còn lại đến từ các chỗ chưa đi qua luồng khoá: sinh ảnh, embedding, và các edge function nền.

## Vì sao máy chủ phải chạy liên tục ở mức này

Dự án có **31 cron job đang bật**, trong đó dày nhất:
- `angel-chat-warm-pool` — 2 phút/lần (≈720 lượt/ngày)
- `knowledge-ingest-every-5min` — 5 phút/lần (≈288 lượt/ngày)
- `connector-indexer` + `sbt-auto-mint` + `pplp-batch-processor` — mỗi 15 phút/1 giờ
- Cùng loạt job 6 giờ/ngày/tuần/tháng

Chúng giữ máy chủ luôn có việc, nên không bao giờ hạ được về mức nghỉ.

## Kế hoạch giảm chi phí (theo thứ tự hiệu quả)

### Bước 1 — Giảm nhịp các cron job dày đặc
- `angel-chat-warm-pool`: 2 phút → 15 phút, hoặc tắt hẳn (chỉ để giảm độ trễ lượt chat đầu, không ảnh hưởng tính năng).
- `knowledge-ingest-every-5min`: 5 phút → 30 phút; hàng chờ ingest hiện đã xử lý xong nên không cần quét dày.
- `connector-indexer`: 15 phút → 1 giờ.
- Kiểm tra và tắt các job đã hết vai trò (backfill, sync một lần).

### Bước 2 — Xem lại kích thước máy chủ
Kiểm tra mức bão hoà CPU/RAM/kết nối. Nếu máy đang dư nhiều, hạ một bậc kích thước sẽ cắt trực tiếp phần 7,43 credit — đây là đòn bẩy lớn nhất.

### Bước 3 — Dọn bảng log phình to
Rà các bảng log (`ai_routing_log`, `rag_health_events`, audit…), thêm job xoá dữ liệu cũ hơn 60–90 ngày để giữ 1,4 GB không tăng thêm và giảm tải I/O.

### Bước 4 — Gán nhãn provider cho phần AI còn lại
Bổ sung ghi `provider` ở các đường sinh ảnh/embedding để nhìn rõ 1,32 credit AI đến từ chức năng nào, rồi chuyển tiếp sang nguồn Google nếu có thể.

### Bước 5 — Bảng theo dõi
Thêm vào `/admin/ai-usage` một dòng tóm tắt: số cron chạy/ngày và dung lượng các bảng log lớn nhất, để thấy ngay khi có thứ gì tăng bất thường.

## Chi tiết kỹ thuật
- Đổi nhịp cron bằng migration `cron.alter_job` / `cron.schedule` (không xoá job).
- Thêm job dọn log kèm chỉ mục theo `created_at`.
- Hạ kích thước máy chủ thực hiện qua công cụ resize, có bước xác nhận riêng.

## Không làm trong plan này
- Không tắt tính năng nào của người dùng.
- Không đụng tới khoá luồng Google (đang chạy đúng).
- Không đổi model AI.
