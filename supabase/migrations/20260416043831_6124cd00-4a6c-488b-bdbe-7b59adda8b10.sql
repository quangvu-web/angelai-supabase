
-- ============================================
-- PPLP v2.5: VVU Engine + 3-Layer Light Score
-- ============================================

-- 1A. Extend pplp_scores with VVU columns
ALTER TABLE public.pplp_scores
  ADD COLUMN IF NOT EXISTS vvu_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_value NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quality_factor NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trust_context NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS intent_integrity_score NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS impact_multiplier NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS anti_abuse_factor NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS event_reputation_premium NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS scoring_engine_version TEXT DEFAULT 'v2.0';

-- 1B. Add vvu_total to light_score_ledger
ALTER TABLE public.light_score_ledger
  ADD COLUMN IF NOT EXISTS vvu_total NUMERIC DEFAULT 0;

-- 1C. Create user_light_scores table
CREATE TABLE IF NOT EXISTS public.user_light_scores (
  user_id UUID PRIMARY KEY,
  personal_light NUMERIC NOT NULL DEFAULT 0,
  network_light NUMERIC NOT NULL DEFAULT 0,
  legacy_light NUMERIC NOT NULL DEFAULT 0,
  total_light_raw NUMERIC NOT NULL DEFAULT 0,
  display_light NUMERIC NOT NULL DEFAULT 0,
  light_tier TEXT NOT NULL DEFAULT 'seed_light',
  consistency_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  reliability_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  alpha NUMERIC NOT NULL DEFAULT 0.6,
  beta NUMERIC NOT NULL DEFAULT 0.25,
  gamma NUMERIC NOT NULL DEFAULT 0.15,
  last_pls_update TIMESTAMPTZ,
  last_nls_update TIMESTAMPTZ,
  last_lls_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_light_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own light scores"
  ON public.user_light_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage light scores"
  ON public.user_light_scores FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_light_scores_total ON public.user_light_scores (total_light_raw DESC);
CREATE INDEX IF NOT EXISTS idx_user_light_scores_tier ON public.user_light_scores (light_tier);

-- 1D. compute_light_tier
CREATE OR REPLACE FUNCTION public.compute_light_tier(_display_light NUMERIC)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _display_light >= 800 THEN 'cosmic_light'
    WHEN _display_light >= 500 THEN 'legacy_light'
    WHEN _display_light >= 300 THEN 'radiant_light'
    WHEN _display_light >= 150 THEN 'guiding_light'
    WHEN _display_light >= 50  THEN 'pure_light'
    ELSE 'seed_light'
  END;
$$;

-- 1E. compute_intent_integrity (IIS: 0→1.5)
CREATE OR REPLACE FUNCTION public.compute_intent_integrity(_user_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_active_days INT;
  v_consistency_ratio NUMERIC;
  v_pass_count INT;
  v_total_actions INT;
  v_pass_ratio NUMERIC;
  v_burst_penalty NUMERIC;
  v_max_type_pct NUMERIC;
  v_monotony_penalty NUMERIC;
  v_iis NUMERIC;
BEGIN
  SELECT count(DISTINCT date) INTO v_active_days
  FROM features_user_day
  WHERE user_id = _user_id AND date >= (current_date - 30);

  v_consistency_ratio := COALESCE(v_active_days::NUMERIC / 30.0, 0);

  SELECT
    count(*) FILTER (WHERE final_light_score > 0),
    count(*)
  INTO v_pass_count, v_total_actions
  FROM pplp_scores
  WHERE actor_id = _user_id AND created_at >= (now() - interval '30 days');

  v_pass_ratio := CASE WHEN v_total_actions > 0
    THEN v_pass_count::NUMERIC / v_total_actions ELSE 0.5 END;

  v_burst_penalty := CASE
    WHEN v_active_days > 0 AND (v_total_actions::NUMERIC / v_active_days) > 15 THEN 0.85
    ELSE 1.0 END;

  SELECT COALESCE(max(type_pct), 0) INTO v_max_type_pct
  FROM (
    SELECT count(*)::NUMERIC / NULLIF(sum(count(*)) OVER(), 0) AS type_pct
    FROM pplp_scores
    WHERE actor_id = _user_id AND created_at >= (now() - interval '7 days')
    GROUP BY action_type
  ) sub;

  v_monotony_penalty := CASE WHEN v_max_type_pct > 0.7 THEN 0.8 ELSE 1.0 END;

  v_iis := (0.4 * v_consistency_ratio + 0.6 * v_pass_ratio)
            * v_burst_penalty * v_monotony_penalty * 1.5;

  RETURN GREATEST(0, LEAST(1.5, v_iis));
END;
$$;

-- 1F. compute_network_light (NLS)
CREATE OR REPLACE FUNCTION public.compute_network_light(_user_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referral_score NUMERIC := 0;
  v_help_score NUMERIC := 0;
  v_nls NUMERIC;
BEGIN
  SELECT COALESCE(sum(
    CASE WHEN ref_actions >= 5 THEN 2.0
         WHEN ref_actions >= 1 THEN 0.5 ELSE 0 END
  ), 0) INTO v_referral_score
  FROM (
    SELECT p.user_id,
           (SELECT count(*) FROM pplp_scores ps WHERE ps.actor_id = p.user_id) AS ref_actions
    FROM profiles p WHERE p.referred_by = _user_id
  ) sub;

  SELECT COALESCE(sum(CASE WHEN is_verified THEN 1.5 ELSE 0.3 END), 0)
  INTO v_help_score
  FROM community_helps
  WHERE helper_id = _user_id AND created_at >= (now() - interval '30 days');

  v_nls := v_referral_score * 0.6 + v_help_score * 0.4;
  RETURN LEAST(COALESCE(v_nls, 0), 50);
END;
$$;

-- 1G. compute_legacy_light (LLS)
CREATE OR REPLACE FUNCTION public.compute_legacy_light(_user_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_content_reuse NUMERIC := 0;
  v_content_longevity NUMERIC := 0;
BEGIN
  SELECT COALESCE(sum(
    ln(1 + COALESCE(likes_count, 0) + COALESCE(comments_count, 0) * 2 + COALESCE(shares_count, 0) * 3)
    * CASE
        WHEN created_at < now() - interval '90 days' THEN 1.5
        WHEN created_at < now() - interval '30 days' THEN 1.2
        ELSE 1.0 END
  ), 0) INTO v_content_reuse
  FROM community_posts
  WHERE user_id = _user_id
    AND (COALESCE(likes_count, 0) + COALESCE(comments_count, 0) + COALESCE(shares_count, 0)) > 0;

  SELECT COALESCE(count(*) * 0.3, 0) INTO v_content_longevity
  FROM gratitude_journal
  WHERE user_id = _user_id AND created_at < now() - interval '30 days';

  RETURN LEAST(COALESCE(v_content_reuse + v_content_longevity, 0), 100);
END;
$$;

-- 1H. recompute_user_light_score (aggregate PLS+NLS+LLS→TLS)
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
  SELECT COALESCE(max(consistency_streak), 0) INTO v_streak
  FROM features_user_day
  WHERE user_id = _user_id AND date >= current_date - 7;

  v_consistency := GREATEST(0.9, LEAST(1.3, 1 + ln(1 + v_streak) / 10));

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

  SELECT COALESCE(sum(COALESCE(vvu_score, final_light_score)), 0) * v_consistency * v_reliability
  INTO v_pls FROM pplp_scores WHERE actor_id = _user_id;

  v_nls := compute_network_light(_user_id);
  v_lls := compute_legacy_light(_user_id);

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
