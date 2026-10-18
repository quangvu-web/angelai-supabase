# Thiết kế lại thư mục Knowledge của Angel AI

## Hiện trạng

- 28 thư mục **phẳng** (không có cấp cha/con), đặt tên tự phát: "Telegram / CAMLY COIN CHANNEL", "FACE BOOK", "KHÓA THIỀN RẤT DỄ", "Fun Ecosystem Docs"…
- Tổng ~2.247 tài liệu đang hoạt động. Phân bổ lệch nặng: Telegram/Camly Coin 694, FACE BOOK 413, angelKNOWLEDGE 197.
- **336 tài liệu (nguồn `telegram_channel_camly`) không thuộc thư mục nào** — Angel vẫn học nhưng admin không thấy chúng nằm ở đâu.
- Bảng `knowledge_folders` chỉ có `id, name, description, created_by` — thiếu `parent_id`, `slug`, `icon`, `sort_order`, nên không thể tạo cây thư mục theo nền tảng như ảnh mẫu.
- Trang `/admin/knowledge` upload cho chọn thư mục nhưng danh sách dài, không nhóm, dễ chọn sai.

## Mục tiêu

Đưa Knowledge về đúng cấu trúc như thư viện FUN Profile trong ảnh: các **nhóm nền tảng** ở cấp 1, thư mục chi tiết ở cấp 2, kèm biểu tượng và số lượng tài liệu, để admin upload đúng chỗ theo mục đích sử dụng.

## Cây thư mục cấp 1 đề xuất

```text
Hồ sơ dự án          Camly Coin        FUN Money        FUN Wallet
Angel AI             FUN Profile       FUN Academy      Green Earth
FUN Cosmos           FUN Charity       FUN Play         FUN Farm
LoveHUB              Bài viết của Father                Bài viết của Founder Camly Duong
Các bài dẫn thiền    PLP               Các tài liệu khác
```

## Ánh xạ dữ liệu cũ → mới (giữ nguyên tài liệu, chỉ gắn thư mục cha)

| Thư mục hiện có | Nhóm cấp 1 |
|---|---|
| Telegram / CAMLY COIN CHANNEL | Camly Coin |
| Telegram / angelKNOWLEDGE, angelknownledge, KNOWLEDGE ANGEL AI, ADMIN ANGEL AI, Google Docs / KNOWLEDGE ANGEL AI, Angel AI Core Doctrine | Angel AI |
| FACE BOOK, Fun Ecosystem Docs, FUN KINGDOM, BÁO CÁO DỰ ÁN FUN ECOSYSTEM, Series/BOOK Infinity-Sum Economy | Hồ sơ dự án |
| PPLP Documents, PLP Documents | PLP |
| LOVEHUB | LoveHUB |
| FUNCOSMOS | FUN Cosmos |
| Tất cả "KHÓA THIỀN…", "…DẪN THIỀN…", Thiền Nâng Cao | Các bài dẫn thiền |
| MS. CAMLY DƯƠNG DẪN THIỀN, Ms. Camly Duong Guides Zen Meditation | Bài viết của Founder Camly Duong |
| CHA QUA BÉ LY DẪN THIỀN | Bài viết của Father |
| Google Sheets / One-off ingest, Telegram / Channel -1003710799723 | Các tài liệu khác |
| 336 tài liệu không thư mục | Camly Coin (nguồn `telegram_channel_camly`) |

## Việc sẽ làm

1. **Mở rộng bảng thư mục**: thêm `parent_id`, `slug`, `icon`, `sort_order`, `platform_key`; giữ nguyên RLS và grants hiện có.
2. **Tạo 18 thư mục cấp 1** theo danh sách trên, gắn các thư mục cũ làm con, và gán 336 tài liệu mồ côi vào đúng nhóm. Không xoá, không đổi nội dung tài liệu nào.
3. **Thiết kế lại `/admin/knowledge`**:
   - Hàng "chip" nền tảng ở đầu trang (đúng bố cục ảnh mẫu): biểu tượng + tên + số tài liệu, click để lọc.
   - Cây thư mục 2 cấp trong danh sách, kéo–thả tài liệu giữa các cấp vẫn hoạt động.
   - Ô upload / ingest URL: chọn nền tảng trước, rồi chọn thư mục con (bắt buộc chọn, cảnh báo nếu để trống).
4. **Chuẩn hoá luồng nạp tự động**: Telegram / Google Doc / API ingest tự gắn đúng thư mục con theo bảng ánh xạ nguồn → thư mục, để không sinh thêm tài liệu mồ côi.
5. **Đồng bộ trang xem `/knowledge`** dùng chung cây mới.

## Chi tiết kỹ thuật

- Migration thêm cột + index `(parent_id, sort_order)`; seed thư mục cấp 1 idempotent theo `slug`.
- Cập nhật `get_knowledge_folder_stats` để trả thêm `parent_id` và tổng gộp theo cây.
- Sửa `src/pages/AdminKnowledge.tsx` (chip bar + cây 2 cấp + form upload theo cấp), `src/pages/Knowledge.tsx`, `src/components/admin/TelegramKnowledgeManager.tsx`.
- Bảng ánh xạ nguồn → thư mục lưu trong DB (`knowledge_source_routing`) để chỉnh không cần deploy; các edge function ingest đọc bảng này.
- Biểu tượng dùng emoji/lucide theo token màu hiện có, không hardcode màu.
