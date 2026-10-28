
-- Function for immediate self-continuation via pg_net
CREATE OR REPLACE FUNCTION public._batch_minter_schedule_continuation(
  _url TEXT,
  _api_key TEXT,
  _depth INT,
  _delay_seconds INT DEFAULT 5
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _api_key
    ),
    body := jsonb_build_object('dry_run', false, '_continuation_depth', _depth)
  );
END;
$$;

-- Function to schedule a one-time pg_cron job after epoch reset
CREATE OR REPLACE FUNCTION public._batch_minter_schedule_post_epoch(
  _job_name TEXT,
  _cron_expr TEXT,
  _url TEXT,
  _api_key TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up old one-time batch-minter jobs
  DELETE FROM cron.job WHERE jobname LIKE 'batch-minter-post-epoch-%';
  
  -- Schedule a one-time job
  PERFORM cron.schedule(
    _job_name,
    _cron_expr,
    format(
      $SQL$
      SELECT net.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{"dry_run": false, "_continuation_depth": 0}'::jsonb
      ) AS request_id;
      -- Auto-unschedule after running
      SELECT cron.unschedule(%L);
      $SQL$,
      _url, _api_key, _job_name
    )
  );
END;
$$;

-- Grant execute to service_role only (these are called from edge functions)
REVOKE ALL ON FUNCTION public._batch_minter_schedule_continuation FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._batch_minter_schedule_continuation TO service_role;

REVOKE ALL ON FUNCTION public._batch_minter_schedule_post_epoch FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._batch_minter_schedule_post_epoch TO service_role;
