CREATE OR REPLACE FUNCTION public.recompute_user_light_score(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pls NUMERIC;
  nls NUMERIC;
  lls NUMERIC;
  tls_raw NUMERIC;
  display_ls NUMERIC;
  tier TEXT;
  w_alpha NUMERIC := 0.6;
  w_beta NUMERIC := 0.25;
  w_gamma NUMERIC := 0.15;
  current_phase TEXT := 'early';
  phase_weights JSONB;
BEGIN
  SELECT config_value->>'phase' INTO current_phase
  FROM epoch_config WHERE config_key = 'current_phase' LIMIT 1;
  current_phase := COALESCE(current_phase, 'early');

  SELECT value->current_phase INTO phase_weights
  FROM pplp_parameter_config WHERE key = 'tls_weights';

  IF phase_weights IS NOT NULL THEN
    w_alpha := COALESCE((phase_weights->>'alpha')::NUMERIC, 0.6);
    w_beta := COALESCE((phase_weights->>'beta')::NUMERIC, 0.25);
    w_gamma := COALESCE((phase_weights->>'gamma')::NUMERIC, 0.15);
  END IF;

  -- PLS — join sang pplp_actions để lấy actor_id; fallback dùng light_score nếu vvu_score null
  SELECT COALESCE(SUM(COALESCE(s.vvu_score, s.light_score, 0)), 0) INTO pls
  FROM pplp_scores s
  JOIN pplp_actions a ON a.id = s.action_id
  WHERE a.actor_id = _user_id
    AND s.decision = 'pass'
    AND s.scoring_engine_version = 'v2.5';

  SELECT COALESCE(compute_network_light(_user_id), 0) INTO nls;
  SELECT COALESCE(compute_legacy_light(_user_id), 0) INTO lls;

  tls_raw := w_alpha * pls + w_beta * nls + w_gamma * lls;
  display_ls := ROUND(100 * LN(1 + tls_raw), 2);

  IF display_ls >= 800 THEN tier := 'cosmic_light';
  ELSIF display_ls >= 500 THEN tier := 'legacy_light';
  ELSIF display_ls >= 300 THEN tier := 'radiant_light';
  ELSIF display_ls >= 150 THEN tier := 'guiding_light';
  ELSIF display_ls >= 50 THEN tier := 'pure_light';
  ELSE tier := 'seed_light';
  END IF;

  INSERT INTO user_light_scores (user_id, personal_light, network_light, legacy_light, total_light_raw, display_light, light_tier, alpha, beta, gamma, updated_at)
  VALUES (_user_id, pls, nls, lls, tls_raw, display_ls, tier, w_alpha, w_beta, w_gamma, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    personal_light = EXCLUDED.personal_light,
    network_light = EXCLUDED.network_light,
    legacy_light = EXCLUDED.legacy_light,
    total_light_raw = EXCLUDED.total_light_raw,
    display_light = EXCLUDED.display_light,
    light_tier = EXCLUDED.light_tier,
    alpha = EXCLUDED.alpha,
    beta = EXCLUDED.beta,
    gamma = EXCLUDED.gamma,
    updated_at = NOW();
END;
$function$;