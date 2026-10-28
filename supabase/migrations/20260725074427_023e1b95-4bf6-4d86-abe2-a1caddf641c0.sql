DO $$
DECLARE _j BIGINT;
BEGIN
  SELECT jobid INTO _j FROM cron.job WHERE jobname = 'knowledge-ingest-every-5min';
  IF _j IS NOT NULL THEN PERFORM cron.unschedule(_j); END IF;
END $$;

SELECT cron.schedule(
  'knowledge-ingest-every-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/knowledge-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzam9ldGlpdGN0cXphcHltdHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODA4NDAsImV4cCI6MjA4NDM1Njg0MH0.3fToeDf0bFqC4w730LiTOirFUexWlpOSdirS6wwsQgk',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzam9ldGlpdGN0cXphcHltdHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODA4NDAsImV4cCI6MjA4NDM1Njg0MH0.3fToeDf0bFqC4w730LiTOirFUexWlpOSdirS6wwsQgk',
      'x-cron-secret', public._get_internal_config('knowledge_ingest_cron_secret')
    ),
    body := '{"batch_size": 40, "max_batches": 3}'::jsonb
  );
  $cron$
);