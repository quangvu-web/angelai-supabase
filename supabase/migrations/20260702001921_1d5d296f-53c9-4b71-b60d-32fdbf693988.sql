
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_type text NOT NULL DEFAULT 'body';

CREATE INDEX IF NOT EXISTS knowledge_chunks_chunk_text_trgm ON public.knowledge_chunks USING gin (chunk_text public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_title_trgm ON public.knowledge_chunks USING gin (doc_title public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS knowledge_documents_title_trgm ON public.knowledge_documents USING gin (title public.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.ingest_knowledge_chunks(_doc_id uuid, _rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _count integer;
BEGIN
  INSERT INTO public.knowledge_chunks (document_id, chunk_text, chunk_order, doc_title, folder_name, token_count, embedding, embed_model, embedded_at, keywords, category, chunk_type)
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
    NULL,
    COALESCE(r->>'chunk_type', 'body')
  FROM jsonb_array_elements(_rows) AS r;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$function$;

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
AS $function$
  WITH q AS (
    SELECT public.unaccent(lower(coalesce(query_text,''))) AS qn
  ),
  vec AS (
    SELECT c.id, c.document_id, c.chunk_text, c.doc_title, c.folder_name, c.chunk_type,
           1 - (c.embedding <=> query_embedding) AS sim,
           row_number() OVER (ORDER BY c.embedding <=> query_embedding) AS rnk
    FROM public.knowledge_chunks c
    WHERE c.embedding IS NOT NULL
      AND (1 - (c.embedding <=> query_embedding)) >= min_similarity
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
    WHERE public.unaccent(lower(coalesce(c.chunk_text,''))) % (SELECT qn FROM q)
       OR public.unaccent(lower(coalesce(c.doc_title,''))) % (SELECT qn FROM q)
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
$function$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_hybrid(vector, text, integer, double precision) TO authenticated, anon, service_role;
