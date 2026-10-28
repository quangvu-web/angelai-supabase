
-- 1) Config table
CREATE TABLE IF NOT EXISTS public.telegram_ingest_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_pattern text NOT NULL UNIQUE,
  paused boolean NOT NULL DEFAULT false,
  min_content_length int NOT NULL DEFAULT 40,
  min_meaningful_words int NOT NULL DEFAULT 6,
  require_role text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_ingest_config TO authenticated;
GRANT ALL ON public.telegram_ingest_config TO service_role;

ALTER TABLE public.telegram_ingest_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read config" ON public.telegram_ingest_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins write config" ON public.telegram_ingest_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_update_telegram_ingest_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_telegram_ingest_config_updated_at
  BEFORE UPDATE ON public.telegram_ingest_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_update_telegram_ingest_config_updated_at();

-- 2) Index dedup cross-source (chỉ với telegram*)
CREATE INDEX IF NOT EXISTS knowledge_documents_content_hash_telegram_idx
  ON public.knowledge_documents (content_hash)
  WHERE source ILIKE 'telegram%';

-- 3) Seed 1 dòng ví dụ (paused=false) cho folder chính
INSERT INTO public.telegram_ingest_config (folder_pattern, note)
VALUES ('Telegram / %', 'Áp dụng chung cho mọi nguồn Telegram — override bằng pattern cụ thể hơn')
ON CONFLICT (folder_pattern) DO NOTHING;
