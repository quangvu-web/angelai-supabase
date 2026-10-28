-- Knowledge lifecycle governance for Angel AI.
-- Separates ingest pipeline state from knowledge validity/review state.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS knowledge_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_group_id UUID,
  ADD COLUMN IF NOT EXISTS supersedes_document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deprecation_reason TEXT;

UPDATE public.knowledge_documents
   SET version_group_id = id
 WHERE version_group_id IS NULL;

ALTER TABLE public.knowledge_documents
  ALTER COLUMN version_group_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN effective_from SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'knowledge_documents_status_check'
      AND conrelid = 'public.knowledge_documents'::regclass
  ) THEN
    ALTER TABLE public.knowledge_documents
      ADD CONSTRAINT knowledge_documents_status_check
      CHECK (knowledge_status IN ('draft', 'review', 'active', 'deprecated', 'archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_lifecycle
  ON public.knowledge_documents (knowledge_status, ingest_status, deleted_at, effective_from, effective_until);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_version_group
  ON public.knowledge_documents (version_group_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_effective_until
  ON public.knowledge_documents (effective_until)
  WHERE effective_until IS NOT NULL;

ALTER TABLE public.chat_feedback
  ADD COLUMN IF NOT EXISTS feedback_reason TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linked_document_id UUID REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

ALTER TABLE public.chat_feedback
  DROP CONSTRAINT IF EXISTS chat_feedback_feedback_type_check;

ALTER TABLE public.chat_feedback
  ADD CONSTRAINT chat_feedback_feedback_type_check
  CHECK (feedback_type IN ('like', 'dislike', 'outdated', 'needs_update'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_feedback_status_check'
      AND conrelid = 'public.chat_feedback'::regclass
  ) THEN
    ALTER TABLE public.chat_feedback
      ADD CONSTRAINT chat_feedback_status_check
      CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed'));
  END IF;
END $$;

UPDATE public.chat_feedback
   SET feedback_reason = COALESCE(feedback_reason, feedback_type)
 WHERE feedback_reason IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_feedback_status
  ON public.chat_feedback (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_feedback_linked_document
  ON public.chat_feedback (linked_document_id)
  WHERE linked_document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_knowledge_document_active(_doc public.knowledge_documents)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT _doc.deleted_at IS NULL
     AND _doc.ingest_status = 'ready'
     AND _doc.knowledge_status = 'active'
     AND (_doc.effective_from IS NULL OR _doc.effective_from <= now())
     AND (_doc.effective_until IS NULL OR _doc.effective_until > now())
$$;

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  min_similarity float default 0.55
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  doc_title text,
  folder_name text,
  chunk_text text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.document_id,
    COALESCE(c.doc_title, d.title) AS doc_title,
    c.folder_name,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND public.is_knowledge_document_active(d)
    AND (1 - (c.embedding <=> query_embedding)) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_chunks(vector, int, float)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.match_knowledge_hybrid(
  query_embedding vector,
  query_text text,
  match_count integer DEFAULT 8,
  min_similarity double precision DEFAULT 0.30
)
RETURNS TABLE(
  chunk_id uuid,
  document_id uuid,
  doc_title text,
  folder_name text,
  chunk_text text,
  similarity double precision,
  chunk_type text,
  rrf_score double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','extensions'
AS $$
  WITH q AS (
    SELECT public.unaccent(lower(COALESCE(query_text,''))) AS qn
  ),
  eligible AS (
    SELECT c.id, c.document_id, c.chunk_text, COALESCE(c.doc_title, d.title) AS doc_title,
           c.folder_name, c.chunk_type, c.embedding
    FROM public.knowledge_chunks c
    JOIN public.knowledge_documents d ON d.id = c.document_id
    WHERE public.is_knowledge_document_active(d)
  ),
  vec AS (
    SELECT e.id, e.document_id, e.chunk_text, e.doc_title, e.folder_name, e.chunk_type,
           1 - (e.embedding <=> query_embedding) AS sim,
           row_number() OVER (ORDER BY e.embedding <=> query_embedding) AS rnk
    FROM eligible e
    WHERE e.embedding IS NOT NULL
      AND (1 - (e.embedding <=> query_embedding)) >= min_similarity
    ORDER BY e.embedding <=> query_embedding
    LIMIT 24
  ),
  kw AS (
    SELECT e.id, e.document_id, e.chunk_text, e.doc_title, e.folder_name, e.chunk_type,
           GREATEST(
             public.similarity(public.unaccent(lower(COALESCE(e.chunk_text,''))), (SELECT qn FROM q)),
             public.similarity(public.unaccent(lower(COALESCE(e.doc_title,''))), (SELECT qn FROM q)) * 1.15
           ) AS sim,
           row_number() OVER (ORDER BY GREATEST(
             public.similarity(public.unaccent(lower(COALESCE(e.chunk_text,''))), (SELECT qn FROM q)),
             public.similarity(public.unaccent(lower(COALESCE(e.doc_title,''))), (SELECT qn FROM q)) * 1.15
           ) DESC) AS rnk
    FROM eligible e
    WHERE public.unaccent(lower(COALESCE(e.chunk_text,''))) % (SELECT qn FROM q)
       OR public.unaccent(lower(COALESCE(e.doc_title,''))) % (SELECT qn FROM q)
    LIMIT 24
  ),
  merged AS (
    SELECT id, document_id, chunk_text, doc_title, folder_name, chunk_type,
           MAX(sim) AS similarity,
           SUM(1.0 / (60 + rnk)) * CASE WHEN chunk_type='title' THEN 1.3 ELSE 1.0 END AS rrf
    FROM (
      SELECT id, document_id, chunk_text, doc_title, folder_name, chunk_type, sim, rnk FROM vec
      UNION ALL
      SELECT id, document_id, chunk_text, doc_title, folder_name, chunk_type, sim, rnk FROM kw
    ) u
    GROUP BY id, document_id, chunk_text, doc_title, folder_name, chunk_type
  )
  SELECT id, document_id, doc_title, folder_name, chunk_text, similarity, chunk_type, rrf
  FROM merged
  ORDER BY rrf DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_hybrid(vector, text, integer, double precision)
  TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.set_knowledge_status(
  _id UUID,
  _status TEXT,
  _reason TEXT DEFAULT NULL
)
RETURNS public.knowledge_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _before JSONB;
  _row public.knowledge_documents;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF _status NOT IN ('draft', 'review', 'active', 'deprecated', 'archived') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT to_jsonb(d.*) INTO _before
  FROM public.knowledge_documents d
  WHERE d.id = _id;

  IF _before IS NULL THEN
    RAISE EXCEPTION 'document_not_found';
  END IF;

  UPDATE public.knowledge_documents
     SET knowledge_status = _status,
         reviewed_by = CASE WHEN _status IN ('review', 'active') THEN _admin ELSE reviewed_by END,
         reviewed_at = CASE WHEN _status IN ('review', 'active') THEN now() ELSE reviewed_at END,
         approved_by = CASE WHEN _status = 'active' THEN _admin ELSE approved_by END,
         approved_at = CASE WHEN _status = 'active' THEN now() ELSE approved_at END,
         deprecated_at = CASE WHEN _status IN ('deprecated', 'archived') THEN now() ELSE deprecated_at END,
         deprecation_reason = CASE WHEN _status IN ('deprecated', 'archived') THEN _reason ELSE deprecation_reason END,
         updated_at = now()
   WHERE id = _id
   RETURNING * INTO _row;

  INSERT INTO public.knowledge_admin_audit (admin_id, action, document_id, before_snapshot, context)
  VALUES (
    _admin,
    CASE _status
      WHEN 'review' THEN 'submit_review'
      WHEN 'active' THEN 'activate'
      WHEN 'deprecated' THEN 'deprecate'
      WHEN 'archived' THEN 'archive'
      ELSE 'set_draft'
    END,
    _id,
    _before,
    jsonb_build_object('new_status', _status, 'reason', _reason)
  );

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_knowledge_status(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_knowledge_new_version(
  _id UUID,
  _title TEXT DEFAULT NULL,
  _content TEXT DEFAULT NULL,
  _reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _old public.knowledge_documents;
  _new_id UUID;
  _new_hash TEXT;
  _next_version INTEGER;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO _old
  FROM public.knowledge_documents
  WHERE id = _id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'document_not_found';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO _next_version
  FROM public.knowledge_documents
  WHERE version_group_id = COALESCE(_old.version_group_id, _old.id);

  _new_hash := CASE
    WHEN _content IS NULL THEN _old.content_hash
    ELSE encode(digest(_content, 'sha256'), 'hex')
  END;

  INSERT INTO public.knowledge_documents (
    title, description, file_name, file_url, file_type, file_size,
    extracted_content, is_processed, created_by, folder_id, ingest_status,
    ingest_error, ingested_at, chunk_count, language, metadata,
    source, source_ref, source_url, content_hash,
    knowledge_status, version, version_group_id, supersedes_document_id,
    effective_from
  )
  VALUES (
    COALESCE(NULLIF(_title, ''), _old.title),
    _old.description,
    _old.file_name,
    _old.file_url,
    _old.file_type,
    _old.file_size,
    COALESCE(_content, _old.extracted_content),
    false,
    _admin,
    _old.folder_id,
    'pending',
    NULL,
    NULL,
    0,
    _old.language,
    COALESCE(_old.metadata, '{}'::jsonb) || jsonb_build_object('version_reason', _reason),
    _old.source,
    CASE
      WHEN _old.source_ref IS NULL THEN NULL
      ELSE _old.source_ref || '_v' || _next_version::text
    END,
    _old.source_url,
    _new_hash,
    'review',
    _next_version,
    COALESCE(_old.version_group_id, _old.id),
    _old.id,
    now()
  )
  RETURNING id INTO _new_id;

  UPDATE public.knowledge_documents
     SET knowledge_status = 'deprecated',
         deprecated_at = now(),
         deprecation_reason = COALESCE(_reason, 'Superseded by a newer knowledge version'),
         updated_at = now()
   WHERE id = _old.id
     AND knowledge_status <> 'archived';

  INSERT INTO public.knowledge_admin_audit (admin_id, action, document_id, before_snapshot, context)
  VALUES (
    _admin,
    'new_version',
    _new_id,
    to_jsonb(_old.*),
    jsonb_build_object('supersedes_document_id', _old.id, 'reason', _reason, 'version', _next_version)
  );

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_knowledge_new_version(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_chat_feedback(
  _id UUID,
  _status TEXT,
  _admin_note TEXT DEFAULT NULL,
  _linked_document_id UUID DEFAULT NULL
)
RETURNS public.chat_feedback
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin UUID := auth.uid();
  _row public.chat_feedback;
BEGIN
  IF NOT public.has_role(_admin, 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF _status NOT IN ('open', 'reviewed', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_feedback_status';
  END IF;

  UPDATE public.chat_feedback
     SET status = _status,
         admin_note = _admin_note,
         linked_document_id = COALESCE(_linked_document_id, linked_document_id),
         reviewed_by = _admin,
         reviewed_at = now(),
         updated_at = now()
   WHERE id = _id
   RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'feedback_not_found';
  END IF;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_chat_feedback(UUID, TEXT, TEXT, UUID) TO authenticated;
