
-- Fix get_user_light_level: cast date comparison correctly
CREATE OR REPLACE FUNCTION public.get_user_light_level(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_score NUMERIC := 0;
  v_total_score NUMERIC := 0;
  v_avg_action_score NUMERIC := 0;
  v_avg_content_score NUMERIC := 0;
  v_rep_weight NUMERIC := 1.0;
  v_consistency_mul NUMERIC := 1.0;
  v_sequence_mul NUMERIC := 1.0;
  v_integrity_pen NUMERIC := 0;
  v_level RECORD;
  v_completed_sequences INT := 0;
  v_epoch_start DATE;
  v_epoch_end DATE;
BEGIN
  v_epoch_start := date_trunc('month', CURRENT_DATE)::DATE;
  v_epoch_end := (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::DATE;

  SELECT
    COALESCE(AVG(f.base_action_score), 0),
    COALESCE(AVG(f.content_score), 0),
    COALESCE(AVG(f.reputation_weight), 1.0),
    COALESCE(AVG(f.consistency_multiplier), 1.0),
    COALESCE(AVG(f.sequence_multiplier), 1.0),
    COALESCE(AVG(f.integrity_penalty), 0)
  INTO v_avg_action_score, v_avg_content_score, v_rep_weight, v_consistency_mul, v_sequence_mul, v_integrity_pen
  FROM features_user_day f
  WHERE f.user_id = _user_id
    AND f.date >= v_epoch_start
    AND f.date <= v_epoch_end;

  v_base_score := (0.4 * v_avg_action_score) + (0.6 * v_avg_content_score);

  SELECT COUNT(*) INTO v_completed_sequences
  FROM pplp_behavior_sequences
  WHERE user_id = _user_id
    AND status = 'completed'
    AND completed_at >= v_epoch_start
    AND completed_at <= v_epoch_end + interval '1 day';

  v_base_score := v_base_score + (v_completed_sequences * 5);
  v_total_score := GREATEST(0, (v_base_score * v_rep_weight * v_consistency_mul * v_sequence_mul) - v_integrity_pen);

  SELECT * INTO v_level
  FROM pplp_light_levels
  WHERE v_total_score >= min_score
    AND (max_score IS NULL OR v_total_score < max_score)
  LIMIT 1;

  IF v_level IS NULL THEN
    SELECT * INTO v_level FROM pplp_light_levels ORDER BY min_score ASC LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'level', v_level.level,
    'name_vi', v_level.name_vi,
    'name_en', v_level.name_en,
    'icon', v_level.icon,
    'color', v_level.color,
    'total_score', ROUND(v_total_score, 2),
    'base_score', ROUND(v_base_score, 2),
    'avg_action_score', ROUND(v_avg_action_score, 2),
    'avg_content_score', ROUND(v_avg_content_score, 2),
    'reputation_weight', ROUND(v_rep_weight, 4),
    'consistency_multiplier', ROUND(v_consistency_mul, 4),
    'sequence_multiplier', ROUND(v_sequence_mul, 4),
    'integrity_penalty', ROUND(v_integrity_pen, 4),
    'completed_sequences', v_completed_sequences,
    'min_score', v_level.min_score,
    'max_score', v_level.max_score,
    'perks', COALESCE(v_level.perks, '[]'::jsonb)
  );
END;
$function$;

-- Fix get_community_light_summary: cast date comparison correctly
DROP FUNCTION IF EXISTS public.get_community_light_summary(uuid[]);

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
      AND f.date >= v_epoch_start
      AND f.date <= v_epoch_end
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
