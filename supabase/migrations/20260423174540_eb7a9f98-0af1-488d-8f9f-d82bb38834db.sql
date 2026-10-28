CREATE OR REPLACE FUNCTION public.compute_network_light(_user_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  referral_vvu NUMERIC := 0;
  quality_network NUMERIC := 1.0;
  trust_network NUMERIC := 1.0;
  diversity_network NUMERIC := 1.0;
  active_referrals INT := 0;
  total_referrals INT := 0;
  referral_avg_vvu NUMERIC := 0;
  distinct_action_types INT := 0;
BEGIN
  SELECT COALESCE(SUM(s.vvu_score), 0), COUNT(DISTINCT a.actor_id), COUNT(*)
  INTO referral_vvu, active_referrals, total_referrals
  FROM pplp_actions a
  JOIN pplp_scores s ON s.action_id = a.id AND s.decision = 'pass'
  WHERE a.actor_id IN (
    SELECT angel_user_id FROM fun_id_links
    WHERE fun_profile_user_id = _user_id::text AND status = 'active'
  )
  AND a.created_at >= CURRENT_DATE - 90;

  IF active_referrals > 0 THEN
    referral_avg_vvu := referral_vvu / GREATEST(active_referrals, 1);
    quality_network := LEAST(1.5, GREATEST(0.5, 0.5 + referral_avg_vvu / 20));
  END IF;

  IF total_referrals > 0 THEN
    trust_network := LEAST(1.3, GREATEST(0.5, active_referrals::NUMERIC / GREATEST(total_referrals, 1) + 0.5));
  END IF;

  SELECT COUNT(DISTINCT a.action_type) INTO distinct_action_types
  FROM pplp_actions a
  WHERE a.actor_id IN (
    SELECT angel_user_id FROM fun_id_links
    WHERE fun_profile_user_id = _user_id::text AND status = 'active'
  )
  AND a.created_at >= CURRENT_DATE - 90
  AND a.status = 'scored';

  IF distinct_action_types > 0 THEN
    diversity_network := LEAST(1.2, GREATEST(0.8, 0.8 + distinct_action_types::NUMERIC / 25));
  END IF;

  RETURN GREATEST(0, referral_vvu * quality_network * trust_network * diversity_network / 100);
END;
$function$;