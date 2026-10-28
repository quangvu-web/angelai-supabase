
-- System Health overview (security definer to access cron schema)
CREATE OR REPLACE FUNCTION public.get_system_health_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_role boolean;
  v_cron jsonb;
  v_errors jsonb;
  v_fraud jsonb;
  v_audit jsonb;
  v_db jsonb;
BEGIN
  -- Access control: admin or coordinator only
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','coordinator')
  ) INTO v_role;
  IF NOT v_role THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Cron jobs + last run status
  WITH last_run AS (
    SELECT DISTINCT ON (jobid) jobid, status, start_time, end_time, return_message
    FROM cron.job_run_details
    ORDER BY jobid, start_time DESC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'jobname', j.jobname,
    'schedule', j.schedule,
    'active', j.active,
    'last_status', lr.status,
    'last_start', lr.start_time,
    'last_end', lr.end_time,
    'last_message', LEFT(COALESCE(lr.return_message, ''), 200)
  ) ORDER BY j.jobname), '[]'::jsonb)
  INTO v_cron
  FROM cron.job j
  LEFT JOIN last_run lr ON lr.jobid = j.jobid;

  -- Edge function errors (24h, top 50)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'function_name', function_name,
    'severity', severity,
    'sqlstate', sqlstate,
    'message', LEFT(COALESCE(message, ''), 200),
    'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_errors
  FROM (
    SELECT * FROM public.box_function_error_log
    WHERE created_at > now() - interval '24 hours'
    ORDER BY created_at DESC
    LIMIT 50
  ) e;

  -- Fraud alerts (24h)
  SELECT jsonb_build_object(
    'total_24h', COUNT(*),
    'unreviewed', COUNT(*) FILTER (WHERE NOT is_reviewed),
    'severe', COUNT(*) FILTER (WHERE severity IN ('high','critical')),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'alert_type', alert_type, 'severity', severity,
        'is_reviewed', is_reviewed, 'created_at', created_at,
        'matched_pattern', LEFT(COALESCE(matched_pattern,''), 80)
      ) ORDER BY created_at DESC)
      FROM (
        SELECT * FROM public.fraud_alerts
        WHERE created_at > now() - interval '24 hours'
        ORDER BY created_at DESC LIMIT 20
      ) r
    ), '[]'::jsonb)
  )
  INTO v_fraud
  FROM public.fraud_alerts
  WHERE created_at > now() - interval '24 hours';

  -- Audit backlog
  SELECT jsonb_build_object(
    'pplp_audits_pending', (SELECT COUNT(*) FROM public.pplp_audits WHERE status = 'pending'),
    'pplp_audits_resolved_24h', (SELECT COUNT(*) FROM public.pplp_audits WHERE status <> 'pending' AND updated_at > now() - interval '24 hours'),
    'backlog_audit_pending', (SELECT COUNT(*) FROM public.pplp_backlog_audit WHERE resolved_at IS NULL)
  ) INTO v_audit;

  -- DB stats (basic)
  SELECT jsonb_build_object(
    'db_size_mb', round((pg_database_size(current_database())::numeric)/1024/1024, 1),
    'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())
  ) INTO v_db;

  RETURN jsonb_build_object(
    'cron_jobs', v_cron,
    'edge_errors', v_errors,
    'fraud', v_fraud,
    'audit', v_audit,
    'db', v_db,
    'computed_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_system_health_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_system_health_overview() TO authenticated;
