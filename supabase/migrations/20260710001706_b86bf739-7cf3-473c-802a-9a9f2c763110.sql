DROP FUNCTION IF EXISTS public.create_knowledge_new_version(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.set_knowledge_status(uuid, text, text);

-- Unified wrapper used by TelegramKnowledgeManager
CREATE OR REPLACE FUNCTION public.set_knowledge_status(
  _id uuid, _status text, _reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'coordinator')) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF _status NOT IN ('draft','review','active','deprecated','archived') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE public.knowledge_documents SET
    knowledge_status = _status,
    approved_by = CASE WHEN _status='active' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN _status='active' THEN now() ELSE approved_at END,
    reviewed_by = CASE WHEN _status IN ('review','active') THEN auth.uid() ELSE reviewed_by END,
    reviewed_at = CASE WHEN _status IN ('review','active') THEN now() ELSE reviewed_at END,
    deprecated_at = CASE WHEN _status='deprecated' THEN now() ELSE NULL END,
    deprecation_reason = CASE WHEN _status IN ('deprecated','archived') THEN _reason ELSE NULL END,
    effective_until = CASE
      WHEN _status='deprecated' THEN COALESCE(effective_until, now())
      WHEN _status='active' THEN NULL
      ELSE effective_until
    END,
    updated_at = now()
  WHERE id = _id;

  PERFORM public._log_kn_audit(_id, 'set_status',
    jsonb_build_object('status', _status, 'reason', _reason));
END; $$;

-- Wrapper aligning to UI's expected shape (returns void, matches component call)
CREATE OR REPLACE FUNCTION public.create_knowledge_new_version(
  _id uuid, _title text, _content text, _reason text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _new_id uuid;
BEGIN
  -- Create a Review-status draft that supersedes source; source remains active until approved.
  _new_id := public.create_knowledge_doc_version(_id, _content, _title, false);
  UPDATE public.knowledge_documents
    SET knowledge_status='review', updated_at=now()
    WHERE id=_new_id;
  PERFORM public._log_kn_audit(_new_id, 'new_version_review',
    jsonb_build_object('source_id', _id, 'reason', _reason));
  RETURN _new_id;
END; $$;
