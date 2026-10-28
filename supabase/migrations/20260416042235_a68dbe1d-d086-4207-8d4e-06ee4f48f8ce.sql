
DROP FUNCTION IF EXISTS public.preview_epoch_allocation(uuid);

CREATE OR REPLACE FUNCTION public.preview_epoch_allocation(_user_id uuid)
RETURNS TABLE(
  my_light_score numeric,
  total_light numeric,
  mint_pool numeric,
  estimated_allocation numeric,
  my_ratio numeric,
  is_eligible boolean,
  ineligibility_reason text,
  days_remaining integer,
  epoch_period text,
  instant_amount numeric,
  locked_amount numeric,
  vesting_days integer,
  micro_epoch_score numeric,
  validation_epoch_score numeric,
  mint_epoch_progress numeric,
  adaptive_mint_base numeric,
  adaptive_mint_contribution numeric,
  adaptive_mint_ecosystem numeric,
  discipline_modulator numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cycle RECORD;
  v_my_score NUMERIC := 0;
  v_total_light NUMERIC := 0;
  v_pool NUMERIC := 0;
  v_ratio NUMERIC := 0;
  v_alloc NUMERIC := 0;
  v_eligible BOOLEAN := true;
  v_reason TEXT := 'ELIGIBLE';
  v_days INT := 0;
  v_period TEXT := '';
  v_epoch_start DATE;
  v_epoch_end DATE;
  v_base_rate NUMERIC := 500000;
  v_stage_factor NUMERIC := 1.2;
  v_base_expansion NUMERIC := 0;
  v_contrib_expansion NUMERIC := 0;
  v_eco_expansion NUMERIC := 0;
  v_discipline NUMERIC := 1.0;
  v_raw_mint NUMERIC := 0;
  v_min_mint NUMERIC := 100000;
  v_max_mint NUMERIC := 50000000;
  v_user_reward_pct NUMERIC := 0.70;
  v_instant NUMERIC := 0;
  v_locked NUMERIC := 0;
  v_vesting_days INT := 28;
  v_micro_score NUMERIC := 0;
  v_validation_score NUMERIC := 0;
  v_mint_progress NUMERIC := 0;
  v_total_contrib_value NUMERIC := 0;
  v_service_impact NUMERIC := 0;
  v_active_quality INT := 0;
  v_action_count INT := 0;
  v_action_types INT := 0;
  v_config_val JSONB;
BEGIN
  SELECT * INTO v_cycle FROM pplp_mint_cycles WHERE status = 'open' ORDER BY created_at DESC LIMIT 1;

  IF v_cycle IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 
      false, 'NO_ACTIVE_CYCLE'::TEXT, 0, ''::TEXT,
      0::NUMERIC, 0::NUMERIC, 0::INT, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC,
      0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  v_epoch_start := v_cycle.start_date::DATE;
  v_epoch_end := v_cycle.end_date::DATE;
  v_days := GREATEST(0, (v_epoch_end - CURRENT_DATE));
  v_period := to_char(v_cycle.start_date, 'YYYY-MM');

  -- Load config
  SELECT config_value INTO v_config_val FROM epoch_config WHERE config_key = 'base_expansion';
  IF v_config_val IS NOT NULL THEN v_base_rate := COALESCE((v_config_val->>'base_rate')::NUMERIC, 500000); END IF;

  SELECT config_value INTO v_config_val FROM epoch_config WHERE config_key = 'system_stage';
  IF v_config_val IS NOT NULL THEN
    v_stage_factor := CASE (v_config_val->>'stage')::INT WHEN 1 THEN 1.2 WHEN 2 THEN 1.0 WHEN 3 THEN 0.7 ELSE 1.0 END;
  END IF;

  SELECT config_value INTO v_config_val FROM epoch_config WHERE config_key = 'mint_guardrails';
  IF v_config_val IS NOT NULL THEN
    v_min_mint := COALESCE((v_config_val->>'min_epoch_mint')::NUMERIC, 100000);
    v_max_mint := COALESCE((v_config_val->>'max_epoch_mint')::NUMERIC, 50000000);
  END IF;

  SELECT config_value INTO v_config_val FROM epoch_config WHERE config_key = 'allocation_buckets';
  IF v_config_val IS NOT NULL THEN v_user_reward_pct := COALESCE((v_config_val->>'user_reward')::NUMERIC, 0.70); END IF;

  -- My light score
  SELECT COALESCE(SUM(daily_light_score), 0) INTO v_my_score
  FROM features_user_day WHERE user_id = _user_id AND date >= v_epoch_start::TEXT AND date <= v_epoch_end::TEXT AND daily_light_score > 0;

  -- Total light
  SELECT COALESCE(SUM(daily_light_score), 0) INTO v_total_light
  FROM features_user_day WHERE date >= v_epoch_start::TEXT AND date <= v_epoch_end::TEXT AND daily_light_score > 0;

  -- Adaptive mint: Base
  v_base_expansion := v_base_rate * v_stage_factor;

  -- Contribution expansion
  SELECT COALESCE(SUM(COALESCE(pillar_repentance,0)+COALESCE(pillar_gratitude,0)+COALESCE(pillar_service,0)+COALESCE(pillar_helping,0)+COALESCE(pillar_giving,0)),0)
  INTO v_total_contrib_value FROM pplp_scores WHERE created_at >= v_epoch_start::TIMESTAMPTZ AND created_at <= v_epoch_end::TIMESTAMPTZ;

  SELECT COALESCE(SUM(COALESCE(pillar_service,0)+COALESCE(pillar_helping,0)+COALESCE(pillar_giving,0)),0)
  INTO v_service_impact FROM pplp_scores WHERE created_at >= v_epoch_start::TIMESTAMPTZ AND created_at <= v_epoch_end::TIMESTAMPTZ;

  v_contrib_expansion := 0.5 * ln(1 + v_total_light) * 1000 + 0.3 * sqrt(1 + v_total_contrib_value) * 1000 + 0.2 * sqrt(1 + v_service_impact) * 1000;

  -- Ecosystem expansion
  SELECT COUNT(DISTINCT user_id) INTO v_active_quality FROM (
    SELECT user_id FROM features_user_day WHERE date >= v_epoch_start::TEXT AND date <= v_epoch_end::TEXT AND daily_light_score > 0
    GROUP BY user_id HAVING COUNT(DISTINCT date) >= 3
  ) sub;

  SELECT COUNT(*) INTO v_action_count FROM pplp_actions WHERE created_at >= v_epoch_start::TIMESTAMPTZ AND created_at <= v_epoch_end::TIMESTAMPTZ;
  SELECT COUNT(DISTINCT action_type) INTO v_action_types FROM pplp_actions WHERE created_at >= v_epoch_start::TIMESTAMPTZ AND created_at <= v_epoch_end::TIMESTAMPTZ;

  v_eco_expansion := 0.4 * LEAST(v_action_count::NUMERIC/10000,1.0) * 1000 + 0.35 * v_active_quality + 0.25 * LEAST(v_action_types::NUMERIC/30,1.0) * 1000;

  -- Discipline modulator from latest metrics
  SELECT (metric_data->>'modulator')::NUMERIC INTO v_discipline FROM epoch_metrics WHERE metric_type = 'discipline' ORDER BY created_at DESC LIMIT 1;
  v_discipline := COALESCE(v_discipline, 1.0);

  -- Final mint
  v_raw_mint := (v_base_expansion + v_contrib_expansion + v_eco_expansion) * v_discipline;
  v_pool := FLOOR(GREATEST(v_min_mint, LEAST(v_raw_mint, v_max_mint)) * v_user_reward_pct);

  IF v_total_light > 0 THEN v_ratio := LEAST(0.03, v_my_score / v_total_light); END IF;
  v_alloc := FLOOR(v_pool * v_ratio);
  v_instant := FLOOR(v_alloc * 0.15);
  v_locked := v_alloc - v_instant;

  -- Eligibility
  IF EXISTS (SELECT 1 FROM user_suspensions WHERE user_id = _user_id AND lifted_at IS NULL) THEN
    v_eligible := false; v_reason := 'SUSPENDED'; v_alloc := 0; v_instant := 0; v_locked := 0;
  ELSIF v_my_score < 10 THEN
    v_eligible := false; v_reason := 'INSUFFICIENT_CONTRIBUTION'; v_alloc := 0; v_instant := 0; v_locked := 0;
  ELSIF NOT EXISTS (SELECT 1 FROM user_light_agreements WHERE user_id = _user_id) THEN
    v_eligible := false; v_reason := 'PPLP_NOT_ACCEPTED'; v_alloc := 0; v_instant := 0; v_locked := 0;
  ELSIF EXISTS (SELECT 1 FROM pplp_fraud_signals WHERE actor_id = _user_id AND is_resolved = false AND severity >= 4) THEN
    v_eligible := false; v_reason := 'FRAUD_FLAG'; v_alloc := 0; v_instant := 0; v_locked := 0;
  END IF;

  -- Epoch layers
  SELECT COALESCE(SUM(daily_light_score),0) INTO v_micro_score FROM features_user_day
  WHERE user_id = _user_id AND date >= (CURRENT_DATE-7)::TEXT AND date <= CURRENT_DATE::TEXT AND daily_light_score > 0;

  SELECT COALESCE(SUM(daily_light_score),0) INTO v_validation_score FROM features_user_day
  WHERE user_id = _user_id AND date >= (CURRENT_DATE-14)::TEXT AND date <= CURRENT_DATE::TEXT AND daily_light_score > 0;

  IF (v_epoch_end - v_epoch_start) > 0 THEN
    v_mint_progress := LEAST(1.0, (CURRENT_DATE - v_epoch_start)::NUMERIC / (v_epoch_end - v_epoch_start)::NUMERIC);
  END IF;

  RETURN QUERY SELECT v_my_score, v_total_light, v_pool, v_alloc, v_ratio,
    v_eligible, v_reason, v_days, v_period,
    v_instant, v_locked, v_vesting_days,
    v_micro_score, v_validation_score, v_mint_progress,
    v_base_expansion, v_contrib_expansion, v_eco_expansion, v_discipline;
END;
$function$;
