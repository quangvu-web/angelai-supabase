
-- Drop old function (return type incompatible)
DROP FUNCTION IF EXISTS public.compute_trust_confidence(uuid);

-- RLS attestation_log
ALTER TABLE public.attestation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view attestations involving their DID" ON public.attestation_log;
CREATE POLICY "Users view attestations involving their DID"
ON public.attestation_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_dids d
    WHERE (d.id = attestation_log.to_did OR d.id = attestation_log.from_did)
      AND d.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins view all attestations" ON public.attestation_log;
CREATE POLICY "Admins view all attestations"
ON public.attestation_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- compute_trust_confidence (recreated with attestation bonus)
-- =========================================
CREATE OR REPLACE FUNCTION public.compute_trust_confidence(_did_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _vs numeric := 0; _bs numeric := 0; _ss numeric := 0;
  _os numeric := 0; _hs numeric := 0;
  _rf numeric := 1.0;
  _did_level int; _wallet text; _user_id uuid;
  _account_age int; _action_count int; _fraud_count int;
  _sbt_bonus numeric := 0; _trust_sbt_count int := 0;
  _attestation_bonus numeric := 0;
  _tc numeric;
BEGIN
  SELECT did_level, wallet_address, user_id INTO _did_level, _wallet, _user_id
  FROM public.user_dids WHERE id = _did_id;

  IF _did_level IS NULL THEN RETURN 0.3; END IF;

  _vs := CASE _did_level WHEN 0 THEN 0 WHEN 1 THEN 0.4 WHEN 2 THEN 0.7 WHEN 3 THEN 0.9 ELSE 1.0 END;

  SELECT EXTRACT(DAY FROM now() - created_at)::int INTO _account_age
  FROM auth.users WHERE id = _user_id;
  _account_age := COALESCE(_account_age, 0);

  SELECT COUNT(*) INTO _action_count
  FROM public.pplp_action_logs
  WHERE user_id = _user_id AND created_at > now() - interval '30 days';

  _bs := LEAST(1.0, (_account_age::numeric / 90.0) * 0.5 + LEAST(1.0, _action_count::numeric / 50.0) * 0.5);

  _ss := LEAST(1.0, (
    COALESCE((SELECT COUNT(*) FROM public.community_comments WHERE user_id = _user_id), 0)::numeric / 30.0
  ) * 0.7);

  -- P2P attestation bonus to SS (cap +0.20)
  SELECT LEAST(0.20, COALESCE(SUM(weight), 0))
  INTO _attestation_bonus
  FROM public.attestation_log
  WHERE to_did = _did_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now());
  _ss := LEAST(1.0, _ss + _attestation_bonus);

  _os := CASE WHEN _wallet IS NOT NULL THEN 0.6 ELSE 0.0 END;

  SELECT COUNT(*) INTO _fraud_count
  FROM public.pplp_fraud_signals
  WHERE actor_id = _user_id AND created_at > now() - interval '90 days' AND severity >= 3;
  _hs := GREATEST(0, 1.0 - (_fraud_count::numeric * 0.2));

  _rf := GREATEST(0.5, 1.0 - (_fraud_count::numeric * 0.1));

  SELECT COUNT(*) INTO _trust_sbt_count
  FROM public.sbt_registry
  WHERE did_id = _did_id AND status = 'active' AND sbt_type IN ('trust', 'legacy');

  _sbt_bonus := LEAST(0.30, (
    SELECT COUNT(*)::numeric * 0.03 FROM public.sbt_registry
    WHERE did_id = _did_id AND status = 'active'
  ) + (_trust_sbt_count::numeric * 0.05));

  _tc := (_vs * 0.30 + _bs * 0.25 + _ss * 0.15 + _os * 0.20 + _hs * 0.10) * _rf + _sbt_bonus;
  _tc := GREATEST(0.3, LEAST(1.5, _tc));

  UPDATE public.trust_profile
  SET vs = _vs, bs = _bs, ss = _ss, os = _os, hs = _hs,
      risk_factor = _rf, tc = _tc,
      trust_tier = public.get_trust_tier(_tc),
      sybil_risk = CASE WHEN _trust_sbt_count >= 2 THEN 'low' ELSE sybil_risk END,
      last_computed_at = now()
  WHERE did_id = _did_id;

  RETURN _tc;
END;
$$;

-- =========================================
-- create_attestation
-- =========================================
CREATE OR REPLACE FUNCTION public.create_attestation(
  _to_did_id uuid,
  _attestation_type text,
  _evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from_did_id uuid;
  _from_tier text;
  _from_tc numeric;
  _today_count int;
  _last_same_pair timestamptz;
  _reciprocal_today int;
  _base_weight numeric;
  _final_weight numeric;
  _attestation_id uuid;
  _to_user_id uuid;
BEGIN
  IF _attestation_type NOT IN ('vouch_trust', 'vouch_skill', 'vouch_contribution', 'endorse_identity') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_type');
  END IF;

  SELECT d.id, tp.trust_tier, tp.tc
  INTO _from_did_id, _from_tier, _from_tc
  FROM public.user_dids d
  LEFT JOIN public.trust_profile tp ON tp.did_id = d.id
  WHERE d.user_id = auth.uid()
  LIMIT 1;

  IF _from_did_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_did', 'message', 'Bạn cần tạo DID trước');
  END IF;

  IF _from_tier IS NULL OR _from_tier = 'T0' THEN
    RETURN jsonb_build_object('success', false, 'error', 'tier_too_low', 'message', 'Cần Trust Tier T1+ để gửi attestation');
  END IF;

  IF _from_did_id = _to_did_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_self_attest', 'message', 'Không thể tự attest chính mình');
  END IF;

  SELECT COUNT(*) INTO _today_count
  FROM public.attestation_log
  WHERE from_did = _from_did_id
    AND created_at >= date_trunc('day', now());

  IF _today_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'daily_limit', 'message', 'Đã đạt giới hạn 5 attestation/ngày');
  END IF;

  SELECT MAX(created_at) INTO _last_same_pair
  FROM public.attestation_log
  WHERE from_did = _from_did_id
    AND to_did = _to_did_id
    AND attestation_type = _attestation_type
    AND status = 'active';

  IF _last_same_pair IS NOT NULL AND _last_same_pair > now() - interval '30 days' THEN
    RETURN jsonb_build_object('success', false, 'error', 'cooldown', 'message', 'Cần đợi 30 ngày kể từ attestation cùng loại trước đó');
  END IF;

  SELECT COUNT(*) INTO _reciprocal_today
  FROM public.attestation_log
  WHERE from_did = _to_did_id
    AND to_did = _from_did_id
    AND created_at >= now() - interval '24 hours';

  IF _reciprocal_today > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'reciprocal_blocked', 'message', 'Không thể attest 2 chiều trong cùng 24 giờ');
  END IF;

  _base_weight := CASE _attestation_type
    WHEN 'vouch_trust' THEN 0.10
    WHEN 'endorse_identity' THEN 0.08
    WHEN 'vouch_skill' THEN 0.05
    WHEN 'vouch_contribution' THEN 0.05
  END;
  _final_weight := round((_base_weight * COALESCE(_from_tc, 0.6) / 1.5)::numeric, 4);

  INSERT INTO public.attestation_log (
    from_did, to_did, attestation_type, weight, evidence, expires_at, status
  ) VALUES (
    _from_did_id, _to_did_id, _attestation_type, _final_weight, _evidence,
    now() + interval '365 days', 'active'
  )
  RETURNING id INTO _attestation_id;

  SELECT user_id INTO _to_user_id FROM public.user_dids WHERE id = _to_did_id;
  IF _to_user_id IS NOT NULL THEN
    PERFORM public.update_trust_profile(_to_user_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'attestation_id', _attestation_id,
    'weight', _final_weight,
    'expires_at', now() + interval '365 days'
  );
END;
$$;

-- =========================================
-- revoke_attestation
-- =========================================
CREATE OR REPLACE FUNCTION public.revoke_attestation(_attestation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from_did_id uuid;
  _to_did_id uuid;
  _to_user_id uuid;
BEGIN
  SELECT d.id INTO _from_did_id
  FROM public.user_dids d WHERE d.user_id = auth.uid() LIMIT 1;

  IF _from_did_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_did');
  END IF;

  SELECT to_did INTO _to_did_id
  FROM public.attestation_log
  WHERE id = _attestation_id AND from_did = _from_did_id AND status = 'active';

  IF _to_did_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found_or_not_owner');
  END IF;

  UPDATE public.attestation_log
  SET status = 'revoked'
  WHERE id = _attestation_id;

  SELECT user_id INTO _to_user_id FROM public.user_dids WHERE id = _to_did_id;
  IF _to_user_id IS NOT NULL THEN
    PERFORM public.update_trust_profile(_to_user_id);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =========================================
-- get_attestations_for_did
-- =========================================
CREATE OR REPLACE FUNCTION public.get_attestations_for_did(_did_id uuid)
RETURNS TABLE (
  id uuid,
  direction text,
  counterparty_did uuid,
  counterparty_label text,
  attestation_type text,
  weight numeric,
  status text,
  evidence jsonb,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    (CASE WHEN a.to_did = _did_id THEN 'received' ELSE 'sent' END)::text,
    (CASE WHEN a.to_did = _did_id THEN a.from_did ELSE a.to_did END),
    COALESCE(
      (SELECT did_identifier FROM public.user_dids WHERE id =
        CASE WHEN a.to_did = _did_id THEN a.from_did ELSE a.to_did END
      ),
      'system'
    )::text,
    a.attestation_type,
    a.weight,
    a.status,
    a.evidence,
    a.created_at,
    a.expires_at
  FROM public.attestation_log a
  WHERE a.to_did = _did_id OR a.from_did = _did_id
  ORDER BY a.created_at DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_attestation(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_attestation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attestations_for_did(uuid) TO authenticated;
