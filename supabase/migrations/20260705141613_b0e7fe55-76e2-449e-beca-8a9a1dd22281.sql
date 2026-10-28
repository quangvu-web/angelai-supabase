
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_title_trgm
  ON public.knowledge_documents USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_content_trgm
  ON public.knowledge_documents USING gin (extracted_content gin_trgm_ops)
  WHERE extracted_content IS NOT NULL AND is_processed = true;

CREATE INDEX IF NOT EXISTS idx_chat_history_user_created
  ON public.chat_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_image_history_user_created
  ON public.image_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_last
  ON public.chat_sessions (user_id, last_message_at DESC);
