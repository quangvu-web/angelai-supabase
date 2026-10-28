
-- A. Bulk-tag authoritative cho mọi doc dạng "Tài khoản Fun.Rich chính thức của bé …"
UPDATE public.knowledge_documents
SET metadata = COALESCE(metadata, '{}'::jsonb)
  || jsonb_build_object(
       'authoritative', true,
       'doc_kind', 'official_account',
       'entity_name', regexp_replace(
         title,
         '^\s*\d*\.?\s*(Đây là )?[Tt]ài kho[ảa]n Fun\.Rich ch[íi]nh th[ứu]c c[ủu]a b[ée]\s*[:\(]?\s*',
         '',
         'i'
       )
     ),
  updated_at = now()
WHERE deleted_at IS NULL
  AND title ~* '^\s*\d*\.?\s*(Đây là )?[Tt]ài kho[ảa]n Fun\.Rich ch[íi]nh th[ứu]c c[ủu]a b[ée]'
  AND (metadata->>'authoritative') IS DISTINCT FROM 'true';
