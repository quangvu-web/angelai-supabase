
-- Audit log for admin knowledge actions
CREATE TABLE public.knowledge_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  document_id UUID,
  before_snapshot JSONB,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.knowledge_admin_audit TO authenticated;
GRANT ALL ON public.knowledge_admin_audit TO service_role;

ALTER TABLE public.knowledge_admin_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit"
  ON public.knowledge_admin_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit"
  ON public.knowledge_admin_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

CREATE INDEX idx_kaa_created_at ON public.knowledge_admin_audit(created_at DESC);
CREATE INDEX idx_kaa_document ON public.knowledge_admin_audit(document_id);

-- Bulk delete RPC
CREATE OR REPLACE FUNCTION public.bulk_delete_knowledge_docs(_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can bulk delete';
  END IF;

  INSERT INTO public.knowledge_admin_audit (admin_id, action, document_id, before_snapshot, context)
  SELECT auth.uid(), 'bulk_delete', d.id,
         to_jsonb(d.*) - 'extracted_content',
         jsonb_build_object('count', array_length(_ids, 1))
  FROM public.knowledge_documents d
  WHERE d.id = ANY(_ids);

  DELETE FROM public.knowledge_chunks WHERE document_id = ANY(_ids);
  DELETE FROM public.knowledge_documents WHERE id = ANY(_ids);
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  RETURN _deleted;
END;
$$;

-- Dedupe Telegram docs: keep newest per content_hash, delete older
CREATE OR REPLACE FUNCTION public.dedupe_telegram_docs(_dry_run BOOLEAN DEFAULT TRUE)
RETURNS TABLE (duplicate_groups INTEGER, docs_to_delete INTEGER, deleted INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _groups INTEGER;
  _to_delete INTEGER;
  _deleted INTEGER := 0;
  _ids UUID[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can dedupe';
  END IF;

  WITH ranked AS (
    SELECT id, content_hash,
           ROW_NUMBER() OVER (PARTITION BY content_hash ORDER BY created_at DESC, id) AS rn
    FROM public.knowledge_documents
    WHERE source ILIKE 'telegram%' AND content_hash IS NOT NULL
  ),
  losers AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  SELECT array_agg(id),
         (SELECT COUNT(DISTINCT content_hash) FROM ranked WHERE rn > 1),
         COUNT(*)::INTEGER
  INTO _ids, _groups, _to_delete
  FROM losers;

  IF _ids IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  IF NOT _dry_run THEN
    INSERT INTO public.knowledge_admin_audit (admin_id, action, document_id, before_snapshot, context)
    SELECT auth.uid(), 'dedupe_delete', d.id,
           to_jsonb(d.*) - 'extracted_content',
           jsonb_build_object('reason', 'duplicate_content_hash')
    FROM public.knowledge_documents d
    WHERE d.id = ANY(_ids);

    DELETE FROM public.knowledge_chunks WHERE document_id = ANY(_ids);
    DELETE FROM public.knowledge_documents WHERE id = ANY(_ids);
    GET DIAGNOSTICS _deleted = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT COALESCE(_groups, 0), COALESCE(_to_delete, 0), _deleted;
END;
$$;

-- Reset doc for re-embedding after edit
CREATE OR REPLACE FUNCTION public.admin_edit_knowledge_doc(
  _id UUID, _title TEXT, _content TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_hash TEXT;
  _before JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can edit knowledge docs';
  END IF;

  SELECT to_jsonb(d.*) - 'extracted_content' INTO _before
  FROM public.knowledge_documents d WHERE d.id = _id;

  _new_hash := encode(digest(_content, 'sha256'), 'hex');

  DELETE FROM public.knowledge_chunks WHERE document_id = _id;

  UPDATE public.knowledge_documents
  SET title = _title,
      extracted_content = _content,
      content_hash = _new_hash,
      chunk_count = 0,
      is_processed = FALSE,
      ingest_status = 'pending',
      ingest_error = NULL,
      updated_at = now()
  WHERE id = _id;

  INSERT INTO public.knowledge_admin_audit (admin_id, action, document_id, before_snapshot, context)
  VALUES (auth.uid(), 'edit_content', _id, _before, jsonb_build_object('new_title', _title, 'new_length', length(_content)));
END;
$$;
