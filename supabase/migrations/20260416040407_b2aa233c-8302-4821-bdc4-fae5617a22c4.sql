
-- ============================================================
-- Phase 3+4: 3-Layer Epochs, Anti-Farming, Health Metrics
-- ============================================================

-- 1. Epoch Snapshots: per-user per-epoch-layer snapshots
CREATE TABLE IF NOT EXISTS public.epoch_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  epoch_id TEXT NOT NULL,
  epoch_type TEXT NOT NULL DEFAULT 'micro', -- micro | validation | mint
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  raw_activity_count INT DEFAULT 0,
  deduped_activity_count INT DEFAULT 0,
  preview_score NUMERIC DEFAULT 0,
  validated_score NUMERIC DEFAULT 0,
  finalized_score NUMERIC DEFAULT 0,
  trust_factor NUMERIC DEFAULT 1.0,
  fraud_factor NUMERIC DEFAULT 0,
  burst_penalty NUMERIC DEFAULT 1.0,
  late_window_suppression NUMERIC DEFAULT 1.0,
  cross_window_bonus NUMERIC DEFAULT 1.0,
  timing_adjusted_score NUMERIC DEFAULT 0,
  reward_allocation NUMERIC DEFAULT 0,
  locked_amount NUMERIC DEFAULT 0,
  instant_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, epoch_id, epoch_type)
);

ALTER TABLE public.epoch_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own epoch snapshots"
  ON public.epoch_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages epoch snapshots"
  ON public.epoch_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_epoch_snapshots_user_epoch ON public.epoch_snapshots(user_id, epoch_id);
CREATE INDEX idx_epoch_snapshots_type ON public.epoch_snapshots(epoch_type, window_end);

-- 2. Inflation Health Metrics: daily system health tracking
CREATE TABLE IF NOT EXISTS public.inflation_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL UNIQUE,
  supply_growth_rate NUMERIC DEFAULT 0,
  utility_growth_rate NUMERIC DEFAULT 0,
  active_quality_user_growth NUMERIC DEFAULT 0,
  locked_circulating_ratio NUMERIC DEFAULT 0,
  retention_ratio NUMERIC DEFAULT 0,
  treasury_health_ratio NUMERIC DEFAULT 0,
  value_expansion_ratio NUMERIC DEFAULT 0,
  utility_absorption_ratio NUMERIC DEFAULT 0,
  fraud_pressure_ratio NUMERIC DEFAULT 0,
  claim_efficiency_ratio NUMERIC DEFAULT 0,
  retention_quality_ratio NUMERIC DEFAULT 0,
  locked_stability_ratio NUMERIC DEFAULT 0,
  safe_mode_active BOOLEAN DEFAULT false,
  safe_mode_reason TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.inflation_health_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can view health metrics (via has_role function)
CREATE POLICY "Admins can view health metrics"
  ON public.inflation_health_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages health metrics"
  ON public.inflation_health_metrics FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Anti-farming columns on features_user_day
ALTER TABLE public.features_user_day
  ADD COLUMN IF NOT EXISTS burst_penalty NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS late_window_weight NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS cross_window_bonus NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS timing_adjusted_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actions_last_48h INT DEFAULT 0;

-- 4. RPC: compute_anti_farming_factors
-- Burst Penalty: diminishing returns for >N same-type actions in 24h
-- Late-window suppression: last 48h of epoch window weight reduced
-- Cross-window continuity: reward for stable multi-window activity
CREATE OR REPLACE FUNCTION public.compute_anti_farming_factors(
  _user_id UUID,
  _date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  burst_penalty NUMERIC,
  late_window_weight NUMERIC,
  cross_window_bonus NUMERIC,
  timing_adjusted_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actions_today INT;
  v_same_type_max INT;
  v_burst NUMERIC := 1.0;
  v_late_weight NUMERIC := 1.0;
  v_cross_bonus NUMERIC := 1.0;
  v_active_windows INT;
  v_raw_score NUMERIC;
  v_timing_score NUMERIC;
BEGIN
  -- 1. Burst Penalty: count max same-type actions in last 24h
  SELECT COALESCE(MAX(cnt), 0) INTO v_same_type_max
  FROM (
    SELECT action_type, COUNT(*) as cnt
    FROM pplp_actions
    WHERE actor_id = _user_id
      AND created_at >= (_date - INTERVAL '1 day')::timestamptz
      AND created_at < (_date + INTERVAL '1 day')::timestamptz
    GROUP BY action_type
  ) sub;

  -- Diminishing returns: penalty kicks in after 5 same-type actions
  IF v_same_type_max > 5 THEN
    v_burst := GREATEST(0.3, 1.0 - 0.1 * (v_same_type_max - 5));
  END IF;

  -- 2. Late-window suppression
  -- Check if this date is within last 48h of any active mint window
  -- For simplicity, check if user's activity is concentrated in last 2 days
  SELECT COUNT(*) INTO v_actions_today
  FROM pplp_actions
  WHERE actor_id = _user_id
    AND created_at >= (_date)::timestamptz
    AND created_at < (_date + INTERVAL '1 day')::timestamptz;

  -- Compare with average daily actions in last 14 days
  DECLARE v_avg_daily NUMERIC;
  BEGIN
    SELECT COALESCE(AVG(day_count), 0) INTO v_avg_daily
    FROM (
      SELECT COUNT(*) as day_count
      FROM pplp_actions
      WHERE actor_id = _user_id
        AND created_at >= (_date - INTERVAL '14 days')::timestamptz
        AND created_at < _date::timestamptz
      GROUP BY DATE(created_at)
    ) daily;

    -- If today's activity is >3x average, apply late-window suppression
    IF v_avg_daily > 0 AND v_actions_today > v_avg_daily * 3 THEN
      v_late_weight := GREATEST(0.5, 1.0 - 0.15 * (v_actions_today / v_avg_daily - 2));
    END IF;
  END;

  -- 3. Cross-window continuity bonus
  -- Count how many of last 4 weekly windows user was active in
  SELECT COUNT(DISTINCT date_trunc('week', date)) INTO v_active_windows
  FROM features_user_day
  WHERE user_id = _user_id
    AND date >= (_date - INTERVAL '28 days')
    AND daily_light_score > 0;

  IF v_active_windows >= 4 THEN
    v_cross_bonus := 1.15;
  ELSIF v_active_windows >= 3 THEN
    v_cross_bonus := 1.10;
  ELSIF v_active_windows >= 2 THEN
    v_cross_bonus := 1.05;
  END IF;

  -- 4. Get raw score and compute timing-adjusted
  SELECT COALESCE(f.daily_light_score, 0) INTO v_raw_score
  FROM features_user_day f
  WHERE f.user_id = _user_id AND f.date = _date;

  v_timing_score := ROUND(COALESCE(v_raw_score, 0) * v_burst * v_late_weight * v_cross_bonus, 4);

  -- Update features_user_day
  UPDATE features_user_day
  SET burst_penalty = v_burst,
      late_window_weight = v_late_weight,
      cross_window_bonus = v_cross_bonus,
      timing_adjusted_score = v_timing_score,
      actions_last_48h = v_actions_today
  WHERE user_id = _user_id AND date = _date;

  RETURN QUERY SELECT v_burst, v_late_weight, v_cross_bonus, v_timing_score;
END;
$$;

-- 5. RPC: compute_health_metrics — daily system health computation
CREATE OR REPLACE FUNCTION public.compute_health_metrics(
  _date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supply_growth NUMERIC := 0;
  v_utility_growth NUMERIC := 0;
  v_active_quality_growth NUMERIC := 0;
  v_locked_circ_ratio NUMERIC := 0;
  v_retention NUMERIC := 0;
  v_treasury_health NUMERIC := 0;
  v_value_expansion NUMERIC := 0;
  v_utility_absorption NUMERIC := 0;
  v_fraud_pressure NUMERIC := 0;
  v_claim_efficiency NUMERIC := 0;
  v_retention_quality NUMERIC := 0;
  v_locked_stability NUMERIC := 0;
  v_safe_mode BOOLEAN := false;
  v_safe_reason TEXT := NULL;
  v_result JSONB;
  
  v_total_minted NUMERIC;
  v_total_locked NUMERIC;
  v_total_pending NUMERIC;
  v_prev_minted NUMERIC;
  v_fraud_count INT;
  v_total_users INT;
  v_quality_users INT;
  v_prev_quality_users INT;
  v_claiming_users INT;
  v_treasury_total NUMERIC;
  v_light_growth NUMERIC;
  v_prev_light NUMERIC;
  v_curr_light NUMERIC;
BEGIN
  -- Supply data
  SELECT 
    COALESCE(SUM(CASE WHEN status IN ('minted','confirmed') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status IN ('pending','pending_sig','signed','approved') THEN amount ELSE 0 END), 0)
  INTO v_total_minted, v_total_locked
  FROM pplp_mint_requests;

  -- Previous period minted (30 days ago)
  SELECT COALESCE(SUM(amount), 0) INTO v_prev_minted
  FROM pplp_mint_requests
  WHERE status IN ('minted','confirmed')
    AND created_at < (_date - INTERVAL '30 days')::timestamptz;

  -- Supply growth rate
  IF v_prev_minted > 0 THEN
    v_supply_growth := ROUND((v_total_minted - v_prev_minted) / v_prev_minted, 4);
  END IF;

  -- Locked/Circulating ratio
  IF (v_total_minted + v_total_locked) > 0 THEN
    v_locked_circ_ratio := ROUND(v_total_locked / (v_total_minted + v_total_locked), 4);
    v_locked_stability := v_locked_circ_ratio;
  END IF;

  -- Quality active users (active 3+ days in last 30d with light_score > 0)
  SELECT COUNT(DISTINCT user_id) INTO v_quality_users
  FROM (
    SELECT user_id, COUNT(DISTINCT date) as active_days
    FROM features_user_day
    WHERE date >= (_date - INTERVAL '30 days')
      AND daily_light_score > 0
    GROUP BY user_id
    HAVING COUNT(DISTINCT date) >= 3
  ) sub;

  -- Previous period quality users
  SELECT COUNT(DISTINCT user_id) INTO v_prev_quality_users
  FROM (
    SELECT user_id, COUNT(DISTINCT date) as active_days
    FROM features_user_day
    WHERE date >= (_date - INTERVAL '60 days')
      AND date < (_date - INTERVAL '30 days')
      AND daily_light_score > 0
    GROUP BY user_id
    HAVING COUNT(DISTINCT date) >= 3
  ) sub;

  IF v_prev_quality_users > 0 THEN
    v_active_quality_growth := ROUND((v_quality_users - v_prev_quality_users)::NUMERIC / v_prev_quality_users, 4);
  END IF;

  -- Fraud pressure
  SELECT COUNT(*) INTO v_fraud_count FROM fraud_alerts WHERE is_reviewed = false;
  SELECT COUNT(*) INTO v_total_users FROM profiles;
  IF v_total_users > 0 THEN
    v_fraud_pressure := ROUND(v_fraud_count::NUMERIC / v_total_users, 4);
  END IF;

  -- Claim efficiency = minted / (minted + locked)
  IF (v_total_minted + v_total_locked) > 0 THEN
    v_claim_efficiency := ROUND(v_total_minted / (v_total_minted + v_total_locked), 4);
  END IF;

  -- Retention quality = quality_active / total_claiming
  SELECT COUNT(DISTINCT actor_id) INTO v_claiming_users
  FROM pplp_mint_requests
  WHERE created_at >= (_date - INTERVAL '30 days')::timestamptz;
  IF v_claiming_users > 0 THEN
    v_retention_quality := ROUND(v_quality_users::NUMERIC / v_claiming_users, 4);
  END IF;

  -- Value expansion = verified_value_growth / supply_growth
  SELECT COALESCE(SUM(daily_light_score), 0) INTO v_curr_light
  FROM features_user_day WHERE date >= (_date - INTERVAL '30 days');
  SELECT COALESCE(SUM(daily_light_score), 0) INTO v_prev_light
  FROM features_user_day WHERE date >= (_date - INTERVAL '60 days') AND date < (_date - INTERVAL '30 days');
  
  IF v_prev_light > 0 THEN
    v_light_growth := (v_curr_light - v_prev_light) / v_prev_light;
  ELSE
    v_light_growth := 0;
  END IF;
  IF v_supply_growth > 0 THEN
    v_value_expansion := ROUND(v_light_growth / v_supply_growth, 4);
  END IF;

  -- Treasury health
  SELECT COALESCE(SUM(balance), 0) INTO v_treasury_total FROM treasury_vaults;
  IF v_total_minted > 0 THEN
    v_treasury_health := ROUND(v_treasury_total / v_total_minted, 4);
  END IF;

  -- Utility absorption (approximated)
  v_utility_absorption := LEAST(1.0, v_claim_efficiency * v_retention_quality);

  -- Retention ratio
  v_retention := ROUND(LEAST(1.0, v_quality_users::NUMERIC / GREATEST(v_total_users, 1)), 4);

  -- Safe mode check
  IF v_fraud_pressure > 0.15 THEN
    v_safe_mode := true;
    v_safe_reason := COALESCE(v_safe_reason || '; ', '') || 'High fraud pressure: ' || v_fraud_pressure::text;
  END IF;
  IF v_supply_growth > 0.5 AND v_light_growth < 0.1 THEN
    v_safe_mode := true;
    v_safe_reason := COALESCE(v_safe_reason || '; ', '') || 'Supply outpacing value';
  END IF;

  -- Upsert health metrics
  INSERT INTO inflation_health_metrics (
    metric_date, supply_growth_rate, utility_growth_rate, active_quality_user_growth,
    locked_circulating_ratio, retention_ratio, treasury_health_ratio,
    value_expansion_ratio, utility_absorption_ratio, fraud_pressure_ratio,
    claim_efficiency_ratio, retention_quality_ratio, locked_stability_ratio,
    safe_mode_active, safe_mode_reason,
    raw_data
  ) VALUES (
    _date, v_supply_growth, v_utility_growth, v_active_quality_growth,
    v_locked_circ_ratio, v_retention, v_treasury_health,
    v_value_expansion, v_utility_absorption, v_fraud_pressure,
    v_claim_efficiency, v_retention_quality, v_locked_stability,
    v_safe_mode, v_safe_reason,
    jsonb_build_object(
      'total_minted', v_total_minted, 'total_locked', v_total_locked,
      'quality_users', v_quality_users, 'total_users', v_total_users,
      'fraud_count', v_fraud_count, 'treasury_total', v_treasury_total,
      'curr_light', v_curr_light, 'prev_light', v_prev_light
    )
  )
  ON CONFLICT (metric_date) DO UPDATE SET
    supply_growth_rate = EXCLUDED.supply_growth_rate,
    utility_growth_rate = EXCLUDED.utility_growth_rate,
    active_quality_user_growth = EXCLUDED.active_quality_user_growth,
    locked_circulating_ratio = EXCLUDED.locked_circulating_ratio,
    retention_ratio = EXCLUDED.retention_ratio,
    treasury_health_ratio = EXCLUDED.treasury_health_ratio,
    value_expansion_ratio = EXCLUDED.value_expansion_ratio,
    utility_absorption_ratio = EXCLUDED.utility_absorption_ratio,
    fraud_pressure_ratio = EXCLUDED.fraud_pressure_ratio,
    claim_efficiency_ratio = EXCLUDED.claim_efficiency_ratio,
    retention_quality_ratio = EXCLUDED.retention_quality_ratio,
    locked_stability_ratio = EXCLUDED.locked_stability_ratio,
    safe_mode_active = EXCLUDED.safe_mode_active,
    safe_mode_reason = EXCLUDED.safe_mode_reason,
    raw_data = EXCLUDED.raw_data;

  v_result := jsonb_build_object(
    'supply_growth_rate', v_supply_growth,
    'value_expansion_ratio', v_value_expansion,
    'utility_absorption_ratio', v_utility_absorption,
    'fraud_pressure_ratio', v_fraud_pressure,
    'retention_quality_ratio', v_retention_quality,
    'locked_stability_ratio', v_locked_stability,
    'safe_mode_active', v_safe_mode,
    'safe_mode_reason', v_safe_reason
  );

  RETURN v_result;
END;
$$;
