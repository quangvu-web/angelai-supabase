CREATE OR REPLACE FUNCTION public.knowledge_export_collection_counts()
RETURNS TABLE (folder_id uuid, item_count bigint, active_count bigint, last_updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.folder_id,
         count(*) FILTER (WHERE d.deleted_at IS NULL) AS item_count,
         count(*) FILTER (WHERE d.deleted_at IS NULL AND d.knowledge_status = 'active') AS active_count,
         max(d.updated_at) AS last_updated_at
  FROM public.knowledge_documents d
  GROUP BY d.folder_id
$$;

REVOKE ALL ON FUNCTION public.knowledge_export_collection_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.knowledge_export_collection_counts() TO service_role;