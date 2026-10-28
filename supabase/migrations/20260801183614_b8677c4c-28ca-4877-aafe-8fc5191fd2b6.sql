CREATE OR REPLACE FUNCTION public.get_ai_provider_mix(_days integer DEFAULT 7)
RETURNS TABLE(provider text, calls bigint, pct numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH rows AS (
    SELECT COALESCE(l.provider,
             CASE WHEN l.model_used LIKE 'google-ai-studio/%' THEN 'cloudflare'
                  WHEN l.model_used LIKE 'google/%' THEN 'lovable'
                  ELSE 'unknown' END) AS p
    FROM public.ai_routing_log l
    WHERE l.created_at > now() - make_interval(days => GREATEST(_days, 1))
  )
  SELECT r.p,
         COUNT(*)::bigint,
         ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM rows), 0), 1)
  FROM rows r
  GROUP BY r.p
  ORDER BY 2 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_provider_mix(integer) TO authenticated;