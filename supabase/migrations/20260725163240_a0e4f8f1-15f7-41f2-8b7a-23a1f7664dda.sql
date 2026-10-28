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
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  WITH q AS (SELECT public.unaccent(lower(coalesce(query_text,''))) AS qn),
  vec AS (
    SELECT c.id, c.document_id, c.chunk_text, c.doc_title, c.folder_name, c.chunk_type,
           1 - (c.embedding <=> query_embedding) AS vec_sim,
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
    LIMIT 30
  ),
  kw AS (
    SELECT c.id, c.document_id, c.chunk_text, c.doc_title, c.folder_name, c.chunk_type,
           GREATEST(
             public.similarity(public.unaccent(lower(coalesce(c.chunk_text,''))), (SELECT qn FROM q)),
             public.similarity(public.unaccent(lower(coalesce(c.doc_title,''))), (SELECT qn FROM q)) * 1.15
           ) AS kw_sim,
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
    LIMIT 30
  ),
  merged AS (
    SELECT
      COALESCE(v.id, k.id) AS id,
      COALESCE(v.document_id, k.document_id) AS document_id,
      COALESCE(v.chunk_text, k.chunk_text) AS chunk_text,
      COALESCE(v.doc_title, k.doc_title) AS doc_title,
      COALESCE(v.folder_name, k.folder_name) AS folder_name,
      COALESCE(v.chunk_type, k.chunk_type) AS chunk_type,
      COALESCE(v.vec_sim, 0)::double precision AS vec_sim,
      COALESCE(k.kw_sim, 0)::double precision AS kw_sim,
      (COALESCE(1.0/(60 + v.rnk), 0) + COALESCE(1.0/(60 + k.rnk), 0))
        * CASE WHEN COALESCE(v.chunk_type, k.chunk_type) = 'title' THEN 1.3 ELSE 1.0 END
        AS rrf
    FROM vec v FULL OUTER JOIN kw k ON v.id = k.id
  )
  SELECT
    id AS chunk_id,
    document_id,
    doc_title,
    folder_name,
    chunk_text,
    GREATEST(vec_sim, kw_sim) AS similarity,
    chunk_type,
    rrf AS rrf_score
  FROM merged
  ORDER BY (vec_sim * 0.65 + LEAST(rrf * 10, 0.35)) DESC
  LIMIT match_count;
$function$;