
-- ============================================
-- RPC: check_feature_activation
-- Kiểm tra ngưỡng kích hoạt tính năng cho user
-- ============================================
CREATE OR REPLACE FUNCTION public.check_feature_activation(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thresholds JSONB;
  user_display_light NUMERIC := 0;
  user_trust_level TEXT := 'unverified';
  user_streak INT := 0;
  result JSONB := '{}'::jsonb;
  feature_key TEXT;
  feature_config JSONB;
  required_light NUMERIC;
  required_trust TEXT;
  required_streak INT;
  trust_order JSONB := '{"unverified":0,"basic":1,"verified":2,"strong":3,"core":4}'::jsonb;
  user_trust_rank INT;
  required_trust_rank INT;
  is_unlocked BOOLEAN;
BEGIN
  -- Đọc ngưỡng từ pplp_parameter_config
  SELECT value INTO thresholds
  FROM pplp_parameter_config
  WHERE key = 'activation_thresholds';

  -- Fallback nếu chưa có config
  IF thresholds IS NULL THEN
    thresholds := '{
      "earn_basic": {"display_light": 10, "trust_level": "basic"},
      "community_interact": {"display_light": 30, "trust_level": "basic"},
      "governance_vote": {"display_light": 200, "trust_level": "verified"},
      "create_proposal": {"display_light": 350, "trust_level": "strong"},
      "mentor_role": {"display_light": 150, "trust_level": "verified", "streak_days": 30},
      "validator_role": {"display_light": 300, "trust_level": "strong", "streak_days": 60}
    }'::jsonb;
  END IF;

  -- Lấy Display Light Score hiện tại
  SELECT COALESCE(display_light_score, 0)
  INTO user_display_light
  FROM user_light_scores
  WHERE user_id = _user_id;

  -- Xác định trust level từ hồ sơ
  SELECT
    CASE
      WHEN p.sbt_verified = true AND COALESCE(
        (SELECT streak_count FROM daily_login_tracking WHERE user_id = _user_id ORDER BY login_date DESC LIMIT 1), 0
      ) >= 90 THEN 'core'
      WHEN p.sbt_verified = true THEN 'strong'
      WHEN p.did_verified = true THEN 'verified'
      WHEN p.email_verified = true THEN 'basic'
      ELSE 'unverified'
    END
  INTO user_trust_level
  FROM profiles p
  WHERE p.id = _user_id;

  -- Lấy streak hiện tại
  SELECT COALESCE(streak_count, 0)
  INTO user_streak
  FROM daily_login_tracking
  WHERE user_id = _user_id
  ORDER BY login_date DESC
  LIMIT 1;

  user_trust_rank := COALESCE((trust_order->>user_trust_level)::int, 0);

  -- Kiểm tra từng cổng tính năng
  FOR feature_key, feature_config IN SELECT * FROM jsonb_each(thresholds)
  LOOP
    required_light := COALESCE((feature_config->>'display_light')::numeric, 0);
    required_trust := COALESCE(feature_config->>'trust_level', 'basic');
    required_streak := COALESCE((feature_config->>'streak_days')::int, 0);
    required_trust_rank := COALESCE((trust_order->>required_trust)::int, 0);

    is_unlocked := (
      user_display_light >= required_light
      AND user_trust_rank >= required_trust_rank
      AND user_streak >= required_streak
    );

    result := result || jsonb_build_object(
      feature_key, jsonb_build_object(
        'unlocked', is_unlocked,
        'required_light', required_light,
        'current_light', user_display_light,
        'required_trust', required_trust,
        'current_trust', user_trust_level,
        'required_streak', required_streak,
        'current_streak', user_streak,
        'label', COALESCE(feature_config->>'label', feature_key)
      )
    );
  END LOOP;

  RETURN result;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.check_feature_activation(UUID) TO authenticated;
