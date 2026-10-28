
-- 1. Add referred_by to profiles (for NLS referral tracking)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by UUID;

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles (referred_by) WHERE referred_by IS NOT NULL;

-- 2. Fix RLS on user_light_scores — remove overly permissive policy
DROP POLICY IF EXISTS "System can manage light scores" ON public.user_light_scores;

-- Service role (auth.uid() IS NULL) can manage all rows
CREATE POLICY "Service role can manage light scores"
  ON public.user_light_scores FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- 3. Rewrite recompute_user_light_score with PLS decay windows
CREATE OR REPLACE FUNCTION public.recompute_user_light_score(_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pls NUMERIC;
  v_nls NUMERIC;
  v_lls NUMERIC;
  v_alpha NUMERIC := 0.6;
  v_beta NUMERIC := 0.25;
  v_gamma NUMERIC := 0.15;
  v_tls NUMERIC;
  v_display NUMERIC;
  v_tier TEXT;
  v_consistency NUMERIC;
  v_reliability NUMERIC;
  v_streak INT;
  v_pass_rate NUMERIC;
  v_flag_count INT;
BEGIN
  -- Consistency multiplier from streak (0.9-1.3)
  SELECT COALESCE(max(consistency_streak), 0) INTO v_streak
  FROM features_user_day
  WHERE user_id = _user_id AND date >= current_date - 7;

  v_consistency := GREATEST(0.9, LEAST(1.3, 1 + ln(1 + v_streak) / 10));

  -- Reliability from pass rate and flags (0.5-1.2)
  SELECT
    CASE WHEN count(*) > 0
      THEN count(*) FILTER (WHERE final_light_score > 0)::NUMERIC / count(*)
      ELSE 0.8 END,
    count(*) FILTER (WHERE integrity_penalty > 30)
  INTO v_pass_rate, v_flag_count
  FROM pplp_scores
  WHERE actor_id = _user_id
    AND created_at >= now() - interval '90 days';

  v_reliability := GREATEST(0.5, LEAST(1.2, v_pass_rate - (v_flag_count * 0.05)));

  -- PLS with time-weighted decay windows
  SELECT COALESCE(sum(
    COALESCE(vvu_score, final_light_score) *
    CASE
      WHEN created_at >= now() - interval '90 days' THEN 1.0    -- Recent: full weight
      WHEN created_at >= now() - interval '180 days' THEN 0.7   -- Mid: 70%
      WHEN created_at >= now() - interval '365 days' THEN 0.4   -- Old: 40%
      ELSE 0.1                                                    -- Very old: 10%
    END
  ), 0) * v_consistency * v_reliability
  INTO v_pls FROM pplp_scores WHERE actor_id = _user_id;

  v_nls := compute_network_light(_user_id);
  v_lls := compute_legacy_light(_user_id);

  -- Load per-user weights if configured
  SELECT COALESCE(s.alpha, 0.6), COALESCE(s.beta, 0.25), COALESCE(s.gamma, 0.15)
  INTO v_alpha, v_beta, v_gamma
  FROM user_light_scores s WHERE s.user_id = _user_id;

  v_tls := GREATEST(0, v_alpha * v_pls + v_beta * v_nls + v_gamma * v_lls);
  v_display := 100 * ln(1 + v_tls);
  v_tier := compute_light_tier(v_display);

  INSERT INTO user_light_scores (
    user_id, personal_light, network_light, legacy_light,
    total_light_raw, display_light, light_tier,
    consistency_multiplier, reliability_multiplier,
    last_pls_update, last_nls_update, last_lls_update, updated_at
  ) VALUES (
    _user_id, v_pls, v_nls, v_lls,
    v_tls, v_display, v_tier,
    v_consistency, v_reliability,
    now(), now(), now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    personal_light = EXCLUDED.personal_light,
    network_light = EXCLUDED.network_light,
    legacy_light = EXCLUDED.legacy_light,
    total_light_raw = EXCLUDED.total_light_raw,
    display_light = EXCLUDED.display_light,
    light_tier = EXCLUDED.light_tier,
    consistency_multiplier = EXCLUDED.consistency_multiplier,
    reliability_multiplier = EXCLUDED.reliability_multiplier,
    last_pls_update = EXCLUDED.last_pls_update,
    last_nls_update = EXCLUDED.last_nls_update,
    last_lls_update = EXCLUDED.last_lls_update,
    updated_at = now();
END;
$$;

-- 4. Update compute_network_light to safely handle referred_by
CREATE OR REPLACE FUNCTION public.compute_network_light(_user_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral_score NUMERIC := 0;
  v_help_score NUMERIC := 0;
  v_nls NUMERIC;
BEGIN
  -- Referral quality: only count referred users who are actually active
  SELECT COALESCE(sum(
    CASE WHEN ref_actions >= 5 THEN 2.0
         WHEN ref_actions >= 1 THEN 0.5 ELSE 0 END
  ), 0) INTO v_referral_score
  FROM (
    SELECT p.id AS user_id,
           (SELECT count(*) FROM pplp_scores ps WHERE ps.actor_id = p.id) AS ref_actions
    FROM profiles p WHERE p.referred_by = _user_id
  ) sub;

  -- Help quality: verified helps weighted higher
  SELECT COALESCE(sum(CASE WHEN is_verified THEN 1.5 ELSE 0.3 END), 0)
  INTO v_help_score
  FROM community_helps
  WHERE helper_id = _user_id AND created_at >= (now() - interval '30 days');

  v_nls := v_referral_score * 0.6 + v_help_score * 0.4;
  RETURN LEAST(COALESCE(v_nls, 0), 50);
END;
$$;
