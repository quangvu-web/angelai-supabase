-- Bổ sung pplp_action_caps cho 5 action types còn thiếu
-- Chỉ insert nếu chưa tồn tại

INSERT INTO pplp_action_caps (action_type, platform_id, base_reward, max_per_user_daily, max_per_user_weekly, cooldown_seconds, diminishing_threshold, diminishing_factor, min_quality_score, multiplier_ranges, thresholds, is_active)
SELECT * FROM (VALUES
  ('POST_CREATE', 'FUN_PROFILE', 70, 5, 25, 0, 3, 0.80, 0.50, 
   '{"I": [0.8, 1.5], "K": [0.6, 1], "Q": [0.8, 2]}'::jsonb, 
   '{"LightScore": 60, "T": 70}'::jsonb, true),
  ('COMMENT_CREATE', 'FUN_PROFILE', 40, 10, 50, 0, 5, 0.80, 0.50, 
   '{"I": [0.8, 1.2], "K": [0.6, 1], "Q": [0.8, 1.5]}'::jsonb, 
   '{"LightScore": 50, "T": 60}'::jsonb, true),
  ('GRATITUDE_PRACTICE', 'FUNLIFE', 20, 3, 15, 0, 2, 0.70, 0.50, 
   '{"I": [0.8, 1.2], "K": [0.6, 1], "Q": [0.8, 1.5]}'::jsonb, 
   '{"LightScore": 50, "T": 60}'::jsonb, true),
  ('DONATE_SUPPORT', 'FUN_CHARITY', 120, 5, 20, 0, 3, 0.80, 0.50, 
   '{"I": [1, 3], "K": [0.8, 1], "Q": [1, 2]}'::jsonb, 
   '{"LightScore": 65, "S": 75, "T": 85}'::jsonb, true),
  ('JOURNAL_WRITE', 'FUNLIFE', 20, 3, 15, 0, 2, 0.70, 0.50, 
   '{"I": [0.8, 1.2], "K": [0.6, 1], "Q": [0.8, 1.5]}'::jsonb, 
   '{"LightScore": 50, "T": 60}'::jsonb, true)
) AS v(action_type, platform_id, base_reward, max_per_user_daily, max_per_user_weekly, cooldown_seconds, diminishing_threshold, diminishing_factor, min_quality_score, multiplier_ranges, thresholds, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM pplp_action_caps ac WHERE ac.action_type = v.action_type
);