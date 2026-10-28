-- 1) AI provider usage log
CREATE TABLE IF NOT EXISTS public.ai_provider_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  status INTEGER,
  user_id UUID,
  estimated_input_tokens INTEGER,
  estimated_output_tokens INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_log_created_at ON public.ai_provider_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_log_function ON public.ai_provider_usage_log (function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_log_provider ON public.ai_provider_usage_log (provider, created_at DESC);

GRANT SELECT ON public.ai_provider_usage_log TO authenticated;
GRANT ALL ON public.ai_provider_usage_log TO service_role;

ALTER TABLE public.ai_provider_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read provider usage log" ON public.ai_provider_usage_log;
CREATE POLICY "Admins can read provider usage log"
ON public.ai_provider_usage_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role can insert provider usage log" ON public.ai_provider_usage_log;
CREATE POLICY "Service role can insert provider usage log"
ON public.ai_provider_usage_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2) Cleanup old temp storage objects (chat-attachments + ai-images older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_temp_storage_objects()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  removed INTEGER := 0;
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id IN ('chat-attachments','ai-images')
    AND created_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

-- 3) Daily cleanup cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-temp-storage-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-temp-storage-daily');
    PERFORM cron.schedule(
      'cleanup-temp-storage-daily',
      '0 3 * * *',
      $cron$ SELECT public.cleanup_old_temp_storage_objects(); $cron$
    );
  END IF;
END $$;