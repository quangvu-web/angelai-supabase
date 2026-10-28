
-- Fix content_unified view to use SECURITY INVOKER (default, safe)
DROP VIEW IF EXISTS public.content_unified;
CREATE VIEW public.content_unified WITH (security_invoker = true) AS
  SELECT 
    id AS content_id,
    user_id AS author_user_id,
    'post' AS content_type,
    content AS content_text,
    NULL::TEXT AS root_content_id,
    'public' AS visibility,
    metadata AS metadata_json,
    created_at
  FROM public.community_posts
  UNION ALL
  SELECT
    id AS content_id,
    user_id AS author_user_id,
    'journal' AS content_type,
    content AS content_text,
    NULL AS root_content_id,
    'private' AS visibility,
    NULL AS metadata_json,
    created_at
  FROM public.gratitude_journal
  UNION ALL
  SELECT
    id AS content_id,
    user_id AS author_user_id,
    'chat' AS content_type,
    question_text AS content_text,
    session_id::TEXT AS root_content_id,
    'private' AS visibility,
    NULL AS metadata_json,
    created_at
  FROM public.chat_history;
