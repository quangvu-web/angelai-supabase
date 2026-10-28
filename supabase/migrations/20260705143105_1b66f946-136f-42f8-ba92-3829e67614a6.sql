
-- Daily AI usage summary from ai_routing_log
CREATE OR REPLACE FUNCTION public.get_cloud_cost_daily(_days int DEFAULT 14)
RETURNS TABLE(
  day date,
  calls bigint,
  tokens_in bigint,
  tokens_out bigint,
  avg_latency_ms numeric,
  p95_latency_ms numeric,
  errors bigint,
  fallbacks bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (created_at AT TIME ZONE 'UTC')::date AS day,
    count(*)::bigint AS calls,
    COALESCE(sum(tokens_in),0)::bigint AS tokens_in,
    COALESCE(sum(tokens_out),0)::bigint AS tokens_out,
    ROUND(AVG(latency_ms)::numeric, 0) AS avg_latency_ms,
    ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::numeric, 0) AS p95_latency_ms,
    count(*) FILTER (WHERE status IS DISTINCT FROM 'success')::bigint AS errors,
    count(*) FILTER (WHERE fallback_triggered)::bigint AS fallbacks
  FROM public.ai_routing_log
  WHERE created_at >= now() - (_days || ' days')::interval
    AND public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

-- Top AI intents (which tasks consume the most)
CREATE OR REPLACE FUNCTION public.get_cloud_cost_top_intents(_days int DEFAULT 7, _limit int DEFAULT 20)
RETURNS TABLE(
  intent text,
  model_used text,
  calls bigint,
  tokens_total bigint,
  avg_latency_ms numeric,
  errors bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(intent,'(unknown)') AS intent,
    COALESCE(model_used,'(unknown)') AS model_used,
    count(*)::bigint AS calls,
    COALESCE(sum(COALESCE(tokens_in,0) + COALESCE(tokens_out,0)),0)::bigint AS tokens_total,
    ROUND(AVG(latency_ms)::numeric, 0) AS avg_latency_ms,
    count(*) FILTER (WHERE status IS DISTINCT FROM 'success')::bigint AS errors
  FROM public.ai_routing_log
  WHERE created_at >= now() - (_days || ' days')::interval
    AND public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY 1,2
  ORDER BY tokens_total DESC NULLS LAST, calls DESC
  LIMIT _limit;
$$;

-- Top slow queries from pg_stat_statements (public + user schemas only)
CREATE OR REPLACE FUNCTION public.get_cloud_top_slow_queries(_limit int DEFAULT 15)
RETURNS TABLE(
  query text,
  calls bigint,
  total_ms numeric,
  mean_ms numeric,
  max_ms numeric,
  rows_returned bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT
    LEFT(s.query, 300) AS query,
    s.calls,
    ROUND(s.total_exec_time::numeric, 1) AS total_ms,
    ROUND(s.mean_exec_time::numeric, 2) AS mean_ms,
    ROUND(s.max_exec_time::numeric, 1) AS max_ms,
    s.rows AS rows_returned
  FROM public.pg_stat_statements s
  JOIN pg_database d ON d.oid = s.dbid
  WHERE d.datname = current_database()
    AND s.query NOT ILIKE '%pg_stat_statements%'
    AND s.query NOT ILIKE '%pg_catalog.%'
    AND s.query NOT ILIKE '%information_schema%'
  ORDER BY s.total_exec_time DESC
  LIMIT _limit;
EXCEPTION WHEN undefined_table THEN
  -- pg_stat_statements not exposed in public — try extensions schema
  RETURN QUERY
  SELECT
    LEFT(s.query, 300) AS query,
    s.calls,
    ROUND(s.total_exec_time::numeric, 1) AS total_ms,
    ROUND(s.mean_exec_time::numeric, 2) AS mean_ms,
    ROUND(s.max_exec_time::numeric, 1) AS max_ms,
    s.rows AS rows_returned
  FROM extensions.pg_stat_statements s
  JOIN pg_database d ON d.oid = s.dbid
  WHERE d.datname = current_database()
    AND s.query NOT ILIKE '%pg_stat_statements%'
    AND s.query NOT ILIKE '%pg_catalog.%'
    AND s.query NOT ILIKE '%information_schema%'
  ORDER BY s.total_exec_time DESC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cloud_cost_daily(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cloud_cost_top_intents(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cloud_top_slow_queries(int) TO authenticated;
