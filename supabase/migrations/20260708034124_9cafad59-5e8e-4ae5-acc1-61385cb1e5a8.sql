
-- 1) Fix typo KNOWNLEDGE -> KNOWLEDGE, chuẩn hoá prefix Telegram Files -> Telegram
UPDATE public.knowledge_folders
SET name = regexp_replace(name, 'KNOWNLEDGE', 'KNOWLEDGE', 'g')
WHERE name ILIKE '%KNOWNLEDGE%';

UPDATE public.knowledge_folders
SET name = regexp_replace(name, '^Telegram Files\s*/\s*', 'Telegram / ')
WHERE name ILIKE 'Telegram Files /%';

-- 2) Trim + collapse whitespace
UPDATE public.knowledge_folders
SET name = trim(regexp_replace(name, '\s+', ' ', 'g'))
WHERE name <> trim(regexp_replace(name, '\s+', ' ', 'g'));

-- 3) Merge trùng tên (case-insensitive): giữ folder có nhiều doc nhất
WITH ranked AS (
  SELECT
    f.id,
    lower(f.name) AS key,
    COALESCE((SELECT count(*) FROM public.knowledge_documents d WHERE d.folder_id = f.id), 0) AS doc_count,
    f.created_at
  FROM public.knowledge_folders f
),
canonicals AS (
  SELECT DISTINCT ON (key) key, id AS canonical_id
  FROM ranked
  ORDER BY key, doc_count DESC, created_at ASC
),
to_merge AS (
  SELECT r.id AS dup_id, c.canonical_id
  FROM ranked r
  JOIN canonicals c ON c.key = r.key
  WHERE r.id <> c.canonical_id
)
UPDATE public.knowledge_documents d
SET folder_id = m.canonical_id
FROM to_merge m
WHERE d.folder_id = m.dup_id;

-- 4) Xoá folder trùng (đã reassign hết doc)
WITH ranked AS (
  SELECT f.id, lower(f.name) AS key, f.created_at,
    COALESCE((SELECT count(*) FROM public.knowledge_documents d WHERE d.folder_id = f.id), 0) AS doc_count
  FROM public.knowledge_folders f
),
canonicals AS (
  SELECT DISTINCT ON (key) key, id AS canonical_id
  FROM ranked
  ORDER BY key, doc_count DESC, created_at ASC
)
DELETE FROM public.knowledge_folders f
USING ranked r, canonicals c
WHERE f.id = r.id
  AND c.key = r.key
  AND f.id <> c.canonical_id;

-- 5) Unique index chống race condition tương lai
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_folders_name_ci_uniq
  ON public.knowledge_folders (lower(trim(name)));
