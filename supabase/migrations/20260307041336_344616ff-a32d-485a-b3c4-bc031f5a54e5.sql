
-- 1. Create user_dimension_scores table
CREATE TABLE public.user_dimension_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  identity_score NUMERIC NOT NULL DEFAULT 0,
  activity_score NUMERIC NOT NULL DEFAULT 0,
  onchain_score NUMERIC NOT NULL DEFAULT 0,
  transparency_score NUMERIC NOT NULL DEFAULT 0,
  ecosystem_score NUMERIC NOT NULL DEFAULT 0,
  risk_penalty NUMERIC NOT NULL DEFAULT 0,
  streak_bonus_pct NUMERIC NOT NULL DEFAULT 0,
  total_light_score NUMERIC NOT NULL DEFAULT 0,
  level_name TEXT NOT NULL DEFAULT 'Light Seed',
  inactive_days INTEGER NOT NULL DEFAULT 0,
  decay_applied BOOLEAN NOT NULL DEFAULT false,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_dimension_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dimension scores"
  ON public.user_dimension_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage dimension scores"
  ON public.user_dimension_scores FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Compute function
CREATE OR REPLACE FUNCTION public.compute_user_dimensions(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_identity NUMERIC := 0;
  v_activity NUMERIC := 0;
  v_onchain NUMERIC := 0;
  v_transparency NUMERIC := 0;
  v_ecosystem NUMERIC := 0;
  v_risk_penalty NUMERIC := 0;
  v_streak_bonus NUMERIC := 0;
  v_inactive_days INTEGER := 0;
  v_decay_factor NUMERIC := 1.0;
  v_total NUMERIC := 0;
  v_level TEXT := 'Light Seed';
  v_profile RECORD;
  v_last_active DATE;
  v_streak INTEGER;
  v_raw_activity NUMERIC;
BEGIN
  -- ========== IDENTITY SCORE (max 100) ==========
  SELECT * INTO v_profile FROM profiles WHERE user_id = _user_id;
  
  IF v_profile IS NOT NULL THEN
    -- display_name (5pt)
    IF v_profile.display_name IS NOT NULL AND length(v_profile.display_name) > 0 THEN
      v_identity := v_identity + 5;
    END IF;
    -- avatar (10pt)
    IF v_profile.avatar_url IS NOT NULL AND length(v_profile.avatar_url) > 0 THEN
      v_identity := v_identity + 10;
    END IF;
    -- bio (5pt)
    IF v_profile.bio IS NOT NULL AND length(v_profile.bio) > 10 THEN
      v_identity := v_identity + 5;
    END IF;
    -- handle (10pt)
    IF v_profile.handle IS NOT NULL AND length(v_profile.handle) > 0 THEN
      v_identity := v_identity + 10;
    END IF;
  END IF;

  -- email verified (20pt) — user exists in auth means email confirmed
  IF EXISTS (SELECT 1 FROM user_light_agreements WHERE user_id = _user_id) THEN
    v_identity := v_identity + 20;
  END IF;

  -- wallet linked (30pt)
  IF EXISTS (SELECT 1 FROM user_wallet_addresses WHERE user_id = _user_id) THEN
    v_identity := v_identity + 30;
  END IF;

  -- account age >30d (10pt)
  IF public.get_account_age_days(_user_id) > 30 THEN
    v_identity := v_identity + 10;
  END IF;

  -- DID exists (10pt)
  IF EXISTS (SELECT 1 FROM user_dids WHERE user_id = _user_id AND is_active = true) THEN
    v_identity := v_identity + 10;
  END IF;

  v_identity := LEAST(100, v_identity);

  -- ========== ACTIVITY SCORE (max 100) ==========
  -- Normalize from light_score_ledger last 30 days
  SELECT COALESCE(SUM(final_light_score), 0) INTO v_raw_activity
  FROM light_score_ledger
  WHERE user_id = _user_id
    AND scored_at >= now() - interval '30 days';

  -- Map: 0→0, 50→50, 100+→100 (linear cap at 100)
  v_activity := LEAST(100, v_raw_activity);

  -- Get last active date & streak
  SELECT MAX(date) INTO v_last_active
  FROM features_user_day
  WHERE user_id = _user_id;

  IF v_last_active IS NOT NULL THEN
    v_inactive_days := (CURRENT_DATE - v_last_active);
  ELSE
    v_inactive_days := 999;
  END IF;

  -- Decay
  IF v_inactive_days >= 180 THEN
    v_decay_factor := 0;
  ELSIF v_inactive_days >= 90 THEN
    v_decay_factor := 0.3;
  ELSIF v_inactive_days >= 60 THEN
    v_decay_factor := 0.6;
  ELSIF v_inactive_days >= 30 THEN
    v_decay_factor := 0.85;
  ELSE
    v_decay_factor := 1.0;
  END IF;

  v_activity := v_activity * v_decay_factor;

  -- Streak bonus
  SELECT COALESCE(MAX(consistency_streak), 0) INTO v_streak
  FROM features_user_day
  WHERE user_id = _user_id
    AND date >= CURRENT_DATE - 7;

  IF v_streak >= 90 THEN
    v_streak_bonus := 0.10;
  ELSIF v_streak >= 30 THEN
    v_streak_bonus := 0.05;
  ELSIF v_streak >= 7 THEN
    v_streak_bonus := 0.02;
  ELSE
    v_streak_bonus := 0;
  END IF;

  -- ========== ONCHAIN SCORE (max 100) ==========
  -- wallet linked (20pt)
  IF EXISTS (SELECT 1 FROM user_wallet_addresses WHERE user_id = _user_id) THEN
    v_onchain := v_onchain + 20;
    -- wallet age: account age as proxy (30pt if >365d)
    IF public.get_account_age_days(_user_id) > 365 THEN
      v_onchain := v_onchain + 30;
    ELSIF public.get_account_age_days(_user_id) > 180 THEN
      v_onchain := v_onchain + 20;
    ELSIF public.get_account_age_days(_user_id) > 90 THEN
      v_onchain := v_onchain + 10;
    END IF;
    -- has withdrawals (on-chain tx proxy) (20pt)
    IF EXISTS (SELECT 1 FROM coin_withdrawals WHERE user_id = _user_id AND status = 'completed') THEN
      v_onchain := v_onchain + 20;
    END IF;
    -- has web3 gifts (contract interactions proxy) (30pt)
    IF EXISTS (SELECT 1 FROM coin_gifts WHERE (sender_id = _user_id OR receiver_id = _user_id) AND gift_type = 'web3') THEN
      v_onchain := v_onchain + 30;
    END IF;
  END IF;

  v_onchain := LEAST(100, v_onchain);

  -- ========== TRANSPARENCY SCORE (max 100) ==========
  v_transparency := 100;

  SELECT COALESCE(COUNT(*), 0) INTO v_risk_penalty
  FROM pplp_fraud_signals
  WHERE user_id = _user_id AND status IN ('active', 'pending');

  v_transparency := GREATEST(30, v_transparency - (v_risk_penalty * 15));

  -- Risk penalty from severity
  SELECT COALESCE(SUM(
    CASE 
      WHEN severity >= 4 THEN 35
      WHEN severity >= 3 THEN 20
      WHEN severity >= 2 THEN 10
      ELSE 5
    END
  ), 0) INTO v_risk_penalty
  FROM pplp_fraud_signals
  WHERE user_id = _user_id AND status IN ('active', 'pending');

  v_risk_penalty := LEAST(80, v_risk_penalty);

  -- ========== ECOSYSTEM SCORE (max 100) ==========
  -- Camly balance >0 (20pt)
  IF EXISTS (SELECT 1 FROM camly_coin_balances WHERE user_id = _user_id AND balance > 0) THEN
    v_ecosystem := v_ecosystem + 20;
  END IF;

  -- Platform usage >7d (20pt)
  IF (SELECT COUNT(DISTINCT date) FROM features_user_day WHERE user_id = _user_id) > 7 THEN
    v_ecosystem := v_ecosystem + 20;
  END IF;

  -- Posts/comments (20pt)
  IF EXISTS (SELECT 1 FROM community_posts WHERE user_id = _user_id) OR
     EXISTS (SELECT 1 FROM community_comments WHERE user_id = _user_id) THEN
    v_ecosystem := v_ecosystem + 20;
  END IF;

  -- Donations/gifts (20pt)
  IF EXISTS (SELECT 1 FROM coin_gifts WHERE sender_id = _user_id) THEN
    v_ecosystem := v_ecosystem + 20;
  END IF;

  -- Holding >30d (20pt)
  IF EXISTS (
    SELECT 1 FROM camly_coin_balances 
    WHERE user_id = _user_id AND balance > 0 
      AND created_at < now() - interval '30 days'
  ) THEN
    v_ecosystem := v_ecosystem + 20;
  END IF;

  v_ecosystem := LEAST(100, v_ecosystem);

  -- ========== TOTAL SCORE ==========
  v_total := (v_identity + v_activity + v_onchain + v_transparency + v_ecosystem) 
             * (1 + v_streak_bonus) 
             - v_risk_penalty;
  v_total := GREATEST(0, v_total);

  -- Level mapping
  IF v_total >= 800 THEN v_level := 'Cosmic Contributor';
  ELSIF v_total >= 500 THEN v_level := 'Light Leader';
  ELSIF v_total >= 250 THEN v_level := 'Light Guardian';
  ELSIF v_total >= 100 THEN v_level := 'Light Builder';
  ELSE v_level := 'Light Seed';
  END IF;

  -- Upsert
  INSERT INTO user_dimension_scores (
    user_id, identity_score, activity_score, onchain_score, 
    transparency_score, ecosystem_score, risk_penalty, streak_bonus_pct,
    total_light_score, level_name, inactive_days, decay_applied, computed_at, updated_at
  ) VALUES (
    _user_id, v_identity, v_activity, v_onchain,
    v_transparency, v_ecosystem, v_risk_penalty, v_streak_bonus,
    v_total, v_level, v_inactive_days, v_decay_factor < 1.0, now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    identity_score = EXCLUDED.identity_score,
    activity_score = EXCLUDED.activity_score,
    onchain_score = EXCLUDED.onchain_score,
    transparency_score = EXCLUDED.transparency_score,
    ecosystem_score = EXCLUDED.ecosystem_score,
    risk_penalty = EXCLUDED.risk_penalty,
    streak_bonus_pct = EXCLUDED.streak_bonus_pct,
    total_light_score = EXCLUDED.total_light_score,
    level_name = EXCLUDED.level_name,
    inactive_days = EXCLUDED.inactive_days,
    decay_applied = EXCLUDED.decay_applied,
    computed_at = EXCLUDED.computed_at,
    updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object(
    'identity', v_identity,
    'activity', v_activity,
    'onchain', v_onchain,
    'transparency', v_transparency,
    'ecosystem', v_ecosystem,
    'risk_penalty', v_risk_penalty,
    'streak_bonus', v_streak_bonus,
    'decay_factor', v_decay_factor,
    'total', v_total,
    'level', v_level,
    'inactive_days', v_inactive_days
  );
END;
$$;
