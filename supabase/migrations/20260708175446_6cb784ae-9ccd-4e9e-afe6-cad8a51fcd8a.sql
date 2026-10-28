
-- 1. Backup table
CREATE TABLE IF NOT EXISTS public.knowledge_document_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT,
  folder_id UUID,
  source TEXT,
  content_hash TEXT,
  chunk_count INTEGER,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_document_backups TO authenticated;
GRANT ALL ON public.knowledge_document_backups TO service_role;

CREATE INDEX IF NOT EXISTS idx_kdb_doc_id ON public.knowledge_document_backups (doc_id);
CREATE INDEX IF NOT EXISTS idx_kdb_snapshot_date ON public.knowledge_document_backups (snapshot_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_kdb_doc_date ON public.knowledge_document_backups (doc_id, snapshot_date);

ALTER TABLE public.knowledge_document_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backups"
  ON public.knowledge_document_backups FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Snapshot function
CREATE OR REPLACE FUNCTION public.backup_knowledge_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted INTEGER := 0;
  _pruned INTEGER := 0;
BEGIN
  INSERT INTO public.knowledge_document_backups
    (doc_id, snapshot_date, title, folder_id, source, content_hash, chunk_count, payload)
  SELECT
    d.id,
    CURRENT_DATE,
    d.title,
    d.folder_id,
    d.source,
    d.content_hash,
    d.chunk_count,
    to_jsonb(d.*)
  FROM public.knowledge_documents d
  WHERE d.deleted_at IS NULL
  ON CONFLICT (doc_id, snapshot_date) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  DELETE FROM public.knowledge_document_backups
   WHERE snapshot_date < CURRENT_DATE - INTERVAL '56 days';

  GET DIAGNOSTICS _pruned = ROW_COUNT;

  INSERT INTO public.knowledge_ingest_sync_audit
    (document_id, ingest_status, is_processed_before, is_processed_after, source, fixed, context)
  VALUES (
    NULL, 'info', false, false, 'backup_snapshot', false,
    jsonb_build_object('job', 'backup_snapshot', 'inserted', _inserted, 'pruned', _pruned)
  );

  RETURN jsonb_build_object('ok', true, 'inserted', _inserted, 'pruned', _pruned);
END;
$$;

GRANT EXECUTE ON FUNCTION public.backup_knowledge_snapshot() TO authenticated;

-- 3. Restore single doc from backup
CREATE OR REPLACE FUNCTION public.restore_doc_from_backup(_backup_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _bk RECORD;
  _existing UUID;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO _bk FROM public.knowledge_document_backups WHERE id = _backup_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'backup_not_found';
  END IF;

  SELECT id INTO _existing FROM public.knowledge_documents WHERE id = _bk.doc_id;

  IF _existing IS NULL THEN
    -- doc bị xoá cứng: dựng lại từ payload
    INSERT INTO public.knowledge_documents
    SELECT * FROM jsonb_populate_record(NULL::public.knowledge_documents, _bk.payload);

    UPDATE public.knowledge_documents
       SET deleted_at = NULL,
           ingest_status = 'pending',
           is_processed = false,
           chunk_count = 0
     WHERE id = _bk.doc_id;
  ELSE
    -- doc còn: revert nội dung
    UPDATE public.knowledge_documents d
       SET title = _bk.payload->>'title',
           extracted_content = _bk.payload->>'extracted_content',
           folder_id = NULLIF(_bk.payload->>'folder_id','')::uuid,
           metadata = COALESCE(_bk.payload->'metadata', '{}'::jsonb),
           content_hash = _bk.payload->>'content_hash',
           deleted_at = NULL,
           ingest_status = 'pending',
           is_processed = false,
           chunk_count = 0
     WHERE d.id = _bk.doc_id;
  END IF;

  INSERT INTO public.knowledge_admin_audit (admin_id, action, document_id, before_snapshot)
  VALUES (_admin, 'restore_from_backup', _bk.doc_id,
          jsonb_build_object('backup_id', _backup_id, 'snapshot_date', _bk.snapshot_date));

  RETURN jsonb_build_object('ok', true, 'doc_id', _bk.doc_id, 'snapshot_date', _bk.snapshot_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_doc_from_backup(UUID) TO authenticated;

-- 4. List soft-deleted docs (with latest backup id if any)
CREATE OR REPLACE FUNCTION public.list_deleted_knowledge_docs(_limit INT DEFAULT 200)
RETURNS TABLE (
  id UUID,
  title TEXT,
  source TEXT,
  folder_id UUID,
  chunk_count INTEGER,
  deleted_at TIMESTAMPTZ,
  latest_backup_id UUID,
  latest_backup_date DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id, d.title, d.source, d.folder_id, d.chunk_count, d.deleted_at,
    b.id AS latest_backup_id,
    b.snapshot_date AS latest_backup_date
  FROM public.knowledge_documents d
  LEFT JOIN LATERAL (
    SELECT id, snapshot_date FROM public.knowledge_document_backups
    WHERE doc_id = d.id ORDER BY snapshot_date DESC LIMIT 1
  ) b ON true
  WHERE d.deleted_at IS NOT NULL
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY d.deleted_at DESC
  LIMIT _limit
$$;

GRANT EXECUTE ON FUNCTION public.list_deleted_knowledge_docs(INT) TO authenticated;

-- 5. Weekly cron: Chủ nhật 21:00 UTC = 04:00 VN thứ Hai
SELECT cron.schedule(
  'knowledge-weekly-backup',
  '0 21 * * 0',
  $$SELECT public.backup_knowledge_snapshot();$$
);
