
CREATE TABLE IF NOT EXISTS public.rag_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('ok','degraded','down')),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.rag_health_events TO authenticated;
GRANT ALL ON public.rag_health_events TO service_role;

ALTER TABLE public.rag_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_rag_health" ON public.rag_health_events;
CREATE POLICY "admin_read_rag_health" ON public.rag_health_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordinator'));

CREATE INDEX IF NOT EXISTS idx_rag_health_created ON public.rag_health_events (created_at DESC);

UPDATE public.knowledge_documents
   SET ingest_status = 'pending',
       ingest_error = NULL
 WHERE ingest_status IN ('ready','failed')
   AND deleted_at IS NULL
   AND extracted_content IS NOT NULL;
