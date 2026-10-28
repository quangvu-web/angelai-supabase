CREATE OR REPLACE FUNCTION public.purge_old_system_logs(_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - make_interval(days => GREATEST(_days, 7));
  t text;
  n bigint;
  result jsonb := '{}'::jsonb;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_routing_log',
    'ai_provider_usage_log',
    'rag_health_events',
    'box_function_error_log',
    'profile_view_events',
    'system_job_runs',
    'telegram_webapp_audit'
  ] LOOP
    EXECUTE format('DELETE FROM public.%I WHERE created_at < $1', t) USING cutoff;
    GET DIAGNOSTICS n = ROW_COUNT;
    result := result || jsonb_build_object(t, n);
  END LOOP;
  RETURN result || jsonb_build_object('cutoff', cutoff);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_system_logs(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_system_logs(integer) TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_routing_log_created_at ON public.ai_routing_log (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_log_created_at ON public.ai_provider_usage_log (created_at);
CREATE INDEX IF NOT EXISTS idx_rag_health_events_created_at ON public.rag_health_events (created_at);
CREATE INDEX IF NOT EXISTS idx_profile_view_events_created_at ON public.profile_view_events (created_at);
CREATE INDEX IF NOT EXISTS idx_system_job_runs_created_at ON public.system_job_runs (created_at);