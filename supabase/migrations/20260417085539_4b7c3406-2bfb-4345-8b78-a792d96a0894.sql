-- Drop old 5-arg overload to allow signature change
DROP FUNCTION IF EXISTS public.create_attestation(uuid, text, jsonb, numeric, integer);

-- 1. Abuse flags table
CREATE TABLE IF NOT EXISTS public.attestation_abuse_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id uuid NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  flag_type text NOT NULL CHECK (flag_type IN ('reciprocal_pair','loop3','burst','rate_limit_hit','self_attest_attempt')),
  severity int NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 5),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_attestation_id uuid,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abuse_flags_did ON public.attestation_abuse_flags(did_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_user ON public.attestation_abuse_flags(user_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_unresolved ON public.attestation_abuse_flags(is_resolved, created_at DESC) WHERE is_resolved = false;

ALTER TABLE public.attestation_abuse_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_abuse" ON public.attestation_abuse_flags;
CREATE POLICY "admin_read_abuse" ON public.attestation_abuse_flags
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin_update_abuse" ON public.attestation_abuse_flags;
CREATE POLICY "admin_update_abuse" ON public.attestation_abuse_flags
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Helper: shared guardrail logic
CREATE OR REPLACE FUNCTION public.check_attestation_guardrails(
  _from_did uuid,
  _to_did uuid,
  _attestation_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today_global int;
  _today_pair int;
  _last_same_pair timestamptz;
  _reciprocal_recent int;
  _loop3_count int;
BEGIN
  IF _from_did = _to_did THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_self_attest', 'message', 'Không thể tự attest chính mình');
  END IF;

  SELECT COUNT(*) INTO _today_global
  FROM public.attestation_log
  WHERE from_did = _from_did
    AND created_at >= date_trunc('day', now());

  IF _today_global >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_limit', 'message', 'Đã đạt giới hạn 5 attestation/ngày');
  END IF;

  SELECT COUNT(*) INTO _today_pair
  FROM public.attestation_log
  WHERE from_did = _from_did
    AND to_did = _to_did
    AND created_at >= date_trunc('day', now());

  IF _today_pair >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'pair_limit', 'message', 'Tối đa 3 attestation/ngày cho cùng một người');
  END IF;

  SELECT MAX(created_at) INTO _last_same_pair
  FROM public.attestation_log
  WHERE from_did = _from_did
    AND to_did = _to_did
    AND attestation_type = _attestation_type
    AND status = 'active';

  IF _last_same_pair IS NOT NULL AND _last_same_pair > now() - interval '30 days' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cooldown', 'message', 'Cần đợi 30 ngày kể từ attestation cùng loại trước đó');
  END IF;

  -- A→B→A within 7 days
  SELECT COUNT(*) INTO _reciprocal_recent
  FROM public.attestation_log
  WHERE from_did = _to_did
    AND to_did = _from_did
    AND status = 'active'
    AND created_at >= now() - interval '7 days';

  IF _reciprocal_recent > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reciprocal_blocked', 'message', 'Đối tác đã attest bạn trong 7 ngày qua — chống vòng đối ứng');
  END IF;

  -- A→B→C→A within 14 days (B is anyone the caller has attested; C must have attested both B and the new target)
  SELECT COUNT(*) INTO _loop3_count
  FROM public.attestation_log a1
  WHERE a1.from_did = _from_did
    AND a1.to_did <> _to_did
    AND a1.status = 'active'
    AND a1.created_at >= now() - interval '14 days'
    AND EXISTS (
      SELECT 1 FROM public.attestation_log a2
      WHERE a2.from_did = a1.to_did
        AND a2.to_did = _to_did
        AND a2.status = 'active'
        AND a2.created_at >= now() - interval '14 days'
    )
    AND EXISTS (
      SELECT 1 FROM public.attestation_log a3
      WHERE a3.from_did = _to_did
        AND a3.to_did = a1.to_did
        AND a3.status = 'active'
        AND a3.created_at >= now() - interval '14 days'
    );

  IF _loop3_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'loop3_blocked', 'message', 'Phát hiện vòng lặp tin cậy 3 bước (A→B→C→A) — bị chặn để chống Sybil');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3. Post-attestation flagger (sybil_risk is text: low/medium/high)
CREATE OR REPLACE FUNCTION public.flag_post_attestation(
  _from_did uuid,
  _from_user uuid,
  _attestation_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _burst_count int;
BEGIN
  SELECT COUNT(*) INTO _burst_count
  FROM public.attestation_log
  WHERE from_did = _from_did
    AND created_at >= now() - interval '1 hour';

  IF _burst_count >= 4 THEN
    INSERT INTO public.attestation_abuse_flags(did_id, user_id, flag_type, severity, details, related_attestation_id)
    VALUES (_from_did, _from_user, 'burst', 3,
      jsonb_build_object('count_1h', _burst_count, 'threshold', 4),
      _attestation_id);

    UPDATE public.trust_profile
       SET sybil_risk = 'high'
     WHERE did_id = _from_did
       AND COALESCE(sybil_risk,'low') NOT IN ('high','critical');
  END IF;
END;
$$;

-- 4. Update create_attestation (3-arg)
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
  _from_user uuid;
  _gate jsonb;
  _base_weight numeric;
  _final_weight numeric;
  _attestation_id uuid;
  _to_user_id uuid;
BEGIN
  IF _attestation_type NOT IN ('vouch_trust', 'vouch_skill', 'vouch_contribution', 'endorse_identity') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_type');
  END IF;

  SELECT d.id, tp.trust_tier, tp.tc, d.user_id
  INTO _from_did_id, _from_tier, _from_tc, _from_user
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

  _gate := public.check_attestation_guardrails(_from_did_id, _to_did_id, _attestation_type);
  IF NOT (_gate->>'ok')::boolean THEN
    IF _gate->>'error' IN ('reciprocal_blocked','loop3_blocked','pair_limit','daily_limit') THEN
      INSERT INTO public.attestation_abuse_flags(did_id, user_id, flag_type, severity, details)
      VALUES (_from_did_id, _from_user,
        CASE _gate->>'error'
          WHEN 'reciprocal_blocked' THEN 'reciprocal_pair'
          WHEN 'loop3_blocked' THEN 'loop3'
          ELSE 'rate_limit_hit'
        END,
        CASE _gate->>'error' WHEN 'loop3_blocked' THEN 4 WHEN 'reciprocal_blocked' THEN 3 ELSE 2 END,
        jsonb_build_object('to_did', _to_did_id, 'type', _attestation_type, 'reason', _gate->>'error'));
    END IF;
    RETURN jsonb_build_object('success', false, 'error', _gate->>'error', 'message', _gate->>'message');
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

  PERFORM public.flag_post_attestation(_from_did_id, _from_user, _attestation_id);

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

-- 5. Recreate 5-arg validator overload with guardrails
CREATE OR REPLACE FUNCTION public.create_attestation(
  _to_did uuid,
  _attestation_type text,
  _evidence jsonb,
  _weight numeric,
  _expires_in_days integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _from_did_id uuid;
  _from_user uuid;
  _from_entity text;
  _gate jsonb;
  _final_weight numeric;
  _attestation_id uuid;
  _validator_reward numeric := 5;
BEGIN
  SELECT id, user_id, entity_type INTO _from_did_id, _from_user, _from_entity
  FROM user_dids WHERE user_id = auth.uid() LIMIT 1;

  IF _from_did_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_did');
  END IF;

  _gate := public.check_attestation_guardrails(_from_did_id, _to_did, _attestation_type);
  IF NOT (_gate->>'ok')::boolean THEN
    IF _gate->>'error' IN ('reciprocal_blocked','loop3_blocked','pair_limit','daily_limit') THEN
      INSERT INTO public.attestation_abuse_flags(did_id, user_id, flag_type, severity, details)
      VALUES (_from_did_id, _from_user,
        CASE _gate->>'error'
          WHEN 'reciprocal_blocked' THEN 'reciprocal_pair'
          WHEN 'loop3_blocked' THEN 'loop3'
          ELSE 'rate_limit_hit'
        END,
        CASE _gate->>'error' WHEN 'loop3_blocked' THEN 4 WHEN 'reciprocal_blocked' THEN 3 ELSE 2 END,
        jsonb_build_object('to_did', _to_did, 'type', _attestation_type, 'reason', _gate->>'error', 'overload','validator'));
    END IF;
    RETURN jsonb_build_object('success', false, 'error', _gate->>'error', 'message', _gate->>'message');
  END IF;

  _final_weight := _weight;
  IF _from_entity = 'validator' AND EXISTS (
    SELECT 1 FROM validator_stakes WHERE did_id = _from_did_id AND status = 'active'
  ) THEN
    _final_weight := _weight * 2;
  END IF;

  INSERT INTO attestation_log (
    from_did, to_did, attestation_type, evidence, weight, expires_at, status
  )
  VALUES (
    _from_did_id, _to_did, _attestation_type, _evidence, _final_weight,
    CASE WHEN _expires_in_days IS NOT NULL THEN now() + (_expires_in_days || ' days')::interval ELSE NULL END,
    'active'
  )
  RETURNING id INTO _attestation_id;

  PERFORM public.flag_post_attestation(_from_did_id, _from_user, _attestation_id);

  IF _from_entity = 'validator' AND EXISTS (
    SELECT 1 FROM validator_stakes WHERE did_id = _from_did_id AND status = 'active'
  ) THEN
    PERFORM distribute_validator_reward(_from_did_id, _validator_reward, 'attestation', _attestation_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'attestation_id', _attestation_id,
    'final_weight', _final_weight,
    'validator_boost', _final_weight > _weight
  );
END;
$$;

-- 6. Admin RPC: list abuse flags
CREATE OR REPLACE FUNCTION public.get_attestation_abuse_flags(
  _only_unresolved boolean DEFAULT true,
  _limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  did_id uuid,
  did_identifier text,
  user_id uuid,
  user_email text,
  flag_type text,
  severity int,
  details jsonb,
  related_attestation_id uuid,
  is_resolved boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.did_id,
    d.did_identifier,
    f.user_id,
    u.email::text,
    f.flag_type,
    f.severity,
    f.details,
    f.related_attestation_id,
    f.is_resolved,
    f.created_at
  FROM public.attestation_abuse_flags f
  LEFT JOIN public.user_dids d ON d.id = f.did_id
  LEFT JOIN auth.users u ON u.id = f.user_id
  WHERE (_only_unresolved = false OR f.is_resolved = false)
  ORDER BY f.created_at DESC
  LIMIT _limit;
END;
$$;

-- 7. Admin RPC: resolve flag
CREATE OR REPLACE FUNCTION public.admin_clear_abuse_flag(_flag_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  UPDATE public.attestation_abuse_flags
     SET is_resolved = true,
         resolved_at = now(),
         resolved_by = auth.uid()
   WHERE id = _flag_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_attestation(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_attestation(uuid, text, jsonb, numeric, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_attestation_guardrails(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_attestation_abuse_flags(boolean, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_abuse_flag(uuid) TO authenticated;