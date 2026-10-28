-- =============================================
-- FIX #2: SBT feedback vào TC + sybil suppression
-- =============================================
CREATE OR REPLACE FUNCTION public.compute_trust_confidence(_did_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _did record;
  _vs numeric := 0.20;
  _bs numeric := 0.30;
  _ss numeric := 0.20;
  _os numeric := 0.20;
  _hs numeric := 0.50;
  _rf numeric := 1.00;
  _tc numeric;
  _sbt_bonus numeric := 0;
  _login_streak integer := 0;
  _action_count integer := 0;
  _fraud_signals integer := 0;
  _sbt_count integer := 0;
  _sbt_trust_count integer := 0;
  _attest_count integer := 0;
  _sybil_risk text := 'low';
  _fraud_risk text := 'low';
  _device_count integer := 0;
BEGIN
  SELECT * INTO _did FROM public.user_dids WHERE id = _did_id;
  IF _did IS NULL THEN
    RETURN jsonb_build_object('error', 'did_not_found');
  END IF;

  -- VS: Verification Strength
  _vs := 0.20
    + CASE WHEN (_did.verification_state->>'email_verified')::boolean THEN 0.15 ELSE 0 END
    + CASE WHEN (_did.verification_state->>'phone_verified')::boolean THEN 0.15 ELSE 0 END
    + CASE WHEN (_did.verification_state->>'wallet_linked')::boolean THEN 0.20 ELSE 0 END
    + CASE WHEN COALESCE((_did.verification_state->>'kyc_level')::int, 0) >= 1 THEN 0.20 ELSE 0 END
    + CASE WHEN (_did.verification_state->>'liveness_passed')::boolean THEN 0.10 ELSE 0 END;
  _vs := LEAST(1.00, _vs);

  -- BS: Behavior Stability
  SELECT COALESCE(MAX(streak_count), 0) INTO _login_streak
  FROM public.daily_login_tracking WHERE user_id = _did.user_id;
  SELECT COUNT(*)::int INTO _action_count
  FROM public.pplp_actions
  WHERE actor_id = _did.user_id
    AND created_at >= now() - interval '30 days';
  _bs := LEAST(1.00,
    0.30
    + LEAST(0.40, _login_streak * 0.02)
    + LEAST(0.30, _action_count * 0.01)
  );

  -- SS: Social Trust (attestations)
  SELECT COUNT(*)::int INTO _attest_count
  FROM public.attestation_log
  WHERE to_did = _did_id AND status = 'active';
  _ss := LEAST(1.00, 0.20 + _attest_count * 0.10);

  -- OS: On-chain Credibility
  IF _did.wallet_address IS NOT NULL THEN
    _os := 0.50;
    IF EXISTS (SELECT 1 FROM public.fun_distribution_logs WHERE actor_id = _did.user_id LIMIT 1) THEN
      _os := 0.80;
    END IF;
  ELSE
    _os := 0.20;
  END IF;

  -- HS: Historical Cleanliness
  SELECT COUNT(*)::int INTO _fraud_signals
  FROM public.fraud_alerts
  WHERE user_id = _did.user_id AND severity IN ('high','critical');
  _hs := CASE
    WHEN _fraud_signals = 0 THEN 0.80
    WHEN _fraud_signals <= 2 THEN 0.50
    ELSE 0.20
  END;
  IF EXISTS (SELECT 1 FROM public.fraud_whitelist WHERE user_id = _did.user_id) THEN
    _hs := LEAST(1.00, _hs + 0.20);
  END IF;

  -- ===== FIX #2: SBT feedback bonus =====
  SELECT COUNT(*)::int INTO _sbt_count
  FROM public.sbt_registry
  WHERE did_id = _did_id AND status = 'active';

  SELECT COUNT(*)::int INTO _sbt_trust_count
  FROM public.sbt_registry
  WHERE did_id = _did_id AND status = 'active' AND sbt_type IN ('trust','legacy');

  -- Mỗi SBT active +0.03, mỗi trust/legacy thêm +0.05, cap +0.30
  _sbt_bonus := LEAST(0.30, _sbt_count * 0.03 + _sbt_trust_count * 0.05);

  -- Risk Factor (fraud)
  IF _fraud_signals >= 5 THEN
    _rf := 0.30; _fraud_risk := 'critical';
  ELSIF _fraud_signals >= 3 THEN
    _rf := 0.60; _fraud_risk := 'high';
  ELSIF _fraud_signals >= 1 THEN
    _rf := 0.85; _fraud_risk := 'medium';
  END IF;

  -- Sybil risk + suppression (SBT giảm sybil)
  IF _sbt_trust_count >= 2 THEN
    _sybil_risk := 'low';
  ELSIF _sbt_count = 0 AND _action_count > 50 AND _login_streak < 3 THEN
    _sybil_risk := 'high';
    _rf := LEAST(_rf, 0.70);
  ELSIF _sbt_count = 0 AND _action_count > 20 THEN
    _sybil_risk := 'medium';
    _rf := LEAST(_rf, 0.85);
  END IF;

  -- TC = (weighted sum + sbt_bonus) × RF
  _tc := (
    0.30 * _vs +
    0.25 * _bs +
    0.15 * _ss +
    0.20 * _os +
    0.10 * _hs +
    _sbt_bonus
  ) * _rf;

  -- Clamp 0.30 – 1.50
  _tc := GREATEST(0.30, LEAST(1.50, _tc));

  RETURN jsonb_build_object(
    'tc', ROUND(_tc::numeric, 4),
    'vs', ROUND(_vs::numeric, 4),
    'bs', ROUND(_bs::numeric, 4),
    'ss', ROUND(_ss::numeric, 4),
    'os', ROUND(_os::numeric, 4),
    'hs', ROUND(_hs::numeric, 4),
    'rf', ROUND(_rf::numeric, 4),
    'sbt_bonus', ROUND(_sbt_bonus::numeric, 4),
    'sbt_count', _sbt_count,
    'sybil_risk', _sybil_risk,
    'fraud_risk', _fraud_risk
  );
END;
$$;

-- =============================================
-- FIX #1: get_effective_tc — cổng đọc TC cho VVU engine
-- =============================================
CREATE OR REPLACE FUNCTION public.get_effective_tc(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _did_id uuid;
  _tc numeric;
  _tier text;
  _sybil text;
BEGIN
  SELECT id INTO _did_id FROM public.user_dids
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at ASC LIMIT 1;

  IF _did_id IS NULL THEN
    RETURN jsonb_build_object('tc', 0.65, 'tier', 'T0', 'sybil_risk', 'medium', 'has_did', false);
  END IF;

  SELECT tc, trust_tier, sybil_risk
    INTO _tc, _tier, _sybil
  FROM public.trust_profile WHERE did_id = _did_id;

  IF _tc IS NULL THEN
    RETURN jsonb_build_object('tc', 0.80, 'tier', 'T1', 'sybil_risk', 'low', 'has_did', true);
  END IF;

  RETURN jsonb_build_object(
    'tc', _tc,
    'tier', _tier,
    'sybil_risk', _sybil,
    'has_did', true,
    'did_id', _did_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_tc(uuid) TO authenticated, anon, service_role;

-- =============================================
-- FIX #3: get_user_permissions — Activation Matrix RPC trung tâm
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _did record;
  _trust record;
  _tc numeric := 0.30;
  _tier text := 'T0';
  _level int := 0;
  _sybil text := 'low';
  _fraud text := 'low';
  _has_clean_history boolean := false;
  _has_trust_sbt boolean := false;
BEGIN
  SELECT * INTO _did FROM public.user_dids
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at ASC LIMIT 1;

  IF _did IS NOT NULL THEN
    _level := COALESCE(_did.did_level, 0);
    SELECT * INTO _trust FROM public.trust_profile WHERE did_id = _did.id;
    IF _trust IS NOT NULL THEN
      _tc := COALESCE(_trust.tc, 0.30);
      _tier := COALESCE(_trust.trust_tier, 'T0');
      _sybil := COALESCE(_trust.sybil_risk, 'low');
      _fraud := COALESCE(_trust.fraud_risk, 'low');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.sbt_registry
      WHERE did_id = _did.id AND status = 'active' AND sbt_subtype = 'clean_history'
    ) INTO _has_clean_history;

    SELECT EXISTS (
      SELECT 1 FROM public.sbt_registry
      WHERE did_id = _did.id AND status = 'active' AND sbt_type IN ('trust','legacy')
    ) INTO _has_trust_sbt;
  END IF;

  RETURN jsonb_build_object(
    'did_level', _level,
    'tc', _tc,
    'tier', _tier,
    'sybil_risk', _sybil,
    'fraud_risk', _fraud,
    'permissions', jsonb_build_object(
      'can_access_basic',     true,
      'can_earn_basic',       _level >= 1 AND _tc >= 0.60 AND _sybil <> 'critical',
      'can_receive_referral', _level >= 2 AND _tc >= 0.80 AND _sybil NOT IN ('high','critical'),
      'can_vote',             _level >= 2 AND _tc >= 1.00 AND _fraud = 'low',
      'can_propose',          _level >= 3 AND _tc >= 1.10 AND _has_trust_sbt,
      'can_review',           _level >= 3 AND _tc >= 1.15 AND _has_trust_sbt,
      'can_issue_sbt',        _level >= 4 AND _tc >= 1.25,
      'can_mint_full',        _level >= 1 AND _tc >= 0.60 AND _sybil <> 'critical',
      'can_use_guardian_recovery', _level >= 3 AND _has_trust_sbt
    ),
    'gates', jsonb_build_object(
      'mint_cap_pct', CASE
        WHEN _sybil = 'critical' OR _fraud = 'critical' THEN 0
        WHEN _tier = 'T0' THEN 0.5
        ELSE 1.0
      END,
      'requires_review', _fraud IN ('high','critical') OR _sybil IN ('high','critical')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated, anon, service_role;

-- =============================================
-- FIX #4: compute_dib_vault_hashes — credential + governance vault dữ liệu thật
-- =============================================
CREATE OR REPLACE FUNCTION public.compute_dib_vault_hashes(_did_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _identity_data text; _trust_data text; _rep_data text;
  _contrib_data text; _cred_data text; _gov_data text; _econ_data text;
  _vaults jsonb;
BEGIN
  SELECT user_id INTO _user_id FROM public.user_dids WHERE id = _did_id;
  IF _user_id IS NULL THEN RETURN jsonb_build_object('error','did_not_found'); END IF;

  -- Identity vault
  SELECT did || '|' || COALESCE(wallet_address,'') || '|' || did_level::text || '|' || verification_state::text
    INTO _identity_data FROM public.user_dids WHERE id = _did_id;

  -- Trust vault
  SELECT COALESCE(tc::text || '|' || trust_tier || '|' || sybil_risk || '|' || fraud_risk, 'none')
    INTO _trust_data FROM public.trust_profile WHERE did_id = _did_id;

  -- Reputation vault — toàn bộ SBT active
  SELECT COALESCE(string_agg(token_id || ':' || sbt_type || ':' || sbt_subtype, ',' ORDER BY token_id), 'none')
    INTO _rep_data FROM public.sbt_registry
    WHERE did_id = _did_id AND status = 'active';

  -- Contribution vault — tổng FUN distributed
  SELECT COALESCE(SUM(user_amount)::text, '0') || '|' || COUNT(*)::text
    INTO _contrib_data FROM public.fun_distribution_logs WHERE actor_id = _user_id;

  -- Credential vault — SBT type credential + bounty completions
  SELECT COALESCE(string_agg(sbt_subtype, ',' ORDER BY sbt_subtype), 'none') || '|' ||
         COALESCE((SELECT COUNT(*)::text FROM public.bounty_submissions WHERE user_id = _user_id AND status = 'approved'), '0')
    INTO _cred_data FROM public.sbt_registry
    WHERE did_id = _did_id AND status = 'active' AND sbt_type = 'credential';

  -- Governance vault — voting/proposal history (placeholder data thật khi có module governance)
  SELECT COALESCE(string_agg(sbt_subtype, ',' ORDER BY sbt_subtype), 'none')
    INTO _gov_data FROM public.sbt_registry
    WHERE did_id = _did_id AND status = 'active' AND sbt_type IN ('contribution','legacy');

  -- Economic access vault — trust + legacy + activation
  SELECT COALESCE(string_agg(sbt_type || ':' || sbt_subtype, ',' ORDER BY sbt_type), 'none')
    INTO _econ_data FROM public.sbt_registry
    WHERE did_id = _did_id AND status = 'active' AND sbt_type IN ('trust','legacy','milestone');

  _vaults := jsonb_build_object(
    'identity_vault_hash', encode(digest(COALESCE(_identity_data,'none'), 'sha256'), 'hex'),
    'trust_vault_hash', encode(digest(COALESCE(_trust_data,'none'), 'sha256'), 'hex'),
    'reputation_vault_hash', encode(digest(COALESCE(_rep_data,'none'), 'sha256'), 'hex'),
    'contribution_vault_hash', encode(digest(COALESCE(_contrib_data,'none'), 'sha256'), 'hex'),
    'credential_vault_hash', encode(digest(COALESCE(_cred_data,'none'), 'sha256'), 'hex'),
    'governance_vault_hash', encode(digest(COALESCE(_gov_data,'none'), 'sha256'), 'hex'),
    'economic_access_hash', encode(digest(COALESCE(_econ_data,'none'), 'sha256'), 'hex')
  );

  -- Snapshot root = hash của 7 vault hashes (không include chính nó)
  _vaults := _vaults || jsonb_build_object(
    'snapshot_root_hash', encode(digest(
      (_vaults->>'identity_vault_hash') || '|' ||
      (_vaults->>'trust_vault_hash') || '|' ||
      (_vaults->>'reputation_vault_hash') || '|' ||
      (_vaults->>'contribution_vault_hash') || '|' ||
      (_vaults->>'credential_vault_hash') || '|' ||
      (_vaults->>'governance_vault_hash') || '|' ||
      (_vaults->>'economic_access_hash'),
      'sha256'
    ), 'hex')
  );

  INSERT INTO public.dib_profile (
    did_id, user_id,
    identity_vault_hash, trust_vault_hash, reputation_vault_hash,
    contribution_vault_hash, credential_vault_hash,
    governance_vault_hash, economic_access_hash,
    snapshot_root_hash, last_snapshot_at, updated_at
  ) VALUES (
    _did_id, _user_id,
    _vaults->>'identity_vault_hash',
    _vaults->>'trust_vault_hash',
    _vaults->>'reputation_vault_hash',
    _vaults->>'contribution_vault_hash',
    _vaults->>'credential_vault_hash',
    _vaults->>'governance_vault_hash',
    _vaults->>'economic_access_hash',
    _vaults->>'snapshot_root_hash',
    now(), now()
  )
  ON CONFLICT (did_id) DO UPDATE SET
    identity_vault_hash = EXCLUDED.identity_vault_hash,
    trust_vault_hash = EXCLUDED.trust_vault_hash,
    reputation_vault_hash = EXCLUDED.reputation_vault_hash,
    contribution_vault_hash = EXCLUDED.contribution_vault_hash,
    credential_vault_hash = EXCLUDED.credential_vault_hash,
    governance_vault_hash = EXCLUDED.governance_vault_hash,
    economic_access_hash = EXCLUDED.economic_access_hash,
    snapshot_root_hash = EXCLUDED.snapshot_root_hash,
    last_snapshot_at = now(),
    updated_at = now();

  RETURN _vaults;
END;
$$;

-- =============================================
-- FIX #4 (b): take_identity_snapshot — snapshot light_score thực
-- =============================================
CREATE OR REPLACE FUNCTION public.take_identity_snapshot(_did_id uuid, _epoch text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _vaults jsonb;
  _trust record;
  _did record;
  _sbt_count int;
  _ls record;
BEGIN
  SELECT * INTO _did FROM public.user_dids WHERE id = _did_id;
  IF _did IS NULL THEN RETURN jsonb_build_object('error','did_not_found'); END IF;
  _user_id := _did.user_id;

  PERFORM public.update_trust_profile(_did_id);
  _vaults := public.compute_dib_vault_hashes(_did_id);

  SELECT * INTO _trust FROM public.trust_profile WHERE did_id = _did_id;
  SELECT COUNT(*) INTO _sbt_count FROM public.sbt_registry WHERE did_id = _did_id AND status = 'active';

  -- Lấy light score gần nhất nếu có
  SELECT light_score, pillar_s, pillar_t, pillar_h, pillar_c, pillar_u, total_actions
    INTO _ls
  FROM public.light_score_snapshots
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.light_score_snapshots (
    user_id, did_id, snapshot_epoch, light_score,
    pillar_s, pillar_t, pillar_h, pillar_c, pillar_u,
    total_actions, trust_multiplier, time_decay_factor, snapshot_hash,
    did_level, tc, trust_tier, sybil_risk, active_sbt_count, dib_state_root
  ) VALUES (
    _user_id, _did_id, _epoch,
    COALESCE(_ls.light_score, 0),
    COALESCE(_ls.pillar_s, 0),
    COALESCE(_ls.pillar_t, 0),
    COALESCE(_ls.pillar_h, 0),
    COALESCE(_ls.pillar_c, 0),
    COALESCE(_ls.pillar_u, 0),
    COALESCE(_ls.total_actions, 0),
    COALESCE(_trust.tc, 1.0), 1.0,
    _vaults->>'snapshot_root_hash',
    _did.did_level, _trust.tc, _trust.trust_tier, _trust.sybil_risk,
    _sbt_count, _vaults->>'snapshot_root_hash'
  )
  ON CONFLICT (user_id, snapshot_epoch) DO UPDATE SET
    did_level = EXCLUDED.did_level,
    tc = EXCLUDED.tc,
    trust_tier = EXCLUDED.trust_tier,
    sybil_risk = EXCLUDED.sybil_risk,
    active_sbt_count = EXCLUDED.active_sbt_count,
    dib_state_root = EXCLUDED.dib_state_root,
    snapshot_hash = EXCLUDED.snapshot_hash;

  RETURN jsonb_build_object(
    'snapshot_epoch', _epoch,
    'vaults', _vaults,
    'tc', _trust.tc,
    'tier', _trust.trust_tier,
    'sbt_count', _sbt_count,
    'snapshot_root_hash', _vaults->>'snapshot_root_hash'
  );
END;
$$;