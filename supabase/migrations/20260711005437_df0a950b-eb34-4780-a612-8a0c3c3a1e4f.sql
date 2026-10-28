
CREATE OR REPLACE FUNCTION public.log_cloud_usage(
  _function_name text,
  _bucket_start timestamptz,
  _duration_ms integer,
  _error boolean,
  _cost numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cloud_usage_snapshots
    (bucket_start, granularity, function_name, invocations, total_ms, error_count, estimated_cost_usd, avg_ms)
  VALUES
    (_bucket_start, 'hour', _function_name, 1, GREATEST(_duration_ms, 0), CASE WHEN _error THEN 1 ELSE 0 END, GREATEST(_cost, 0), GREATEST(_duration_ms, 0))
  ON CONFLICT (bucket_start, granularity, function_name) DO UPDATE
    SET invocations        = public.cloud_usage_snapshots.invocations + 1,
        total_ms           = public.cloud_usage_snapshots.total_ms + GREATEST(_duration_ms, 0),
        error_count        = public.cloud_usage_snapshots.error_count + CASE WHEN _error THEN 1 ELSE 0 END,
        estimated_cost_usd = public.cloud_usage_snapshots.estimated_cost_usd + GREATEST(_cost, 0),
        avg_ms             = (public.cloud_usage_snapshots.total_ms + GREATEST(_duration_ms, 0))::numeric
                             / NULLIF(public.cloud_usage_snapshots.invocations + 1, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_cloud_usage(text, timestamptz, integer, boolean, numeric) TO service_role;
