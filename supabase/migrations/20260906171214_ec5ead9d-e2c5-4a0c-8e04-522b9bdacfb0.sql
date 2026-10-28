ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS urantia_paper_number smallint;

CREATE INDEX IF NOT EXISTS idx_kd_urantia_paper
  ON public.knowledge_documents (urantia_paper_number)
  WHERE urantia_paper_number IS NOT NULL AND deleted_at IS NULL;

-- Backfill số bài + chuẩn hoá tiêu đề trong thư mục SÁCH URANTIA
WITH parsed AS (
  SELECT id,
         (regexp_match(title, '^\s*(?:Sách\s+Urantia\s+)?Bài(?:\s+báo)?\s*(?:số\s*)?(\d{1,3})\s*[-–—:.]?\s*(.*)$', 'i')) m
  FROM public.knowledge_documents
  WHERE folder_id = 'ef70fdf7-a175-471d-9cc2-d0f89bf8bf33' AND deleted_at IS NULL
)
UPDATE public.knowledge_documents d
SET urantia_paper_number = p.m[1]::smallint,
    title = 'Bài ' || (p.m[1]::int)::text ||
            CASE WHEN btrim(regexp_replace(p.m[2], '\s+', ' ', 'g')) = '' THEN ''
                 ELSE ' — ' || btrim(regexp_replace(p.m[2], '\s+', ' ', 'g')) END
FROM parsed p
WHERE d.id = p.id AND p.m IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_urantia_paper(p_number int)
RETURNS TABLE (
  id uuid,
  title text,
  extracted_content text,
  chunk_count integer,
  ingest_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.title, d.extracted_content, d.chunk_count, d.ingest_status
  FROM public.knowledge_documents d
  WHERE d.deleted_at IS NULL
    AND d.knowledge_status = 'active'
    AND d.urantia_paper_number = p_number
  ORDER BY d.chunk_count DESC NULLS LAST, d.updated_at DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_urantia_paper(int) TO authenticated, service_role;