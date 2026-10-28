
-- Preview epoch allocation for a user in the current open cycle
CREATE OR REPLACE FUNCTION public.preview_epoch_allocation(_user_id UUID)
RETURNS TABLE(
  my_light_score NUMERIC,
  total_light NUMERIC,
  mint_pool NUMERIC,
  estimated_allocation NUMERIC,
  my_ratio NUMERIC,
  is_eligible BOOLEAN,
  ineligibility_reason TEXT,
  days_remaining INTEGER,
  epoch_period TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  -- Get current open cycle
  SELECT * INTO v_cycle
  FROM pplp_mint_cycles
  WHERE status = 'open'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cycle IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, false, 'NO_ACTIVE_CYCLE'::TEXT, 0, ''::TEXT;
    RETURN;
  END IF;

  v_epoch_start := v_cycle.start_date::DATE;
  v_epoch_end := v_cycle.end_date::DATE;
  v_days := GREATEST(0, (v_epoch_end - CURRENT_DATE));
  v_period := to_char(v_cycle.start_date, 'YYYY-MM');

  -- Get my light score this epoch from features_user_day
  SELECT COALESCE(SUM(daily_light_score), 0) INTO v_my_score
  FROM features_user_day
  WHERE user_id = _user_id
    AND date >= v_epoch_start::TEXT
    AND date <= v_epoch_end::TEXT
    AND daily_light_score > 0;

  -- Get total light score for all users this epoch
  SELECT COALESCE(SUM(daily_light_score), 0) INTO v_total_light
  FROM features_user_day
  WHERE date >= v_epoch_start::TEXT
    AND date <= v_epoch_end::TEXT
    AND daily_light_score > 0;

  -- Calculate pool (capped at 5M)
  v_pool := LEAST(5000000, v_total_light);

  -- Calculate ratio with anti-whale cap (3%)
  IF v_total_light > 0 THEN
    v_ratio := LEAST(0.03, v_my_score / v_total_light);
  END IF;

  v_alloc := FLOOR(v_pool * v_ratio);

  -- Check eligibility
  IF EXISTS (SELECT 1 FROM user_suspensions WHERE user_id = _user_id AND lifted_at IS NULL) THEN
    v_eligible := false;
    v_reason := 'SUSPENDED';
    v_alloc := 0;
  ELSIF v_my_score < 10 THEN
    v_eligible := false;
    v_reason := 'INSUFFICIENT_CONTRIBUTION';
    v_alloc := 0;
  ELSIF NOT EXISTS (SELECT 1 FROM user_light_agreements WHERE user_id = _user_id) THEN
    v_eligible := false;
    v_reason := 'PPLP_NOT_ACCEPTED';
    v_alloc := 0;
  ELSIF EXISTS (SELECT 1 FROM pplp_fraud_signals WHERE actor_id = _user_id AND is_resolved = false AND severity >= 4) THEN
    v_eligible := false;
    v_reason := 'FRAUD_FLAG';
    v_alloc := 0;
  END IF;

  RETURN QUERY SELECT v_my_score, v_total_light, v_pool, v_alloc, v_ratio, v_eligible, v_reason, v_days, v_period;
END;
$$;
