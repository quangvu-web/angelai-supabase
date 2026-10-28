UPDATE public.knowledge_documents 
SET ingest_status = 'pending', is_processed = false, ingest_error = NULL 
WHERE ingest_status = 'failed' AND deleted_at IS NULL;

INSERT INTO public.knowledge_ingest_sync_audit (ingest_status, source, context, fixed)
VALUES ('failed→pending', 'manual_backfill', 'Reset 25 failed docs for full RAG backfill', true);