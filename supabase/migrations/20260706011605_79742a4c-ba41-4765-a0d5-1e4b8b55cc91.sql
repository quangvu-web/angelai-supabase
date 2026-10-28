
CREATE TABLE IF NOT EXISTS public.knowledge_ingest_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  action TEXT NOT NULL,
  docs_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER NOT NULL DEFAULT 200,
  sample_error TEXT,
  sample_source TEXT,
  sample_source_ref TEXT,
  request_bytes INTEGER,
  duration_ms INTEGER,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_ingest_audit TO authenticated;
GRANT ALL ON public.knowledge_ingest_audit TO service_role;

ALTER TABLE public.knowledge_ingest_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ingest audit"
ON public.knowledge_ingest_audit FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS ix_kia_created ON public.knowledge_ingest_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_kia_key ON public.knowledge_ingest_audit (api_key_hash, created_at DESC);
