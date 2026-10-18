---
name: knowledge-ingest-audit-hardening
description: Kế hoạch vá knowledge-external-ingest để LUÔN ghi audit, trả response chi tiết, test 3 kịch bản và phối hợp FUN Profile
type: feature
---

## Bối cảnh (2026-07-06)
- FUN Profile đã bật toggle "Tự đẩy vào Angel AI gốc", UI hiển thị #221/#222/#223 = ✓ pushed.
- `knowledge_ingest_rate_limit` ghi nhận 3 request (01:08, 01:24, 01:33 UTC) — cùng API key hash `6cce2ad2…` → auth PASS.
- `knowledge_ingest_audit` = 0 rows. `knowledge_documents` với `source='fun_profile'` = 0.
- Kết luận: request thoát sớm (JSON parse fail / sai `action` / `documents` rỗng) trước khi audit-writer chạy. FUN Profile không đọc response body nên mark ✓ mù.

## Việc phải làm (khi user yêu cầu thực thi)

### 1. Vá `supabase/functions/knowledge-external-ingest/index.ts`
- Bọc handler bằng `try/finally` để **luôn** ghi ≥1 dòng `knowledge_ingest_audit` cho MỌI request (kể cả 400/401/422/500, JSON parse fail, action lạ, documents rỗng).
- Thêm `console.log` payload preview (200 ký tự đầu, KHÔNG log key) + list top-level keys nhận được.
- Response body chi tiết: `{ ok:false, error:"missing_field", field:"source_ref", hint:"..." }` để client hiển thị lý do.

### 2. Test 3 kịch bản bằng curl
- Payload sai action (`action:"push"`)
- Payload thiếu `content`
- Payload đúng
Show cha kết quả trong `/cto/knowledge-ingest`.

### 3. Ping FUN Profile team
Soạn message: Angel nhận 3 request 01:08/01:24/01:33 UTC nhưng không doc nào lưu. Sau khi Angel deploy patch, response sẽ có `error` + `field` cụ thể — team FUN Profile update UI đọc field này thay vì mark ✓ mù.

### 4. Sau khi deploy → cha bấm Force-sync
Đứng bên này quan sát bảng audit + `/cto/knowledge-ingest` để chốt root cause <2 phút.
