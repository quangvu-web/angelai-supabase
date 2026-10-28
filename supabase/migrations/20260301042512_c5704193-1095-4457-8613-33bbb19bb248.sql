
-- Drop old function with changed return type
DROP FUNCTION IF EXISTS public.get_community_light_summary(uuid[]);

-- Recreate with LS-Math v1.0 Base Score: 0.4*B + 0.6*C
CREATE OR REPLACE FUNCTION public.get_community_light_summary(_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  display_name text,
  avatar_url text,
  handle text,
  light_level int,
  level_name_vi text,
  level_icon text,
  level_color text,
  total_score numeric,
  completed_sequences bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_epoch_start DATE;
  v_epoch_end DATE;
BEGIN
  v_epoch_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_epoch_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;

  RETURN QUERY
  WITH user_scores AS (
    SELECT
      f.user_id,
      COALESCE(AVG(f.base_action_score), 0) AS avg_b,
      COALESCE(AVG(f.content_score), 0) AS avg_c,
      COALESCE(AVG(f.reputation_weight), 1.0) AS rep_w,
      COALESCE(AVG(f.consistency_multiplier), 1.0) AS cons_m,
      COALESCE(AVG(f.sequence_multiplier), 1.0) AS seq_m,
      COALESCE(AVG(f.integrity_penalty), 0) AS int_p
    FROM features_user_day f
    WHERE f.user_id = ANY(_user_ids)
      AND f.date >= v_epoch_start::TEXT
      AND f.date <= v_epoch_end::TEXT
    GROUP BY f.user_id
  ),
  seq_counts AS (
    SELECT bs.user_id, COUNT(*)::BIGINT AS cnt
    FROM pplp_behavior_sequences bs
    WHERE bs.user_id = ANY(_user_ids)
      AND bs.status = 'completed'
      AND bs.completed_at >= v_epoch_start
      AND bs.completed_at <= v_epoch_end + interval '1 day'
    GROUP BY bs.user_id
  ),
  final_scores AS (
    SELECT
      p.user_id,
      p.display_name,
      p.avatar_url,
      p.handle,
      COALESCE(sc.cnt, 0) AS completed_seq,
      GREATEST(0,
        (((0.4 * COALESCE(us.avg_b, 0)) + (0.6 * COALESCE(us.avg_c, 0)) + (COALESCE(sc.cnt, 0) * 5))
         * COALESCE(us.rep_w, 1.0)
         * COALESCE(us.cons_m, 1.0)
         * COALESCE(us.seq_m, 1.0))
        - COALESCE(us.int_p, 0)
      ) AS t_score
    FROM profiles p
    LEFT JOIN user_scores us ON us.user_id = p.user_id
    LEFT JOIN seq_counts sc ON sc.user_id = p.user_id
    WHERE p.user_id = ANY(_user_ids)
  )
  SELECT
    fs.user_id,
    fs.display_name,
    fs.avatar_url,
    fs.handle,
    COALESCE(ll.level, 1) AS light_level,
    COALESCE(ll.name_vi, 'Hạt giống Ánh Sáng') AS level_name_vi,
    COALESCE(ll.icon, '🌱') AS level_icon,
    COALESCE(ll.color, '#4ade80') AS level_color,
    ROUND(fs.t_score, 2) AS total_score,
    fs.completed_seq AS completed_sequences
  FROM final_scores fs
  LEFT JOIN LATERAL (
    SELECT l.level, l.name_vi, l.icon, l.color
    FROM pplp_light_levels l
    WHERE fs.t_score >= l.min_score
      AND (l.max_score IS NULL OR fs.t_score < l.max_score)
    LIMIT 1
  ) ll ON true
  ORDER BY fs.t_score DESC;
END;
$function$;
