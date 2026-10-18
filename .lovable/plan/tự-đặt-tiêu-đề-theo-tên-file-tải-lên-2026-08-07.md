# Tự đặt tiêu đề theo tên file tải lên

## Hiện trạng (đã kiểm chứng)

- 2.270 tài liệu đang hoạt động, trong đó 1.398 tài liệu có tiêu đề trùng tên file.
- Ở `/admin/knowledge`, tiêu đề chỉ tự điền khi chọn file bằng nút "Chọn file"; nếu tải nhiều file hoặc admin sửa rồi xoá thì tiêu đề có thể để trống.
- Ingest URL/Google Doc đặt tiêu đề dạng "Google Docs - 07/08/2026", không mang tên tài liệu.

## Mục tiêu

Hệ thống **tự đặt tiêu đề = tên file tải lên** (bỏ đuôi, làm sạch), admin không phải gõ tay. Vẫn cho phép sửa tiêu đề nếu muốn.

## Quy tắc làm sạch tên file

- Bỏ phần đuôi mở rộng (`.docx`, `.pdf`, `.txt`…).
- Đổi `_`, `-`, `.` thừa thành khoảng trắng; gộp khoảng trắng đôi.
- Bỏ tiền tố/hậu tố kỹ thuật thường gặp: dãy số timestamp, `copy`, `final`, `(1)`, `v2`.
- Cắt tối đa 300 ký tự, viết hoa chữ cái đầu.

Ví dụ: `KHOA_THIEN_DU_HANH_VU_TRU-final(1).docx` → `KHOA THIEN DU HANH VU TRU`.

## Việc sẽ làm

1. **Hàm dùng chung** `titleFromFileName(name)` áp dụng quy tắc trên.
2. **Form upload `/admin/knowledge`**:
   - Tự điền tiêu đề mỗi khi chọn file (kể cả khi ô đang có sẵn nội dung cũ do phiên trước).
   - Nếu admin để trống tiêu đề khi bấm Tải lên → tự lấy theo tên file thay vì báo lỗi.
   - Nhãn gợi ý: "Để trống — hệ thống tự đặt theo tên file".
3. **Luồng ingest URL/Google Doc**: nếu không có tiêu đề, ưu tiên `<title>` của trang; nếu vẫn trống thì lấy tên file/đường dẫn cuối của URL thay cho chuỗi "Google Docs - ngày".
4. **Luồng nạp qua API/Telegram**: khi payload thiếu `title`, tự suy ra từ `file_name`.
5. **Nút "Đặt lại tiêu đề theo tên file"** ở từng tài liệu và ở chế độ chọn nhiều, để dọn các tiêu đề cũ lộn xộn. Tiêu đề cũ lưu vào `metadata.previous_title`.
6. Tài liệu đổi tiêu đề sẽ được đánh dấu nạp lại (`ingest_status='pending'`) để title-chunk trong RAG khớp tiêu đề mới.

## Chi tiết kỹ thuật

- Thêm helper ở `src/lib/knowledgeTitle.ts` (client) và bản song song trong `supabase/functions/_shared/` cho các edge function nạp dữ liệu.
- Sửa `src/pages/AdminKnowledge.tsx`: `handleFileChange` luôn ghi đè tiêu đề; `handleUpload` fallback theo tên file; thêm hành động đặt lại tiêu đề (đơn lẻ + bulk) qua RPC `admin_edit_knowledge_doc` sẵn có.
- Sửa `supabase/functions/knowledge-ingest-url/index.ts` và các luồng ingest khác ở phần chọn `title`.
- Không tốn credit AI — hoàn toàn xử lý bằng chuỗi.
