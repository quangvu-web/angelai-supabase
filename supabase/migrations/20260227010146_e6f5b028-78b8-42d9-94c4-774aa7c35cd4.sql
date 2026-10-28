
-- =============================================
-- Bước 2: Hàm detect_behavior_sequences và get_user_light_level
-- =============================================

-- 1. Hàm detect_behavior_sequences: Phát hiện và cập nhật chuỗi hành vi
CREATE OR REPLACE FUNCTION public.detect_behavior_sequences(_user_id UUID, _action_id UUID, _action_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sequence RECORD;
  v_result JSONB := '{"sequences_updated": 0, "sequences_completed": 0, "bonus_reward": 0}'::JSONB;
  v_updated INT := 0;
  v_completed INT := 0;
  v_bonus NUMERIC := 0;
  v_sequence_defs JSONB;
  v_def JSONB;
  v_stages TEXT[];
  v_seq_type TEXT;
  v_multiplier NUMERIC;
  v_max_stage INT;
  v_expected_action TEXT;
BEGIN
  -- Định nghĩa 5 chuỗi hành vi và các giai đoạn
  v_sequence_defs := '[
    {"type": "light_growth",       "stages": ["POST_CREATE", "POST_LIKE", "COMMENT_CREATE", "ANALYSIS_POST"], "multiplier": 2.0},
    {"type": "mentorship",         "stages": ["MENTOR_HELP", "PROFILE_COMPLETE", "POST_CREATE"],              "multiplier": 2.5},
    {"type": "value_creation",     "stages": ["LEARN_EARN_COMPLETE", "POST_CREATE", "SHARE_CONTENT"],         "multiplier": 2.0},
    {"type": "conflict_harmony",   "stages": ["CONFLICT_RESOLVE", "COMMENT_CREATE", "GRATITUDE_PUBLIC"],      "multiplier": 3.0},
    {"type": "economic_integrity", "stages": ["QUESTION_ASK", "DONATE_SUPPORT", "SHARE_CONTENT"],             "multiplier": 1.5}
  ]'::JSONB;

  -- Hết hạn các chuỗi quá 7 ngày
  UPDATE pplp_behavior_sequences
  SET status = 'expired', updated_at = now()
  WHERE user_id = _user_id
    AND status = 'active'
    AND expires_at < now();

  -- Duyệt từng định nghĩa chuỗi
  FOR v_def IN SELECT * FROM jsonb_array_elements(v_sequence_defs) LOOP
    v_seq_type := v_def->>'type';
    v_multiplier := (v_def->>'multiplier')::NUMERIC;
    v_stages := ARRAY(SELECT jsonb_array_elements_text(v_def->'stages'));
    v_max_stage := array_length(v_stages, 1);

    -- Tìm chuỗi đang hoạt động cho loại này
    SELECT * INTO v_sequence
    FROM pplp_behavior_sequences
    WHERE user_id = _user_id
      AND sequence_type = v_seq_type
      AND status = 'active'
    ORDER BY started_at DESC
    LIMIT 1;

    IF v_sequence IS NOT NULL THEN
      -- Kiểm tra action_type có khớp giai đoạn tiếp theo không
      v_expected_action := v_stages[v_sequence.stage + 1];

      IF _action_type = v_expected_action THEN
        IF v_sequence.stage + 1 >= v_max_stage THEN
          -- Hoàn thành chuỗi!
          UPDATE pplp_behavior_sequences
          SET stage = v_max_stage,
              status = 'completed',
              sequence_multiplier = v_multiplier,
              actions = array_append(actions, _action_id),
              completed_at = now(),
              updated_at = now()
          WHERE id = v_sequence.id;

          v_completed := v_completed + 1;
          v_bonus := v_bonus + v_multiplier;
        ELSE
          -- Tiến lên giai đoạn tiếp theo
          UPDATE pplp_behavior_sequences
          SET stage = stage + 1,
              actions = array_append(actions, _action_id),
              updated_at = now()
          WHERE id = v_sequence.id;

          v_updated := v_updated + 1;
        END IF;
      END IF;

    ELSE
      -- Chưa có chuỗi active cho loại này — kiểm tra xem action có phải giai đoạn 1 không
      IF _action_type = v_stages[1] THEN
        -- Kiểm tra giới hạn: tối đa 1 chuỗi cùng loại/tuần
        IF NOT EXISTS (
          SELECT 1 FROM pplp_behavior_sequences
          WHERE user_id = _user_id
            AND sequence_type = v_seq_type
            AND status = 'completed'
            AND completed_at > now() - interval '7 days'
        ) THEN
          INSERT INTO pplp_behavior_sequences (
            user_id, sequence_type, actions, stage, max_stage,
            sequence_multiplier, status, expires_at
          ) VALUES (
            _user_id, v_seq_type, ARRAY[_action_id], 1, v_max_stage,
            1.0, 'active', now() + interval '7 days'
          );
          v_updated := v_updated + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'sequences_updated', v_updated,
    'sequences_completed', v_completed,
    'bonus_multiplier', v_bonus
  );

  RETURN v_result;
END;
$$;

-- 2. Hàm get_user_light_level: Trả về cấp độ Light Level của người dùng
CREATE OR REPLACE FUNCTION public.get_user_light_level(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avg_score NUMERIC;
  v_completed_sequences INT;
  v_total_score NUMERIC;
  v_level RECORD;
  v_result JSONB;
BEGIN
  -- Tính Light Score trung bình từ pplp_scores
  SELECT COALESCE(AVG(light_score), 0), COUNT(*)
  INTO v_avg_score
  FROM pplp_scores s
  JOIN pplp_actions a ON a.id = s.action_id
  WHERE a.actor_id = _user_id
    AND s.decision = 'pass';

  -- Đếm số chuỗi đã hoàn thành
  SELECT COUNT(*) INTO v_completed_sequences
  FROM pplp_behavior_sequences
  WHERE user_id = _user_id
    AND status = 'completed';

  -- Tổng điểm = Light Score trung bình * 10 + chuỗi hoàn thành * 50
  v_total_score := (v_avg_score * 10) + (v_completed_sequences * 50);

  -- Tìm tầng phù hợp
  SELECT * INTO v_level
  FROM pplp_light_levels
  WHERE min_score <= v_total_score
    AND (max_score IS NULL OR max_score >= v_total_score)
  ORDER BY level DESC
  LIMIT 1;

  -- Nếu không tìm thấy, mặc định tầng 1
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
