
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'vi';

CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_documents_source_ref
  ON public.knowledge_documents (source, source_ref)
  WHERE source IS NOT NULL AND source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_source
  ON public.knowledge_documents (source) WHERE source IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.knowledge_ingest_rate_limit (
  api_key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_hash, window_start)
);

GRANT ALL ON public.knowledge_ingest_rate_limit TO service_role;

ALTER TABLE public.knowledge_ingest_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only"
  ON public.knowledge_ingest_rate_limit
  FOR ALL
  USING (false)
  WITH CHECK (false);
