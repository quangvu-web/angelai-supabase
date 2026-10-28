CREATE OR REPLACE FUNCTION public.ingest_knowledge_chunks(_doc_id uuid, _rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  INSERT INTO knowledge_chunks (document_id, chunk_text, chunk_order, doc_title, folder_name, token_count, embedding, embed_model, embedded_at, keywords, category)
  SELECT
    _doc_id,
    r->>'chunk_text',
    (r->>'chunk_order')::int,
    r->>'doc_title',
    r->>'folder_name',
    (r->>'token_count')::int,
    (r->>'embedding')::vector,
    r->>'embed_model',
    (r->>'embedded_at')::timestamptz,
    ARRAY[]::text[],
    NULL
  FROM jsonb_array_elements(_rows) AS r;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_knowledge_chunks(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_knowledge_chunks(uuid, jsonb) TO service_role;