
-- 1) Audit log table
CREATE TABLE IF NOT EXISTS public.knowledge_ingest_sync_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid,
  ingest_status text,
  is_processed_before boolean,
  is_processed_after boolean,
  source text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  fixed boolean NOT NULL DEFAULT false,
  context text
);

GRANT SELECT ON public.knowledge_ingest_sync_audit TO authenticated;
GRANT ALL ON public.knowledge_ingest_sync_audit TO service_role;

ALTER TABLE public.knowledge_ingest_sync_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view sync audit"
ON public.knowledge_ingest_sync_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_sync_audit_detected_at
  ON public.knowledge_ingest_sync_audit (detected_at DESC);

-- 2) Trigger: auto-sync is_processed with ingest_status
CREATE OR REPLACE FUNCTION public.fn_sync_knowledge_processed_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected boolean;
BEGIN
  expected := (NEW.ingest_status = 'ready');

  -- Only enforce when we know status; leave NULL untouched
  IF NEW.ingest_status IS NOT NULL AND NEW.is_processed IS DISTINCT FROM expected THEN
    -- Log drift only on UPDATE where old value was different from expected too
    IF TG_OP = 'UPDATE' AND OLD.is_processed IS DISTINCT FROM expected THEN
      INSERT INTO public.knowledge_ingest_sync_audit(
        document_id, ingest_status, is_processed_before, is_processed_after,
        source, fixed, context
      ) VALUES (
        NEW.id, NEW.ingest_status, NEW.is_processed, expected,
        NEW.source, true, 'trigger_autosync'
      );
    END IF;
    NEW.is_processed := expected;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_knowledge_processed_flag ON public.knowledge_documents;
CREATE TRIGGER tg_sync_knowledge_processed_flag
BEFORE INSERT OR UPDATE OF ingest_status, is_processed
ON public.knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_knowledge_processed_flag();

-- 3) Periodic scan: detect + fix + log drift
CREATE OR REPLACE FUNCTION public.check_knowledge_ingest_sync()
RETURNS TABLE(scanned bigint, drifted bigint, fixed bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scanned bigint := 0;
  v_drifted bigint := 0;
  v_fixed bigint := 0;
BEGIN
  SELECT count(*) INTO v_scanned FROM public.knowledge_documents;

  -- Snapshot drift rows
  WITH drift AS (
    SELECT id, ingest_status, is_processed, source
    FROM public.knowledge_documents
    WHERE ingest_status IS NOT NULL
      AND is_processed IS DISTINCT FROM (ingest_status = 'ready')
  ),
  logged AS (
    INSERT INTO public.knowledge_ingest_sync_audit(
      document_id, ingest_status, is_processed_before, is_processed_after,
      source, fixed, context
    )
    SELECT id, ingest_status, is_processed, (ingest_status = 'ready'),
           source, true, 'periodic_scan'
    FROM drift
    RETURNING document_id
  ),
  updated AS (
    UPDATE public.knowledge_documents kd
    SET is_processed = (kd.ingest_status = 'ready')
    FROM drift d
    WHERE kd.id = d.id
    RETURNING kd.id
  )
  SELECT
    (SELECT count(*) FROM drift),
    (SELECT count(*) FROM updated)
  INTO v_drifted, v_fixed;

  RETURN QUERY SELECT v_scanned, v_drifted, v_fixed;
END;
$$;

REVOKE ALL ON FUNCTION public.check_knowledge_ingest_sync() FROM public;
GRANT EXECUTE ON FUNCTION public.check_knowledge_ingest_sync() TO service_role;
