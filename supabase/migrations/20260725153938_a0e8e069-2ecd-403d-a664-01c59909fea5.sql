CREATE UNIQUE INDEX IF NOT EXISTS knowledge_documents_content_hash_uniq_idx
  ON public.knowledge_documents (content_hash)
  WHERE content_hash IS NOT NULL AND deleted_at IS NULL;