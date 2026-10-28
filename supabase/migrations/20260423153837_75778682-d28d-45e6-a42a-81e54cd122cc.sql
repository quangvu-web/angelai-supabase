-- Tạm hạ ngưỡng T xuống 60 và LightScore xuống 50 cho mọi action types đang vượt
UPDATE public.pplp_action_caps
SET thresholds = jsonb_set(
  jsonb_set(thresholds, '{T}', '60'::jsonb, true),
  '{LightScore}', '50'::jsonb, true
)
WHERE is_active = true
  AND (
    (thresholds->>'T')::numeric > 60
    OR (thresholds->>'LightScore')::numeric > 50
  );