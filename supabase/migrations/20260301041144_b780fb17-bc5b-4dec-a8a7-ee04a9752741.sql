
-- ============================================================
-- Cập nhật get_user_light_level theo LS-Math v1.0
-- Formula: (AVG(light_score) × 10) × reputation_weight × consistency_multiplier × sequence_multiplier − integrity_penalty
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_light_level(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_next_month TIMESTAMPTZ := date_trunc('month', now()) + interval '1 month';
  v_avg_score NUMERIC;
  v_completed_sequences INT;
  v_base_score NUMERIC;
  v_rep_weight NUMERIC;
  v_consistency_mul NUMERIC;
  v_sequence_mul NUMERIC;
  v_integrity_pen NUMERIC;
  v_total_score NUMERIC;
  v_level RECORD;
  v_result JSONB;
BEGIN
  -- 1. Tính Light Score trung bình trong tháng hiện tại (từ pplp_scores)
  SELECT COALESCE(AVG(s.light_score), 0)
  INTO v_avg_score
  FROM pplp_scores s
  JOIN pplp_actions a ON a.id = s.action_id
  WHERE a.actor_id = _user_id
    AND s.decision = 'pass'
    AND s.created_at >= v_month_start
    AND s.created_at < v_next_month;

  -- 2. Đếm chuỗi hoàn thành trong tháng hiện tại
  SELECT COUNT(*) INTO v_completed_sequences
  FROM pplp_behavior_sequences
  WHERE user_id = _user_id
    AND status = 'completed'
    AND completed_at IS NOT NULL
    AND completed_at >= v_month_start
    AND completed_at < v_next_month;

  -- 3. Lấy các hệ số từ features_user_day (trung bình tháng hiện tại)
  --    Theo LS-Math v1.0: Reputation Weight, Consistency Multiplier, Sequence Multiplier, Integrity Penalty
  SELECT
    COALESCE(AVG(f.reputation_weight), 1.0),
    COALESCE(AVG(f.consistency_multiplier), 1.0),
    COALESCE(AVG(f.sequence_multiplier), 1.0),
    COALESCE(AVG(f.integrity_penalty), 0)
  INTO v_rep_weight, v_consistency_mul, v_sequence_mul, v_integrity_pen
  FROM features_user_day f
  WHERE f.user_id = _user_id
    AND f.date >= v_month_start::date
    AND f.date < v_next_month::date;

  -- 4. LS-Math v1.0 công thức đầy đủ:
  --    Base = (AVG_light_score × 10) + (completed_sequences × 50)
  --    Total = Base × reputation_weight × consistency_multiplier × sequence_multiplier − integrity_penalty
  v_base_score := (v_avg_score * 10) + (v_completed_sequences * 50);
  v_total_score := GREATEST(0, 
    (v_base_score * v_rep_weight * v_consistency_mul * v_sequence_mul) - v_integrity_pen
  );

  -- 5. Tra cứu cấp độ
  SELECT * INTO v_level
  FROM pplp_light_levels
  WHERE min_score <= v_total_score
    AND (max_score IS NULL OR max_score >= v_total_score)
  ORDER BY level DESC
  LIMIT 1;

  IF v_level IS NULL THEN
    SELECT * INTO v_level FROM pplp_light_levels WHERE level = 1;
  END IF;

  v_result := jsonb_build_object(
    'level', v_level.level,
    'name_vi', v_level.name_vi,
    'name_en', v_level.name_en,
    'icon', v_level.icon,
    'color', v_level.color,
    'total_score', ROUND(v_total_score, 2),
    'avg_light_score', ROUND(v_avg_score, 2),
    'completed_sequences', v_completed_sequences,
    'min_score', v_level.min_score,
    'max_score', v_level.max_score,
    'perks', v_level.perks,
    -- LS-Math v1.0 multipliers (để minh bạch)
    'reputation_weight', ROUND(v_rep_weight, 3),
    'consistency_multiplier', ROUND(v_consistency_mul, 3),
    'sequence_multiplier', ROUND(v_sequence_mul, 3),
    'integrity_penalty', ROUND(v_integrity_pen, 3)
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- Cập nhật get_community_light_summary đồng bộ LS-Math v1.0
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_community_light_summary(_user_ids uuid[])
 RETURNS TABLE(user_id uuid, level integer, name_vi text, name_en text, icon text, color text, trend text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE pl.min_score <= GREATEST(0,
      (
        -- Base score = AVG(light_score) × 10 + completed_sequences × 50
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
      -- × LS-Math v1.0 multipliers
      * COALESCE((SELECT AVG(f.reputation_weight) FROM features_user_day f WHERE f.user_id = u.uid AND f.date >= v_month_start::date AND f.date < v_next_month_start::date), 1.0)
      * COALESCE((SELECT AVG(f.consistency_multiplier) FROM features_user_day f WHERE f.user_id = u.uid AND f.date >= v_month_start::date AND f.date < v_next_month_start::date), 1.0)
      * COALESCE((SELECT AVG(f.sequence_multiplier) FROM features_user_day f WHERE f.user_id = u.uid AND f.date >= v_month_start::date AND f.date < v_next_month_start::date), 1.0)
      -- − integrity_penalty
      - COALESCE((SELECT AVG(f.integrity_penalty) FROM features_user_day f WHERE f.user_id = u.uid AND f.date >= v_month_start::date AND f.date < v_next_month_start::date), 0)
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
$function$;
