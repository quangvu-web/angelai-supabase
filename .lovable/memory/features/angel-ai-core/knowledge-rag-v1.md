---
name: Angel AI Knowledge RAG v1
description: Semantic search RAG cho knowledge_documents. Angel AI học tự động, cron 2 phút re-ingest doc mới.
type: feature
---

## Kiến trúc
- Model embedding: `openai/text-embedding-3-small` (1536 dims, HNSW cosine).
- Chunk: 1000 char / overlap 150, cắt theo dấu câu.
- `knowledge_chunks` có cột `embedding vector(1536)`, index HNSW.
- `knowledge_documents.ingest_status`: pending → processing → ready | failed. Trigger `tg_mark_doc_pending` tự đánh dấu lại khi `extracted_content` đổi.
- RPC `match_knowledge_chunks(query_embedding, match_count, min_similarity)` — trả về chunks đã join doc_title, folder_name.

## Edge functions
- `knowledge-ingest`: chunk + embed batch 32 → insert. Idempotent (delete rồi insert). Hỗ trợ `document_id` hoặc batch mode `{batch_size, max_batches}`.
- `knowledge-search`: embed query → RPC. Fail-safe trả `{chunks: []}` nếu lỗi.
- `angel-chat` gọi `knowledge-search` TRƯỚC keyword ILIKE. Nếu RAG hit (>=0.55) → dùng luôn, bỏ qua ILIKE (biến `ragUsed`).

## Ngưỡng mặc định
- `min_similarity = 0.55` (cân bằng recall/precision).
- `top_k = 6`.

## Cron
`knowledge-ingest-every-2min` (job id 29 trong pg_cron): mỗi 2 phút gọi `knowledge-ingest` với `{batch_size:25, max_batches:2}` → nuốt ~50 doc/phút.

## UI
`/core/memory` hiển thị Ready/Pending/Failed + nút "⚡ Học thêm ngay" (chạy 1 batch trực tiếp).

## Backfill
2026-07-01: 768 doc đánh dấu pending. Cron chạy nền ~30 phút để hoàn tất.

## Tương lai
- Rerank layer (Cohere/Cross-encoder) nếu cần precision cao hơn.
- Citation footnote hiển thị trong chat.
- Multimodal (embed hình ảnh doc) — dùng gemini-embedding-2 với halfvec(3072).
