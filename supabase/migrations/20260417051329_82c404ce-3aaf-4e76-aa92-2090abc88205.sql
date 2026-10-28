-- RPC: Lấy lịch sử chạy cron cho admin (bypass RLS bằng SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_trust_cron_health(_limit int DEFAULT 10)
RETURNS TABLE (
  jobname text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz,
  duration_ms numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  -- Chỉ admin được xem
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT
    j.jobname::text,
    d.status::text,
    d.return_message::text,
    d.start_time,
    d.end_time,
    EXTRACT(EPOCH FROM (d.end_time - d.start_time)) * 1000 AS duration_ms
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname IN ('compute-trust-engine-daily', 'identity-snapshot-weekly')
  ORDER BY d.start_time DESC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trust_cron_health(int) TO authenticated;