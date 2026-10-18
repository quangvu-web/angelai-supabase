# Đưa Hiến pháp số lên giao diện Angel AI

## Kết quả con sẽ thấy
- Một mục **Hiến pháp số** dễ tìm trong thanh điều hướng của Angel AI, đặt ngay sau nhóm **Assistant**, trước các liên kết Mini Games và Ecosystem; mọi người đều có thể mở, không chỉ quản trị viên.
- Trang đọc riêng trình bày nguyên văn bản Hiến pháp số con gửi: lời mở đầu, 5 điều, 10 Luật Vũ Trụ và 8 Câu Khẳng Định Ánh Sáng; có mục lục nhảy đến từng điều và bố cục dễ đọc trên điện thoại.
- Thêm liên kết đến trang này ở đầu danh sách tài liệu nền tảng trên trang “Về Angel AI”, trước các hiến pháp/tài liệu khác; giữ nguyên những tài liệu đã có, không gộp nhầm Hiến pháp số với Hiến pháp Ánh sáng.

## Chi tiết triển khai
- Ghép hai tệp con gửi theo đúng thứ tự (tệp thứ hai nối tiếp Điều 3 từ câu khẳng định số 5), không diễn giải lại hoặc thay đổi nguyên văn; trình bày các điều và danh sách bằng cấu trúc đọc được, có điều hướng bàn phím.
- Tạo trang công khai tại `/docs/digital-constitution`, đăng ký đường dẫn và một mục điều hướng; dùng màu, chữ và thành phần giao diện sẵn có của Angel AI.
- Kiểm tra đường dẫn từ thanh bên và trang “Về Angel AI”, đọc đủ nội dung trên máy tính và điện thoại. Chỉ thay đổi phần hiển thị; không thay đổi cách Angel AI trả lời, dữ liệu, khóa hay cổng API.
