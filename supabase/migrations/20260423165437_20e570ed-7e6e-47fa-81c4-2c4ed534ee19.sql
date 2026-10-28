-- Hạ threshold LightScore per-action từ 50 → 15
UPDATE public.pplp_action_caps
SET thresholds = jsonb_set(
  COALESCE(thresholds, '{}'::jsonb),
  '{LightScore}',
  '15'::jsonb
),
updated_at = now()
WHERE thresholds IS NOT NULL
  AND (thresholds->>'LightScore')::int > 15;

-- Cập nhật scoring_rules nếu có cột formula_json
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='scoring_rules' AND column_name='formula_json'
  ) THEN
    UPDATE public.scoring_rules
    SET formula_json = jsonb_set(
      COALESCE(formula_json, '{}'::jsonb),
      '{thresholds,LightScore}',
      '15'::jsonb
    )
    WHERE formula_json IS NOT NULL
      AND (formula_json->'thresholds'->>'LightScore')::int > 15;
  END IF;
END $$;