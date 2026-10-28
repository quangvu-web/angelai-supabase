-- Hạ T threshold per-action từ 60 → 30 (vì Truth Gate đã check ở cấp 30 rồi)
UPDATE public.pplp_action_caps
SET thresholds = jsonb_set(
  COALESCE(thresholds, '{}'::jsonb),
  '{T}',
  '30'::jsonb
),
updated_at = now()
WHERE thresholds IS NOT NULL
  AND (thresholds->>'T')::numeric > 30;

-- Cập nhật scoring_rules nếu có
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='scoring_rules' AND column_name='formula_json'
  ) THEN
    UPDATE public.scoring_rules
    SET formula_json = jsonb_set(
      COALESCE(formula_json, '{}'::jsonb),
      '{thresholds,T}',
      '30'::jsonb
    )
    WHERE formula_json IS NOT NULL
      AND (formula_json->'thresholds'->>'T')::numeric > 30;
  END IF;
END $$;