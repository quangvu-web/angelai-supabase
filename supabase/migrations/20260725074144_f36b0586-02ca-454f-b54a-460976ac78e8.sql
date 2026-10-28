-- 1) Bảng cấu hình nội bộ (chỉ service role)
CREATE TABLE IF NOT EXISTS public.internal_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_config TO service_role;
ALTER TABLE public.internal_config ENABLE ROW LEVEL SECURITY;
-- Không tạo policy nào => chỉ service_role (bypass RLS) đọc được.

-- 2) Sinh secret nếu chưa có
INSERT INTO public.internal_config (key, value)
VALUES ('knowledge_ingest_cron_secret', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 3) Hàm đọc secret nội bộ (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public._get_internal_config(_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.internal_config WHERE key = _key
$$;

REVOKE ALL ON FUNCTION public._get_internal_config(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._get_internal_config(TEXT) TO service_role;

-- 4) Cập nhật cron: chạy mỗi 5 phút, dùng x-cron-secret
DO $$
DECLARE
  _existing_jobid BIGINT;
BEGIN
  SELECT jobid INTO _existing_jobid FROM cron.job WHERE jobname = 'knowledge-ingest-every-2min';
  IF _existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(_existing_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'knowledge-ingest-every-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/knowledge-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public._get_internal_config('knowledge_ingest_cron_secret')
    ),
    body := '{"batch_size": 40, "max_batches": 3}'::jsonb
  );
  $cron$
);