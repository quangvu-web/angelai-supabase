
-- Đảm bảo extensions sẵn sàng
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Xoá job cũ (nếu có) trước khi tạo lại
DO $$
BEGIN
  PERFORM cron.unschedule('quest-daily-rotate-vn');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('quest-streak-tick-vn');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 00:00 UTC+7 = 17:00 UTC
SELECT cron.schedule(
  'quest-daily-rotate-vn',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/quest-daily-rotate',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 00:30 UTC+7 = 17:30 UTC
SELECT cron.schedule(
  'quest-streak-tick-vn',
  '30 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/quest-streak-tick',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
