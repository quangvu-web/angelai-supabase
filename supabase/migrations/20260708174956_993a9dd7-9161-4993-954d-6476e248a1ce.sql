
-- 1. Soft-delete column
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_deleted_at
  ON public.knowledge_documents (deleted_at)
  WHERE deleted_at IS NULL;

-- 2. RPC: folder stats (server-side counts)
CREATE OR REPLACE FUNCTION public.get_knowledge_folder_stats()
RETURNS TABLE (
  folder_id UUID,
  folder_name TEXT,
  doc_count BIGINT,
  ready_count BIGINT,
  pending_count BIGINT,
  failed_count BIGINT,
  last_ingested_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id AS folder_id,
    f.name AS folder_name,
    count(d.id)::bigint AS doc_count,
    count(d.id) FILTER (WHERE d.ingest_status = 'ready')::bigint AS ready_count,
    count(d.id) FILTER (WHERE d.ingest_status = 'pending')::bigint AS pending_count,
    count(d.id) FILTER (WHERE d.ingest_status = 'failed')::bigint AS failed_count,
    max(d.created_at) AS last_ingested_at
  FROM public.knowledge_folders f
  LEFT JOIN public.knowledge_documents d
    ON d.folder_id = f.id AND d.deleted_at IS NULL
  GROUP BY f.id, f.name
  UNION ALL
  SELECT
    NULL::uuid,
    'Chưa phân loại'::text,
    count(*)::bigint,
    count(*) FILTER (WHERE ingest_status = 'ready')::bigint,
    count(*) FILTER (WHERE ingest_status = 'pending')::bigint,
    count(*) FILTER (WHERE ingest_status = 'failed')::bigint,
    max(created_at)
  FROM public.knowledge_documents
  WHERE folder_id IS NULL AND deleted_at IS NULL
$$;

GRANT EXECUTE ON FUNCTION public.get_knowledge_folder_stats() TO authenticated;

-- 3. RPC: totals banner
CREATE OR REPLACE FUNCTION public.get_knowledge_totals()
RETURNS TABLE (
  total_docs BIGINT,
  total_chunks BIGINT,
  total_folders BIGINT,
  orphan_docs BIGINT,
  deleted_docs BIGINT,
  computed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.knowledge_documents WHERE deleted_at IS NULL),
    (SELECT count(*) FROM public.knowledge_chunks),
    (SELECT count(*) FROM public.knowledge_folders),
    (SELECT count(*) FROM public.knowledge_documents WHERE folder_id IS NULL AND deleted_at IS NULL),
    (SELECT count(*) FROM public.knowledge_documents WHERE deleted_at IS NOT NULL),
    now()
$$;

GRANT EXECUTE ON FUNCTION public.get_knowledge_totals() TO authenticated;

-- 4. Convert bulk_delete_knowledge_docs to SOFT delete
CREATE OR REPLACE FUNCTION public.bulk_delete_knowledge_docs(_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _n INTEGER;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- Audit before soft-delete
  INSERT INTO public.knowledge_admin_audit (admin_id, action, document_id, before_snapshot)
  SELECT _admin, 'soft_delete', d.id,
         jsonb_build_object('title', d.title, 'source', d.source, 'folder_id', d.folder_id,
                            'chunk_count', d.chunk_count, 'ingest_status', d.ingest_status)
  FROM public.knowledge_documents d
  WHERE d.id = ANY(_ids) AND d.deleted_at IS NULL;

  UPDATE public.knowledge_documents
     SET deleted_at = now(),
         ingest_status = 'deleted'
   WHERE id = ANY(_ids) AND deleted_at IS NULL;

  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- 5. Restore RPC (in case admin muốn khôi phục)
CREATE OR REPLACE FUNCTION public.restore_knowledge_docs(_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _n INTEGER;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  UPDATE public.knowledge_documents
     SET deleted_at = NULL,
         ingest_status = 'pending'
   WHERE id = ANY(_ids) AND deleted_at IS NOT NULL;

  GET DIAGNOSTICS _n = ROW_COUNT;

  INSERT INTO public.knowledge_admin_audit (admin_id, action, document_id, before_snapshot)
  SELECT _admin, 'restore', unnest(_ids), '{}'::jsonb;

  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_knowledge_docs(UUID[]) TO authenticated;

-- 6. Nightly integrity snapshot into knowledge_ingest_sync_audit
CREATE OR REPLACE FUNCTION public.knowledge_nightly_integrity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _totals RECORD;
  _prev RECORD;
  _drop_pct NUMERIC := 0;
  _severity TEXT := 'info';
BEGIN
  SELECT * INTO _totals FROM public.get_knowledge_totals();

  SELECT (context->>'total_docs')::bigint AS total_docs
    INTO _prev
    FROM public.knowledge_ingest_sync_audit
   WHERE context->>'job' = 'nightly_integrity'
   ORDER BY detected_at DESC
   LIMIT 1;

  IF _prev.total_docs IS NOT NULL AND _prev.total_docs > 0 THEN
    _drop_pct := ((_prev.total_docs - _totals.total_docs)::numeric / _prev.total_docs) * 100;
    IF _drop_pct > 5 THEN _severity := 'critical';
    ELSIF _drop_pct > 1 THEN _severity := 'warning';
    END IF;
  END IF;

  INSERT INTO public.knowledge_ingest_sync_audit
    (document_id, ingest_status, is_processed_before, is_processed_after, source, fixed, context)
  VALUES (
    NULL, _severity, false, false, 'nightly',  false,
    jsonb_build_object(
      'job', 'nightly_integrity',
      'total_docs', _totals.total_docs,
      'total_chunks', _totals.total_chunks,
      'total_folders', _totals.total_folders,
      'orphan_docs', _totals.orphan_docs,
      'deleted_docs', _totals.deleted_docs,
      'prev_total_docs', _prev.total_docs,
      'drop_pct', _drop_pct
    )
  );

  RETURN jsonb_build_object('ok', true, 'severity', _severity, 'drop_pct', _drop_pct);
END;
$$;

-- 7. Cron: chạy 20:00 UTC = 03:00 VN
SELECT cron.schedule(
  'knowledge-nightly-integrity',
  '0 20 * * *',
  $$SELECT public.knowledge_nightly_integrity();$$
);
