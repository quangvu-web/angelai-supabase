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
  v_total_score NUMERIC;
  v_level RECORD;
  v_result JSONB;
BEGIN
  -- Tính Light Score trung bình CHỈ trong tháng hiện tại
  SELECT COALESCE(AVG(s.light_score), 0)
  INTO v_avg_score
  FROM pplp_scores s
  JOIN pplp_actions a ON a.id = s.action_id
  WHERE a.actor_id = _user_id
    AND s.decision = 'pass'
    AND s.created_at >= v_month_start
    AND s.created_at < v_next_month;

  -- Đếm chuỗi hoàn thành CHỈ trong tháng hiện tại
  SELECT COUNT(*) INTO v_completed_sequences
  FROM pplp_behavior_sequences
  WHERE user_id = _user_id
    AND status = 'completed'
    AND completed_at IS NOT NULL
    AND completed_at >= v_month_start
    AND completed_at < v_next_month;

  v_total_score := (v_avg_score * 10) + (v_completed_sequences * 50);

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
    'perks', v_level.perks
  );

  RETURN v_result;
END;
$$;