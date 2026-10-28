CREATE OR REPLACE VIEW public.image_generation_error_stats AS
SELECT
  date_trunc('day', created_at)::date AS day,
  function_name,
  provider,
  COALESCE(metadata->>'error_code', 'ok') AS error_code,
  COUNT(*)::int AS event_count
FROM public.ai_provider_usage_log
WHERE function_name IN ('generate-image', 'edit-image')
  AND created_at > now() - interval '30 days'
GROUP BY 1, 2, 3, 4;

GRANT SELECT ON public.image_generation_error_stats TO authenticated;

CREATE OR REPLACE FUNCTION public.get_image_error_rates(_days int DEFAULT 7)
RETURNS TABLE(
  error_code text,
  provider text,
  event_count bigint,
  pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped AS (
    SELECT
      COALESCE(metadata->>'error_code', 'ok') AS error_code,
      provider,
      COUNT(*) AS event_count
    FROM public.ai_provider_usage_log
    WHERE function_name IN ('generate-image', 'edit-image')
      AND created_at > now() - (_days || ' days')::interval
      AND public.has_role(auth.uid(), 'admin'::app_role)
    GROUP BY 1, 2
  ),
  total AS (SELECT SUM(event_count) AS t FROM scoped)
  SELECT
    scoped.error_code,
    scoped.provider,
    scoped.event_count,
    ROUND(100.0 * scoped.event_count / NULLIF((SELECT t FROM total), 0), 2) AS pct
  FROM scoped
  ORDER BY event_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_image_error_rates(int) TO authenticated;