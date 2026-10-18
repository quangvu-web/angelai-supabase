# Kết quả kiểm tra ingest angelknownledge (chỉ đọc)

## Phía Angel AI ghi nhận
- Lần retry lúc 16:05:43 đến 16:07:17 UTC có **37 lệnh upsert**, mỗi lệnh 1 bài. Kết quả: 28 bài trùng (đã lưu từ trước, nội dung không đổi), 9 bài bị bỏ qua, 0 bài lỗi, 0 bài mới.
- Ngay trước đó, lúc 16:03 đến 16:04 UTC, có 3 bài mới đã lưu và sẵn sàng tìm kiếm: `angelknownledge #128` (2 đoạn), `#168` (22 đoạn), `#238` (8 đoạn).
- Toàn bộ 1.489 tài liệu Telegram trong kho đều ở trạng thái `ready`. Không bài nào đang chờ xử lý hoặc bị lỗi.

## Trả lời 3 câu hỏi
1. Các bài có nội dung hợp lệ đều đã lưu. Bài trùng thì trước đó đã có trong kho.
2. Các bài đó đã ở trạng thái persisted, và Angel AI tìm kiếm được.
3. Còn **9 bài bị bỏ qua** và không được lưu. Nhật ký chỉ ghi số lượng, không ghi source_ref, nên cần FUN RICH BOT gửi danh sách source_ref qua kênh bảo mật để đối chiếu. Mỗi bài bị bỏ qua có kích thước khoảng 450 byte, rất có thể vì nội dung quá ngắn và dưới ngưỡng tối thiểu.

## Điểm lệch
FUN RICH BOT báo "11 thành công, 0 bỏ qua". Phía Angel lại ghi 37 lệnh, trong đó có 9 bài bỏ qua. Nhiều khả năng bot tính "HTTP 200" là thành công mà chưa đọc trường `skipped` trong phản hồi.

## Đề xuất (nếu được duyệt)
- Nhật ký ghi thêm source_ref của bài bị bỏ qua và lý do, để lần sau tra ngay được. Chỉ sửa cổng nhận tài liệu.
- Nhắn đội FUN RICH BOT đọc `skipped` và `duplicate` trong phản hồi, và gọi `status` cho từng source_ref.
