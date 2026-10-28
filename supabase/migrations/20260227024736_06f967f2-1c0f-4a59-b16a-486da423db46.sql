
-- ============================================================
-- LS-Math v1.0 — Bước 1+2: Tham số toán học + 5 RPCs
-- ============================================================

-- Bước 1: Update scoring_rules V1.0 formula_json với 17 tham số
UPDATE scoring_rules SET formula_json = jsonb_build_object(
  'base', 'sum(pillars_weighted)',
  'min_light_score', 50,
  'pillar_weights', jsonb_build_object('S', 0.25, 'T', 0.20, 'H', 0.20, 'C', 0.20, 'U', 0.15),
  'w_min', 0.5, 'w_max', 2.0, 'alpha', 0.25,
  'gamma', 1.3,
  'beta', 0.6, 'lambda', 30,
  'eta', 0.5, 'kappa', 5,
  'pi_max', 0.5, 'theta', 0.8,
  'omega_B', 0.4, 'omega_C', 0.6,
  'cap', 0.03,
  'min_ratings', 3,
  'L_min', 10,
  'r_threshold', 0.7,
  'level_thresholds', jsonb_build_object('seed', 0, 'sprout', 10, 'builder', 30, 'guardian', 60, 'architect', 100)
) WHERE rule_version = 'V1.0';

-- Add daily light score columns to features_user_day
ALTER TABLE features_user_day
  ADD COLUMN IF NOT EXISTS base_action_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS content_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_light_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consistency_multiplier NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS sequence_multiplier NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS integrity_penalty NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reputation_weight NUMERIC DEFAULT 1.0;

-- Add eligibility columns to pplp_mint_allocations
ALTER TABLE pplp_mint_allocations
  ADD COLUMN IF NOT EXISTS eligible BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ineligibility_reason TEXT;

-- ============================================================
-- RPC 1: compute_reputation_weight_v2
-- w_u = clip(w_min, w_max, 1 + α·log(1+R_u))
-- R_u = contribution_days × pass_rate × (1 + streak_bonus)
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_reputation_weight_v2(
  _user_id UUID,
  _w_min NUMERIC DEFAULT 0.5,
  _w_max NUMERIC DEFAULT 2.0,
  _alpha NUMERIC DEFAULT 0.25
)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_contribution_days INT;
  v_pass_rate NUMERIC;
  v_max_streak INT;
  v_R NUMERIC;
  v_w NUMERIC;
BEGIN
  -- Count distinct contribution days
  SELECT COUNT(DISTINCT date) INTO v_contribution_days
  FROM features_user_day
  WHERE user_id = _user_id
    AND (count_posts + count_comments + count_help + count_questions + count_journals) > 0;

  -- Pass rate from pplp_scores
  SELECT CASE WHEN COUNT(*) > 0
    THEN COUNT(CASE WHEN decision = 'pass' THEN 1 END)::NUMERIC / COUNT(*)
    ELSE 0.5 END
  INTO v_pass_rate
  FROM pplp_scores s
  JOIN pplp_actions a ON s.action_id = a.id
  WHERE a.actor_id = _user_id;

  -- Max streak
  SELECT COALESCE(MAX(consistency_streak), 0) INTO v_max_streak
  FROM features_user_day WHERE user_id = _user_id;

  -- R_u composite
  v_R := COALESCE(v_contribution_days, 0) * COALESCE(v_pass_rate, 0.5) * (1 + LEAST(v_max_streak, 60) / 60.0);

  -- w_u = clip(w_min, w_max, 1 + α·log(1+R_u))
  v_w := 1 + _alpha * ln(1 + v_R);
  v_w := GREATEST(_w_min, LEAST(_w_max, v_w));

  RETURN ROUND(v_w, 4);
END;
$$;

-- ============================================================
-- RPC 2: compute_content_pillar_score
-- P_c,k = Σ(w_r · s_r,c,k) / (Σw_r + ε) with cold-start fallback
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_content_pillar_score(
  _content_id UUID,
  _min_ratings INT DEFAULT 3,
  _gamma NUMERIC DEFAULT 1.3
)
RETURNS TABLE(
  pillar_scores NUMERIC[5],
  total_score NUMERIC,
  rating_count INT,
  is_fallback BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_scores NUMERIC[5] := ARRAY[0,0,0,0,0];
  v_total NUMERIC := 0;
  v_count INT := 0;
  v_epsilon NUMERIC := 0.000001;
  v_sum_w NUMERIC := 0;
  v_weighted_s NUMERIC[5] := ARRAY[0,0,0,0,0];
  r RECORD;
  v_fallback BOOLEAN := false;
  v_actor_id UUID;
  v_topic_avg NUMERIC;
  v_user_trust NUMERIC;
BEGIN
  -- Count valid ratings
  SELECT COUNT(*) INTO v_count FROM pplp_ratings WHERE content_id = _content_id;

  IF v_count >= _min_ratings THEN
    -- Weighted average using rater reputation
    FOR r IN
      SELECT pr.pillar_truth, pr.pillar_sustain, pr.pillar_heal_love,
             pr.pillar_life_service, pr.pillar_unity_source,
             COALESCE(pr.weight_applied, 1.0) AS w
      FROM pplp_ratings pr
      WHERE pr.content_id = _content_id
    LOOP
      v_sum_w := v_sum_w + r.w;
      v_weighted_s[1] := v_weighted_s[1] + r.w * r.pillar_truth;
      v_weighted_s[2] := v_weighted_s[2] + r.w * r.pillar_sustain;
      v_weighted_s[3] := v_weighted_s[3] + r.w * r.pillar_heal_love;
      v_weighted_s[4] := v_weighted_s[4] + r.w * r.pillar_life_service;
      v_weighted_s[5] := v_weighted_s[5] + r.w * r.pillar_unity_source;
    END LOOP;

    FOR i IN 1..5 LOOP
      v_scores[i] := ROUND(v_weighted_s[i] / (v_sum_w + v_epsilon), 4);
    END LOOP;
    v_total := v_scores[1] + v_scores[2] + v_scores[3] + v_scores[4] + v_scores[5];
  ELSE
    -- Cold-start fallback: P̃_c = μ_topic · φ_u
    v_fallback := true;

    -- Get content author
    SELECT actor_id INTO v_actor_id
    FROM pplp_actions WHERE id = _content_id LIMIT 1;

    -- μ_topic = global average content score (recent 30 days)
    SELECT COALESCE(AVG(s.light_score), 5.0) INTO v_topic_avg
    FROM pplp_scores s
    JOIN pplp_actions a ON s.action_id = a.id
    WHERE a.created_at > now() - interval '30 days' AND s.decision = 'pass';

    -- φ_u = user trust factor based on pass rate (0.8-1.1)
    SELECT CASE WHEN COUNT(*) > 0
      THEN 0.8 + 0.3 * (COUNT(CASE WHEN decision = 'pass' THEN 1 END)::NUMERIC / COUNT(*))
      ELSE 0.9 END
    INTO v_user_trust
    FROM pplp_scores s
    JOIN pplp_actions a ON s.action_id = a.id
    WHERE a.actor_id = v_actor_id;

    v_total := ROUND(LEAST(10, v_topic_avg * v_user_trust / 10.0 * 10), 4);
    -- Distribute evenly across pillars for fallback
    FOR i IN 1..5 LOOP
      v_scores[i] := ROUND(v_total / 5.0, 4);
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_scores, v_total, v_count, v_fallback;
END;
$$;

-- ============================================================
-- RPC 3: compute_daily_light_score
-- L_u(t) = (ω_B·B + ω_C·C) × M^cons × M^seq × Π
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_daily_light_score(
  _user_id UUID,
  _date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_params JSONB;
  v_omega_B NUMERIC; v_omega_C NUMERIC;
  v_beta NUMERIC; v_lambda NUMERIC;
  v_eta NUMERIC; v_kappa NUMERIC;
  v_pi_max NUMERIC; v_theta NUMERIC;
  v_gamma NUMERIC;
  v_B NUMERIC := 0; -- Action base score
  v_C NUMERIC := 0; -- Content score
  v_S INT;           -- Streak
  v_Q NUMERIC := 0;  -- Sequence bonus sum
  v_r NUMERIC := 0;  -- Fraud risk
  v_M_cons NUMERIC;
  v_M_seq NUMERIC;
  v_Pi NUMERIC;
  v_L_raw NUMERIC;
  v_L NUMERIC;
  v_rep_w NUMERIC;
  r RECORD;
  v_content_total NUMERIC;
BEGIN
  -- Load params from active scoring_rules
  SELECT formula_json INTO v_params
  FROM scoring_rules WHERE status = 'active' LIMIT 1;

  v_omega_B := COALESCE((v_params->>'omega_B')::NUMERIC, 0.4);
  v_omega_C := COALESCE((v_params->>'omega_C')::NUMERIC, 0.6);
  v_beta    := COALESCE((v_params->>'beta')::NUMERIC, 0.6);
  v_lambda  := COALESCE((v_params->>'lambda')::NUMERIC, 30);
  v_eta     := COALESCE((v_params->>'eta')::NUMERIC, 0.5);
  v_kappa   := COALESCE((v_params->>'kappa')::NUMERIC, 5);
  v_pi_max  := COALESCE((v_params->>'pi_max')::NUMERIC, 0.5);
  v_theta   := COALESCE((v_params->>'theta')::NUMERIC, 0.8);
  v_gamma   := COALESCE((v_params->>'gamma')::NUMERIC, 1.3);

  -- B_u(t): Σ b_τ · g(x_i) from pplp_actions scored on this day
  SELECT COALESCE(SUM(
    COALESCE(ac.base_reward, 100) *
    LEAST(1.5, GREATEST(0, COALESCE(s.quality_score, 0.5)))
  ), 0) INTO v_B
  FROM pplp_actions a
  JOIN pplp_scores s ON s.action_id = a.id
  LEFT JOIN pplp_action_caps ac ON ac.action_type = a.action_type AND ac.is_active = true
  WHERE a.actor_id = _user_id AND a.created_at::DATE = _date AND s.decision = 'pass';

  -- Normalize B to reasonable scale (divide by 1000)
  v_B := v_B / 1000.0;

  -- C_u(t): Σ ρ(type) · h(P_c) for content created on this day
  FOR r IN
    SELECT a.id AS action_id, a.action_type,
           COALESCE(s.light_score, 0) AS ls
    FROM pplp_actions a
    JOIN pplp_scores s ON s.action_id = a.id
    WHERE a.actor_id = _user_id AND a.created_at::DATE = _date
      AND s.decision = 'pass'
      AND a.action_type IN ('POST_CREATE', 'ANALYSIS_POST', 'SHARE_CONTENT', 'COMMENT_CREATE')
  LOOP
    -- Use compute_content_pillar_score for each content
    SELECT cps.total_score INTO v_content_total
    FROM compute_content_pillar_score(r.action_id) cps;

    -- ρ(type) content type coefficient
    v_C := v_C + (CASE r.action_type
      WHEN 'ANALYSIS_POST' THEN 1.5
      WHEN 'POST_CREATE' THEN 1.0
      WHEN 'SHARE_CONTENT' THEN 0.5
      WHEN 'COMMENT_CREATE' THEN 0.3
      ELSE 0.5
    END) * POWER(COALESCE(v_content_total, 5) / 10.0, v_gamma);
  END LOOP;

  -- Get consistency streak S
  SELECT COALESCE(consistency_streak, 0) INTO v_S
  FROM features_user_day WHERE user_id = _user_id AND date = _date;

  -- M^cons = 1 + β·(1 - e^(-S/λ))
  v_M_cons := 1 + v_beta * (1 - exp(-v_S::NUMERIC / v_lambda));

  -- Q_u(t): Σ δ_q from completed sequences today
  SELECT COALESCE(SUM(sequence_multiplier), 0) INTO v_Q
  FROM pplp_behavior_sequences
  WHERE user_id = _user_id AND status = 'completed'
    AND completed_at::DATE = _date;

  -- M^seq = 1 + η·tanh(Q/κ)
  v_M_seq := 1 + v_eta * (exp(v_Q / v_kappa) - exp(-v_Q / v_kappa)) / (exp(v_Q / v_kappa) + exp(-v_Q / v_kappa) + 0.000001);

  -- r_u: average unresolved fraud signal severity (0-1 scale)
  SELECT COALESCE(AVG(severity::NUMERIC / 5.0), 0) INTO v_r
  FROM pplp_fraud_signals
  WHERE actor_id = _user_id AND is_resolved = false;

  -- Π = 1 - min(π_max, θ·r_u)
  v_Pi := 1 - LEAST(v_pi_max, v_theta * v_r);

  -- L_raw = ω_B·B + ω_C·C
  v_L_raw := v_omega_B * v_B + v_omega_C * v_C;

  -- L_u(t) = L_raw × M^cons × M^seq × Π
  v_L := v_L_raw * v_M_cons * v_M_seq * v_Pi;
  v_L := ROUND(GREATEST(0, v_L), 4);

  -- Get reputation weight for storage
  v_rep_w := compute_reputation_weight_v2(_user_id);

  -- Save to features_user_day
  UPDATE features_user_day SET
    base_action_score = ROUND(v_B, 4),
    content_score = ROUND(v_C, 4),
    daily_light_score = v_L,
    consistency_multiplier = ROUND(v_M_cons, 4),
    sequence_multiplier = ROUND(v_M_seq, 4),
    integrity_penalty = ROUND(1 - v_Pi, 4),
    reputation_weight = v_rep_w,
    updated_at = now()
  WHERE user_id = _user_id AND date = _date;

  -- If no row existed, insert
  IF NOT FOUND THEN
    INSERT INTO features_user_day (user_id, date, base_action_score, content_score, daily_light_score,
      consistency_multiplier, sequence_multiplier, integrity_penalty, reputation_weight)
    VALUES (_user_id, _date, ROUND(v_B, 4), ROUND(v_C, 4), v_L,
      ROUND(v_M_cons, 4), ROUND(v_M_seq, 4), ROUND(1 - v_Pi, 4), v_rep_w);
  END IF;

  RETURN v_L;
END;
$$;

-- ============================================================
-- RPC 4: compute_epoch_light_score
-- L_u(e) = Σ L_u(t) for t in epoch
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_epoch_light_score(
  _user_id UUID,
  _epoch_start DATE,
  _epoch_end DATE
)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(daily_light_score), 0) INTO v_total
  FROM features_user_day
  WHERE user_id = _user_id AND date >= _epoch_start AND date <= _epoch_end;

  RETURN ROUND(v_total, 4);
END;
$$;

-- ============================================================
-- RPC 5: check_mint_eligibility
-- 4 conditions: PPLP accepted, integrity gate, L_min, no cluster review
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_mint_eligibility(
  _user_id UUID,
  _epoch_start DATE,
  _epoch_end DATE
)
RETURNS TABLE(
  eligible BOOLEAN,
  reason TEXT,
  epoch_score NUMERIC,
  avg_risk NUMERIC,
  pplp_accepted BOOLEAN,
  has_cluster_review BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_params JSONB;
  v_L_min NUMERIC;
  v_r_threshold NUMERIC;
  v_epoch_score NUMERIC;
  v_avg_risk NUMERIC;
  v_pplp_accepted BOOLEAN;
  v_has_cluster BOOLEAN;
  v_eligible BOOLEAN := true;
  v_reason TEXT := 'ELIGIBLE';
BEGIN
  -- Load params
  SELECT formula_json INTO v_params
  FROM scoring_rules WHERE status = 'active' LIMIT 1;

  v_L_min := COALESCE((v_params->>'L_min')::NUMERIC, 10);
  v_r_threshold := COALESCE((v_params->>'r_threshold')::NUMERIC, 0.7);

  -- 1. PPLP accepted
  SELECT EXISTS(SELECT 1 FROM user_light_agreements WHERE user_id = _user_id) INTO v_pplp_accepted;

  -- 2. Epoch score
  v_epoch_score := compute_epoch_light_score(_user_id, _epoch_start, _epoch_end);

  -- 3. Average fraud risk
  SELECT COALESCE(AVG(severity::NUMERIC / 5.0), 0) INTO v_avg_risk
  FROM pplp_fraud_signals
  WHERE actor_id = _user_id AND is_resolved = false
    AND created_at >= _epoch_start::TIMESTAMPTZ AND created_at <= (_epoch_end + 1)::TIMESTAMPTZ;

  -- 4. Cluster review
  SELECT EXISTS(
    SELECT 1 FROM pplp_fraud_signals
    WHERE actor_id = _user_id AND signal_type = 'cluster_review' AND is_resolved = false
  ) INTO v_has_cluster;

  -- Check conditions
  IF NOT v_pplp_accepted THEN
    v_eligible := false; v_reason := 'PPLP_NOT_ACCEPTED';
  ELSIF v_avg_risk > v_r_threshold THEN
    v_eligible := false; v_reason := 'INTEGRITY_GATE_FAILED';
  ELSIF v_epoch_score < v_L_min THEN
    v_eligible := false; v_reason := 'INSUFFICIENT_CONTRIBUTION';
  ELSIF v_has_cluster THEN
    v_eligible := false; v_reason := 'CLUSTER_REVIEW_PENDING';
  END IF;

  RETURN QUERY SELECT v_eligible, v_reason, v_epoch_score, v_avg_risk, v_pplp_accepted, v_has_cluster;
END;
$$;

-- ============================================================
-- Update compute_light_score_ledger to use new math (Bước 5)
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_light_score_ledger(
  _user_id UUID, _period TEXT, _start TIMESTAMPTZ, _end TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_params JSONB;
  v_epoch_score NUMERIC;
  v_rep_weight NUMERIC;
  v_avg_cons NUMERIC;
  v_avg_seq NUMERIC;
  v_penalty NUMERIC;
  v_level TEXT;
  v_explain_id UUID;
  v_ledger_id UUID;
  v_top_contributors JSONB;
  v_penalties JSONB;
  v_thresholds JSONB;
  v_reason_codes TEXT[] := '{}';
  v_trend TEXT := 'stable';
  v_prev_score NUMERIC;
  v_rule_version TEXT;
BEGIN
  -- Load active rule
  SELECT formula_json, rule_version INTO v_params, v_rule_version
  FROM scoring_rules WHERE status = 'active' LIMIT 1;

  v_thresholds := COALESCE(v_params->'level_thresholds',
    '{"seed":0,"sprout":10,"builder":30,"guardian":60,"architect":100}'::JSONB);

  -- Epoch score = Σ L_u(t)
  v_epoch_score := compute_epoch_light_score(_user_id, _start::DATE, _end::DATE);

  -- Average multipliers for display
  SELECT COALESCE(AVG(consistency_multiplier), 1.0),
         COALESCE(AVG(sequence_multiplier), 1.0),
         COALESCE(AVG(integrity_penalty), 0)
  INTO v_avg_cons, v_avg_seq, v_penalty
  FROM features_user_day
  WHERE user_id = _user_id AND date >= _start::DATE AND date <= _end::DATE;

  v_rep_weight := compute_reputation_weight_v2(_user_id);

  -- Level from thresholds
  v_level := CASE
    WHEN v_epoch_score >= COALESCE((v_thresholds->>'architect')::NUMERIC, 100) THEN 'architect'
    WHEN v_epoch_score >= COALESCE((v_thresholds->>'guardian')::NUMERIC, 60) THEN 'guardian'
    WHEN v_epoch_score >= COALESCE((v_thresholds->>'builder')::NUMERIC, 30) THEN 'builder'
    WHEN v_epoch_score >= COALESCE((v_thresholds->>'sprout')::NUMERIC, 10) THEN 'sprout'
    ELSE 'seed'
  END;

  -- Reason codes
  IF v_avg_cons > 1.3 THEN v_reason_codes := array_append(v_reason_codes, 'CONSISTENCY_STRONG'); END IF;
  IF v_avg_seq > 1.2 THEN v_reason_codes := array_append(v_reason_codes, 'VALUE_LOOP_ACTIVE'); END IF;
  IF v_penalty > 0.1 THEN v_reason_codes := array_append(v_reason_codes, 'TEMPORARY_WEIGHT_ADJUSTMENT'); END IF;
  IF v_rep_weight > 1.5 THEN v_reason_codes := array_append(v_reason_codes, 'HIGH_REPUTATION'); END IF;

  -- Trend: compare with previous period
  SELECT final_light_score INTO v_prev_score
  FROM light_score_ledger
  WHERE user_id = _user_id AND period_end < _start
  ORDER BY period_end DESC LIMIT 1;

  IF v_prev_score IS NOT NULL THEN
    IF v_epoch_score > v_prev_score * 1.1 THEN v_trend := 'growing';
    ELSIF v_epoch_score < v_prev_score * 0.9 THEN v_trend := 'reflecting';
    ELSE v_trend := 'stable';
    END IF;
  END IF;

  -- Top contributors
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB) INTO v_top_contributors
  FROM (
    SELECT a.action_type, s.light_score, s.final_reward
    FROM pplp_scores s
    JOIN pplp_actions a ON s.action_id = a.id
    WHERE a.actor_id = _user_id AND a.created_at BETWEEN _start AND _end
      AND s.decision = 'pass'
    ORDER BY s.light_score DESC LIMIT 5
  ) t;

  -- Penalties
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB) INTO v_penalties
  FROM (
    SELECT signal_type, severity
    FROM pplp_fraud_signals
    WHERE actor_id = _user_id AND is_resolved = false
    ORDER BY severity DESC LIMIT 5
  ) t;

  -- Insert explanation
  INSERT INTO score_explanations (user_id, top_contributors_json, penalties_json, version)
  VALUES (_user_id, v_top_contributors, v_penalties, 'LS-Math-v1.0')
  RETURNING id INTO v_explain_id;

  -- Upsert ledger
  INSERT INTO light_score_ledger (
    user_id, period, period_start, period_end,
    base_score, reputation_weight, consistency_multiplier, sequence_multiplier,
    integrity_penalty, final_light_score, level, explain_ref,
    rule_version, reason_codes, trend
  ) VALUES (
    _user_id, _period, _start, _end,
    v_epoch_score, v_rep_weight, v_avg_cons, v_avg_seq,
    v_penalty * 100, v_epoch_score, v_level, v_explain_id,
    v_rule_version, v_reason_codes, v_trend
  )
  ON CONFLICT (user_id, period, period_start) DO UPDATE SET
    base_score = EXCLUDED.base_score,
    reputation_weight = EXCLUDED.reputation_weight,
    consistency_multiplier = EXCLUDED.consistency_multiplier,
    sequence_multiplier = EXCLUDED.sequence_multiplier,
    integrity_penalty = EXCLUDED.integrity_penalty,
    final_light_score = EXCLUDED.final_light_score,
    level = EXCLUDED.level,
    explain_ref = EXCLUDED.explain_ref,
    rule_version = EXCLUDED.rule_version,
    reason_codes = EXCLUDED.reason_codes,
    trend = EXCLUDED.trend,
    computed_at = now()
  RETURNING id INTO v_ledger_id;

  -- Update profile
  UPDATE profiles SET
    reputation_level = v_level,
    reputation_score = v_epoch_score
  WHERE user_id = _user_id;

  RETURN v_ledger_id;
END;
$$;
