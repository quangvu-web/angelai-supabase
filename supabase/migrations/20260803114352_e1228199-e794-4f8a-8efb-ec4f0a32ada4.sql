CREATE OR REPLACE FUNCTION public.get_cloud_footprint()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jobs jsonb;
  tables jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'jobname'), '[]'::jsonb) INTO jobs
  FROM (
    SELECT jsonb_build_object(
      'jobname', jobname,
      'schedule', schedule,
      'runs_per_day',
        CASE
          WHEN schedule LIKE '*/%' AND split_part(schedule, ' ', 2) = '*'
            THEN round(1440.0 / GREATEST(nullif(replace(split_part(schedule, ' ', 1), '*/', ''), '')::numeric, 1))
          WHEN split_part(schedule, ' ', 2) LIKE '*/%'
            THEN round(24.0 / GREATEST(nullif(replace(split_part(schedule, ' ', 2), '*/', ''), '')::numeric, 1))
          WHEN split_part(schedule, ' ', 3) = '*' AND split_part(schedule, ' ', 5) = '*' THEN 1
          ELSE 0
        END
    ) AS x
    FROM cron.job WHERE active
  ) s;

  SELECT coalesce(jsonb_agg(y), '[]'::jsonb) INTO tables
  FROM (
    SELECT jsonb_build_object(
      'table', c.relname,
      'bytes', pg_total_relation_size(c.oid),
      'pretty', pg_size_pretty(pg_total_relation_size(c.oid))
    ) AS y
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'jobs', jobs,
    'tables', tables,
    'db_size_pretty', pg_size_pretty(pg_database_size(current_database()))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_cloud_footprint() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_cloud_footprint() TO authenticated, service_role;