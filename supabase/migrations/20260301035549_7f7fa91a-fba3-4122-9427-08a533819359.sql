CREATE OR REPLACE FUNCTION public.get_community_light_summary(_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  level integer,
  name_vi text,
  name_en text,
  icon text,
  color text,
  trend text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz := date_trunc('month', now());
  v_next_month_start timestamptz := date_trunc('month', now()) + interval '1 month';
BEGIN
  RETURN QUERY
  SELECT
    u.uid AS user_id,
    COALESCE(ll.level, 1)::integer AS level,
    COALESCE(ll.name_vi, 'Hiện diện tích cực')::text AS name_vi,
    COALESCE(ll.name_en, 'Light Presence')::text AS name_en,
    COALESCE(ll.icon, '🌱')::text AS icon,
    COALESCE(ll.color, '#8BC34A')::text AS color,
    COALESCE(lsl.trend, 'stable')::text AS trend
  FROM unnest(_user_ids) AS u(uid)
  LEFT JOIN LATERAL (
    SELECT
      pl.level,
      pl.name_vi,
      pl.name_en,
      pl.icon,
      pl.color
    FROM pplp_light_levels pl
    WHERE pl.min_score <= (
      (
        SELECT COALESCE(AVG(s.light_score), 0) * 10
        FROM pplp_scores s
        JOIN pplp_actions a ON a.id = s.action_id
        WHERE a.actor_id = u.uid
          AND s.decision = 'pass'
          AND s.created_at >= v_month_start
          AND s.created_at < v_next_month_start
      )
      +
      (
        SELECT COUNT(*) * 50
        FROM pplp_behavior_sequences bs
        WHERE bs.user_id = u.uid
          AND bs.status = 'completed'
          AND bs.completed_at IS NOT NULL
          AND bs.completed_at >= v_month_start
          AND bs.completed_at < v_next_month_start
      )
    )
    ORDER BY pl.min_score DESC
    LIMIT 1
  ) ll ON true
  LEFT JOIN LATERAL (
    SELECT lsl2.trend
    FROM light_score_ledger lsl2
    WHERE lsl2.user_id = u.uid
      AND lsl2.period = 'monthly'
      AND lsl2.period_start = v_month_start::date
    ORDER BY lsl2.computed_at DESC NULLS LAST
    LIMIT 1
  ) lsl ON true;
END;
$$;