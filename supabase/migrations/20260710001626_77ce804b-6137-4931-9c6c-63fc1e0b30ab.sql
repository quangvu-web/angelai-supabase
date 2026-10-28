DROP FUNCTION IF EXISTS public.review_chat_feedback(uuid, text, text, uuid);
DROP FUNCTION IF EXISTS public.match_knowledge_hybrid(vector, text, integer, double precision);

-- ============ MIGRATION A: knowledge lifecycle schema ============
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS knowledge_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_group_id uuid,
  ADD COLUMN IF NOT EXISTS supersedes_document_id uuid REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS effective_from timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS effective_until timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS deprecated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deprecation_reason text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='knowledge_documents_status_chk') THEN
    ALTER TABLE public.knowledge_documents
      ADD CONSTRAINT knowledge_documents_status_chk
      CHECK (knowledge_status IN ('draft','review','active','deprecated','archived'));
  END IF;
END $$;

-- Backfill
UPDATE public.knowledge_documents
  SET version_group_id = COALESCE(version_group_id, id),
      effective_from = COALESCE(effective_from, created_at);

CREATE INDEX IF NOT EXISTS idx_kd_status_effective
  ON public.knowledge_documents (knowledge_status, effective_from, effective_until)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_kd_version_group
  ON public.knowledge_documents (version_group_id, version DESC);

CREATE OR REPLACE FUNCTION public.tg_kd_set_version_group()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.version_group_id IS NULL THEN
    NEW.version_group_id := NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_kd_set_version_group ON public.knowledge_documents;
CREATE TRIGGER trg_kd_set_version_group
  BEFORE INSERT ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_kd_set_version_group();

-- ============ MIGRATION B: filtered RAG RPCs ============
CREATE OR REPLACE FUNCTION public.match_knowledge_hybrid(
  query_embedding vector, query_text text,
  match_count integer DEFAULT 8, min_similarity double precision DEFAULT 0.30
)
RETURNS TABLE(chunk_id uuid, document_id uuid, doc_title text, folder_name text,
              chunk_text text, similarity double precision, chunk_type text, rrf_score double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public','extensions' AS $$
  WITH q AS (SELECT public.unaccent(lower(coalesce(query_text,''))) AS qn),
  vec AS (
    SELECT c.id, c.document_id, c.chunk_text, c.doc_title, c.folder_name, c.chunk_type,
           1 - (c.embedding <=> query_embedding) AS sim,
           row_number() OVER (ORDER BY c.embedding <=> query_embedding) AS rnk
    FROM public.knowledge_chunks c
    WHERE c.embedding IS NOT NULL
      AND (1 - (c.embedding <=> query_embedding)) >= min_similarity
      AND EXISTS (
        SELECT 1 FROM public.knowledge_documents d
        WHERE d.id = c.document_id
          AND d.deleted_at IS NULL
          AND d.ingest_status = 'ready'
          AND d.knowledge_status = 'active'
          AND (d.effective_from IS NULL OR d.effective_from <= now())
          AND (d.effective_until IS NULL OR d.effective_until > now())
      )
    ORDER BY c.embedding <=> query_embedding
    LIMIT 24
  ),
  kw AS (
    SELECT c.id, c.document_id, c.chunk_text, c.doc_title, c.folder_name, c.chunk_type,
           GREATEST(
             public.similarity(public.unaccent(lower(coalesce(c.chunk_text,''))), (SELECT qn FROM q)),
             public.similarity(public.unaccent(lower(coalesce(c.doc_title,''))), (SELECT qn FROM q)) * 1.15
           ) AS sim,
           row_number() OVER (ORDER BY GREATEST(
             public.similarity(public.unaccent(lower(coalesce(c.chunk_text,''))), (SELECT qn FROM q)),
             public.similarity(public.unaccent(lower(coalesce(c.doc_title,''))), (SELECT qn FROM q)) * 1.15
           ) DESC) AS rnk
    FROM public.knowledge_chunks c
    WHERE (public.unaccent(lower(coalesce(c.chunk_text,''))) % (SELECT qn FROM q)
       OR public.unaccent(lower(coalesce(c.doc_title,''))) % (SELECT qn FROM q))
      AND EXISTS (
        SELECT 1 FROM public.knowledge_documents d
        WHERE d.id = c.document_id
          AND d.deleted_at IS NULL
          AND d.ingest_status = 'ready'
          AND d.knowledge_status = 'active'
          AND (d.effective_from IS NULL OR d.effective_from <= now())
          AND (d.effective_until IS NULL OR d.effective_until > now())
      )
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
  FROM merged ORDER BY rrf DESC LIMIT match_count;
$$;

-- Also patch match_knowledge_chunks if it exists — recreate with same lifecycle filter
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding vector, match_count integer DEFAULT 8, min_similarity double precision DEFAULT 0.55
)
RETURNS TABLE(chunk_id uuid, document_id uuid, doc_title text, folder_name text,
              chunk_text text, similarity double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public','extensions' AS $$
  SELECT c.id, c.document_id, c.doc_title, c.folder_name, c.chunk_text,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks c
  WHERE c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) >= min_similarity
    AND EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = c.document_id
        AND d.deleted_at IS NULL
        AND d.ingest_status = 'ready'
        AND d.knowledge_status = 'active'
        AND (d.effective_from IS NULL OR d.effective_from <= now())
        AND (d.effective_until IS NULL OR d.effective_until > now())
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============ MIGRATION C: lifecycle RPCs ============
CREATE OR REPLACE FUNCTION public._require_kn_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordinator')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public._log_kn_audit(_doc uuid, _action text, _detail jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.knowledge_admin_audit (admin_id, action, target_id, details)
  VALUES (auth.uid(), _action, _doc, COALESCE(_detail,'{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  -- audit table shape may vary; do not block main action
  NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_knowledge_review(_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._require_kn_admin();
  UPDATE public.knowledge_documents
    SET knowledge_status='review', updated_at=now()
    WHERE id=_id AND knowledge_status IN ('draft','active');
  PERFORM public._log_kn_audit(_id, 'submit_review', jsonb_build_object('note', _note));
END; $$;

CREATE OR REPLACE FUNCTION public.approve_knowledge_doc(_id uuid, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._require_kn_admin();
  UPDATE public.knowledge_documents
    SET knowledge_status='active',
        approved_by=auth.uid(), approved_at=now(),
        reviewed_by=auth.uid(), reviewed_at=now(),
        updated_at=now()
    WHERE id=_id AND knowledge_status='review';
  PERFORM public._log_kn_audit(_id, 'approve', jsonb_build_object('note', _note));
END; $$;

CREATE OR REPLACE FUNCTION public.activate_knowledge_doc(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._require_kn_admin();
  UPDATE public.knowledge_documents
    SET knowledge_status='active',
        deprecated_at=NULL, deprecation_reason=NULL,
        effective_until=NULL,
        updated_at=now()
    WHERE id=_id;
  PERFORM public._log_kn_audit(_id, 'activate', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.deprecate_knowledge_doc(_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._require_kn_admin();
  UPDATE public.knowledge_documents
    SET knowledge_status='deprecated',
        deprecated_at=now(),
        deprecation_reason=_reason,
        effective_until=COALESCE(effective_until, now()),
        updated_at=now()
    WHERE id=_id AND knowledge_status='active';
  PERFORM public._log_kn_audit(_id, 'deprecate', jsonb_build_object('reason', _reason));
END; $$;

CREATE OR REPLACE FUNCTION public.archive_knowledge_doc(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._require_kn_admin();
  UPDATE public.knowledge_documents
    SET knowledge_status='archived', updated_at=now()
    WHERE id=_id;
  PERFORM public._log_kn_audit(_id, 'archive', '{}'::jsonb);
END; $$;

CREATE OR REPLACE FUNCTION public.create_knowledge_doc_version(
  _source_id uuid, _new_content text, _title text DEFAULT NULL, _activate boolean DEFAULT true
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _src public.knowledge_documents%ROWTYPE;
  _new_id uuid := gen_random_uuid();
  _next_version int;
  _group uuid;
BEGIN
  PERFORM public._require_kn_admin();
  SELECT * INTO _src FROM public.knowledge_documents WHERE id=_source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'source_not_found'; END IF;

  _group := COALESCE(_src.version_group_id, _src.id);
  SELECT COALESCE(MAX(version),0)+1 INTO _next_version
    FROM public.knowledge_documents WHERE version_group_id=_group;

  INSERT INTO public.knowledge_documents (
    id, title, extracted_content, folder_id, created_by,
    knowledge_status, version, version_group_id, supersedes_document_id,
    effective_from, ingest_status, is_processed
  ) VALUES (
    _new_id, COALESCE(_title, _src.title), _new_content, _src.folder_id, auth.uid(),
    CASE WHEN _activate THEN 'active' ELSE 'draft' END,
    _next_version, _group, _source_id,
    now(), 'pending', false
  );

  IF _activate THEN
    UPDATE public.knowledge_documents
      SET knowledge_status='deprecated',
          deprecated_at=now(),
          deprecation_reason='superseded_by_v'||_next_version,
          effective_until=COALESCE(effective_until, now()),
          updated_at=now()
      WHERE id=_source_id AND knowledge_status='active';
  END IF;

  PERFORM public._log_kn_audit(_new_id, 'new_version',
    jsonb_build_object('source_id', _source_id, 'version', _next_version, 'activated', _activate));
  RETURN _new_id;
END; $$;

-- ============ MIGRATION D: chat_feedback extension + review RPC ============
ALTER TABLE public.chat_feedback
  ADD COLUMN IF NOT EXISTS feedback_reason text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_document_id uuid REFERENCES public.knowledge_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_note text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chat_feedback_status_chk') THEN
    ALTER TABLE public.chat_feedback
      ADD CONSTRAINT chat_feedback_status_chk
      CHECK (status IN ('open','reviewed','resolved','dismissed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_feedback_status_type
  ON public.chat_feedback (status, feedback_type, created_at DESC);

-- Admin/coordinator can SELECT + UPDATE all feedback
DROP POLICY IF EXISTS "Admins can view all chat feedback" ON public.chat_feedback;
CREATE POLICY "Admins can view all chat feedback" ON public.chat_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordinator'));

DROP POLICY IF EXISTS "Admins can update chat feedback" ON public.chat_feedback;
CREATE POLICY "Admins can update chat feedback" ON public.chat_feedback
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordinator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordinator'));

CREATE OR REPLACE FUNCTION public.review_chat_feedback(
  _id uuid, _status text, _admin_note text DEFAULT NULL, _linked_document_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordinator')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _status NOT IN ('open','reviewed','resolved','dismissed') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;
  UPDATE public.chat_feedback
    SET status=_status,
        admin_note=COALESCE(_admin_note, admin_note),
        linked_document_id=COALESCE(_linked_document_id, linked_document_id),
        reviewed_by=auth.uid(),
        reviewed_at=now(),
        updated_at=now()
    WHERE id=_id;
END; $$;
