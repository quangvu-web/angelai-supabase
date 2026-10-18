# Đồng nhất ngôn ngữ toàn bộ Angel AI

## Mục tiêu
Khi người dùng chọn một trong 12 ngôn ngữ, mọi chữ thuộc giao diện Angel AI đổi đồng bộ ngay và được ghi nhớ. Các tài liệu sáng lập như Hiến pháp số tiếp tục hiển thị nguyên văn; chỉ dịch phần điều hướng, nhãn và công cụ đọc xung quanh tài liệu.

## Phạm vi thực hiện

1. **Chuẩn hóa nền tảng ngôn ngữ**
   - Giữ cơ chế chọn ngôn ngữ hiện tại, bổ sung hàm thay thế biến số và định dạng ngày/số theo ngôn ngữ đang chọn.
   - Đồng bộ thuộc tính ngôn ngữ và chiều chữ toàn trang; tiếng Ả Rập tiếp tục dùng giao diện phải-sang-trái.
   - Bổ sung kiểm tra tự động để 12 bộ bản dịch có cùng danh sách khóa, không âm thầm rơi về tiếng Anh hoặc tiếng Việt.

2. **Dịch các phần dùng chung trên mọi trang**
   - Thanh bên chính, thanh đầu trang, tìm kiếm, thông báo, hồ sơ, nút quay lại, trạng thái tải và thanh điều hướng Core/CTO.
   - Chuẩn hóa các nhãn hiện đang trộn tiếng Việt–Anh như Dashboard, System Health, Tặng thưởng, Hồ sơ, Nhật ký Biết ơn.
   - Tên thương hiệu, tên sản phẩm, mã kỹ thuật và tên nền tảng được giữ nguyên khi phù hợp.

3. **Dịch toàn bộ giao diện Angel AI Core và CTO Console**
   - Các trang Dashboard, Orchestration, Prompts, Memory, Agents, Workflows, Logs.
   - Các trang System Health, API Management, Platforms, FUN Core API, Security, Cloud Cost và Knowledge Ingest.
   - Bao gồm tiêu đề, mô tả, thẻ số liệu, bảng, bộ lọc, nút, trạng thái trống/lỗi/thành công, chú giải biểu đồ và ngày giờ.

4. **Rà các giao diện Angel AI còn lại**
   - Chat, trang chủ, About, Knowledge, Profile, Auth và các hộp thoại dùng chung.
   - Thay chữ còn viết trực tiếp bằng khóa bản dịch; không thay đổi logic nghiệp vụ hay dữ liệu.
   - Phần nội dung do người dùng, Angel AI hoặc cơ sở dữ liệu tạo ra không bị dịch máy tự động.

5. **Tài liệu nền tảng**
   - Giữ nguyên văn nội dung Hiến pháp số và các tài liệu sáng lập.
   - Dịch phần “Về Angel AI”, “Tài liệu nền tảng”, “Mục lục”, “Lời mở đầu”, “Điều” và nhãn hỗ trợ đọc theo ngôn ngữ đã chọn.

6. **Kiểm tra hoàn chỉnh**
   - Kiểm tra tự động tính đầy đủ của khóa bản dịch cho cả 12 ngôn ngữ.
   - Kiểm tra thực tế ít nhất tiếng Việt, tiếng Anh, tiếng Trung và tiếng Ả Rập trên màn hình máy tính và điện thoại.
   - Xác nhận đổi ngôn ngữ không cần tải lại trang, không còn chữ giao diện lẫn ngôn ngữ, bố cục RTL đúng và ứng dụng không có lỗi.

## Chi tiết kỹ thuật
- Dùng `LanguageContext` và các tệp bản dịch hiện có làm nguồn duy nhất cho chữ giao diện.
- Nhóm khóa mới theo khu vực: `common`, `sidebar`, `core`, `cto`, `docs`, `status`.
- Không sửa nội dung lưu trong cơ sở dữ liệu, tài liệu gốc, API, Edge Functions hoặc cơ chế đăng nhập.
- Thêm quy tắc kiến trúc để mọi chữ giao diện mới phải đi qua hệ thống bản dịch.
