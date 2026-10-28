ALTER TABLE public.knowledge_folders
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.knowledge_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS platform_key text;

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_folders_slug_key ON public.knowledge_folders (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_folders_parent_sort_idx ON public.knowledge_folders (parent_id, sort_order);

CREATE TABLE IF NOT EXISTS public.knowledge_source_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL,
  match_value text,
  folder_id uuid REFERENCES public.knowledge_folders(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_source_routing_key_idx
  ON public.knowledge_source_routing (source_key, coalesce(match_value, ''));

GRANT SELECT ON public.knowledge_source_routing TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_source_routing TO authenticated;
GRANT ALL ON public.knowledge_source_routing TO service_role;

ALTER TABLE public.knowledge_source_routing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routing readable by all" ON public.knowledge_source_routing;
CREATE POLICY "routing readable by all" ON public.knowledge_source_routing FOR SELECT USING (true);

DROP POLICY IF EXISTS "routing managed by admins" ON public.knowledge_source_routing;
CREATE POLICY "routing managed by admins" ON public.knowledge_source_routing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP FUNCTION IF EXISTS public.get_knowledge_folder_stats();
CREATE OR REPLACE FUNCTION public.get_knowledge_folder_stats()
 RETURNS TABLE(folder_id uuid, folder_name text, parent_id uuid, icon text, sort_order integer, doc_count bigint, ready_count bigint, pending_count bigint, failed_count bigint, last_ingested_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    f.id, f.name, f.parent_id, f.icon, f.sort_order,
    count(d.id)::bigint,
    count(d.id) FILTER (WHERE d.ingest_status = 'ready')::bigint,
    count(d.id) FILTER (WHERE d.ingest_status = 'pending')::bigint,
    count(d.id) FILTER (WHERE d.ingest_status = 'failed')::bigint,
    max(d.created_at)
  FROM public.knowledge_folders f
  LEFT JOIN public.knowledge_documents d
    ON d.folder_id = f.id AND d.deleted_at IS NULL
  GROUP BY f.id, f.name, f.parent_id, f.icon, f.sort_order
  UNION ALL
  SELECT
    NULL::uuid, 'Chưa phân loại'::text, NULL::uuid, '📥'::text, 999,
    count(*)::bigint,
    count(*) FILTER (WHERE ingest_status = 'ready')::bigint,
    count(*) FILTER (WHERE ingest_status = 'pending')::bigint,
    count(*) FILTER (WHERE ingest_status = 'failed')::bigint,
    max(created_at)
  FROM public.knowledge_documents
  WHERE folder_id IS NULL AND deleted_at IS NULL
$function$;