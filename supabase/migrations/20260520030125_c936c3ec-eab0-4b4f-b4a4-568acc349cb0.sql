CREATE OR REPLACE FUNCTION public.get_ai_core_kpi()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_priv boolean;
  result jsonb;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','coordinator')
  ) INTO is_priv;

  IF NOT is_priv THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT usage_type, usage_date, usage_count, user_id
    FROM public.ai_usage_tracking
    WHERE usage_date >= current_date - 30
  ),
  totals AS (
    SELECT
      coalesce(sum(usage_count) FILTER (WHERE usage_date = current_date),0) AS calls_today,
      coalesce(sum(usage_count) FILTER (WHERE usage_date >= current_date - 6),0) AS calls_7d,
      coalesce(sum(usage_count) FILTER (WHERE usage_date >= current_date - 29),0) AS calls_30d,
      count(DISTINCT user_id) FILTER (WHERE usage_date >= current_date - 6) AS active_users_7d,
      count(DISTINCT user_id) FILTER (WHERE usage_date >= current_date - 29) AS active_users_30d
    FROM base
  ),
  by_type AS (
    SELECT usage_type, sum(usage_count) AS total
    FROM base
    WHERE usage_date >= current_date - 29
    GROUP BY usage_type
  ),
  daily AS (
    SELECT
      d::date AS day,
      coalesce(sum(b.usage_count) FILTER (WHERE b.usage_type = 'chat'),0) AS chat,
      coalesce(sum(b.usage_count) FILTER (WHERE b.usage_type = 'generate_image'),0) AS image_gen,
      coalesce(sum(b.usage_count) FILTER (WHERE b.usage_type = 'edit_image'),0) AS image_edit
    FROM generate_series(current_date - 13, current_date, interval '1 day') d
    LEFT JOIN base b ON b.usage_date = d::date
    GROUP BY d
    ORDER BY d
  ),
  top_users AS (
    SELECT b.user_id, sum(b.usage_count) AS total
    FROM base b
    WHERE b.usage_date >= current_date - 6
    GROUP BY b.user_id
    ORDER BY total DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'totals', (SELECT to_jsonb(t) FROM totals t),
    'by_type', (SELECT coalesce(jsonb_agg(jsonb_build_object('type', usage_type, 'total', total) ORDER BY total DESC), '[]'::jsonb) FROM by_type),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', day, 'chat', chat, 'image_gen', image_gen, 'image_edit', image_edit) ORDER BY day), '[]'::jsonb) FROM daily),
    'top_users', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', tu.user_id,
        'display_name', coalesce(p.display_name, p.handle, left(tu.user_id::text, 8)),
        'total', tu.total
      ) ORDER BY tu.total DESC), '[]'::jsonb)
      FROM top_users tu
      LEFT JOIN public.profiles p ON p.user_id = tu.user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_core_kpi() TO authenticated;