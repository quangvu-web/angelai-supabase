-- ============================================================================
-- IDENTITY + TRUST LAYER v1.0
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Mở rộng user_dids
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_dids
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'human'
    CHECK (entity_type IN ('human','organization','ai_agent','validator','merchant')),
  ADD COLUMN IF NOT EXISTS did_level smallint NOT NULL DEFAULT 0
    CHECK (did_level BETWEEN 0 AND 4),
  ADD COLUMN IF NOT EXISTS verification_state jsonb NOT NULL DEFAULT '{
    "email_verified": false,
    "phone_verified": false,
    "wallet_linked": false,
    "kyc_level": 0,
    "liveness_passed": false,
    "social_proofs": [],
    "device_trust": "unknown"
  }'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. trust_profile (tim của layer)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trust_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id uuid NOT NULL UNIQUE REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tc numeric(4,3) NOT NULL DEFAULT 0.300 CHECK (tc BETWEEN 0.300 AND 1.500),
  trust_tier text NOT NULL DEFAULT 'T0' CHECK (trust_tier IN ('T0','T1','T2','T3','T4')),
  vs numeric(3,2) NOT NULL DEFAULT 0.20,
  bs numeric(3,2) NOT NULL DEFAULT 0.30,
  ss numeric(3,2) NOT NULL DEFAULT 0.20,
  os numeric(3,2) NOT NULL DEFAULT 0.20,
  hs numeric(3,2) NOT NULL DEFAULT 0.50,
  risk_factor numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (risk_factor BETWEEN 0.30 AND 1.00),
  sybil_risk text NOT NULL DEFAULT 'low' CHECK (sybil_risk IN ('low','medium','high','critical')),
  fraud_risk text NOT NULL DEFAULT 'low' CHECK (fraud_risk IN ('low','medium','high','critical')),
  computation_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trust_profile_user ON public.trust_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_profile_tier ON public.trust_profile(trust_tier);
ALTER TABLE public.trust_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own trust profile" ON public.trust_profile
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages trust profile" ON public.trust_profile
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ----------------------------------------------------------------------------
-- 3. sbt_registry
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sbt_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id text NOT NULL UNIQUE,
  did_id uuid NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  sbt_type text NOT NULL CHECK (sbt_type IN ('identity','trust','contribution','credential','milestone','legacy')),
  sbt_subtype text NOT NULL,
  issuer text NOT NULL DEFAULT 'system',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','revoked','archived')),
  evidence_hash text,
  trust_weight numeric(3,2) NOT NULL DEFAULT 0.00,
  privacy_level text NOT NULL DEFAULT 'public' CHECK (privacy_level IN ('public','permissioned','private')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sbt_did ON public.sbt_registry(did_id);
CREATE INDEX IF NOT EXISTS idx_sbt_user ON public.sbt_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_sbt_type ON public.sbt_registry(sbt_type, status);
ALTER TABLE public.sbt_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active public SBTs" ON public.sbt_registry
  FOR SELECT USING (status = 'active' AND privacy_level = 'public');
CREATE POLICY "Users view own SBTs" ON public.sbt_registry
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages SBTs" ON public.sbt_registry
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ----------------------------------------------------------------------------
-- 4. attestation_log (schema only - P2P để Phase 3)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attestation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_did uuid REFERENCES public.user_dids(id) ON DELETE SET NULL,
  from_system text,
  to_did uuid NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  attestation_type text NOT NULL,
  weight numeric(3,2) NOT NULL DEFAULT 0.10,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_from_source CHECK (from_did IS NOT NULL OR from_system IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_attestation_to ON public.attestation_log(to_did, status);
ALTER TABLE public.attestation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view attestations about themselves" ON public.attestation_log
  FOR SELECT USING (
    to_did IN (SELECT id FROM public.user_dids WHERE user_id = auth.uid())
  );
CREATE POLICY "Service role manages attestations" ON public.attestation_log
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ----------------------------------------------------------------------------
-- 5. dib_profile (Digital Identity Bank — 7 vault hash)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dib_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id uuid NOT NULL UNIQUE REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  identity_vault_hash text,
  trust_vault_hash text,
  reputation_vault_hash text,
  contribution_vault_hash text,
  credential_vault_hash text,
  governance_vault_hash text,
  economic_access_hash text,
  snapshot_root_hash text,
  last_snapshot_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dib_user ON public.dib_profile(user_id);
ALTER TABLE public.dib_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own DIB" ON public.dib_profile
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages DIB" ON public.dib_profile
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ----------------------------------------------------------------------------
-- 6. identity_recovery_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.identity_recovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id uuid NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  recovery_type text NOT NULL CHECK (recovery_type IN ('primary','wallet','guardian','governance')),
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','approved','rejected','completed','expired')),
  cooldown_until timestamptz,
  risk_delta numeric(3,2) NOT NULL DEFAULT 0.00,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_recovery_user ON public.identity_recovery_log(user_id, created_at DESC);
ALTER TABLE public.identity_recovery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recovery log" ON public.identity_recovery_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages recovery" ON public.identity_recovery_log
  FOR ALL USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- ----------------------------------------------------------------------------
-- 7. Mở rộng light_score_snapshots
-- ----------------------------------------------------------------------------
ALTER TABLE public.light_score_snapshots
  ADD COLUMN IF NOT EXISTS did_level smallint,
  ADD COLUMN IF NOT EXISTS tc numeric(4,3),
  ADD COLUMN IF NOT EXISTS trust_tier text,
  ADD COLUMN IF NOT EXISTS sybil_risk text,
  ADD COLUMN IF NOT EXISTS active_sbt_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dib_state_root text;

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- get_trust_tier
CREATE OR REPLACE FUNCTION public.get_trust_tier(_tc numeric)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _tc >= 1.25 THEN 'T4'
    WHEN _tc >= 1.00 THEN 'T3'
    WHEN _tc >= 0.80 THEN 'T2'
    WHEN _tc >= 0.60 THEN 'T1'
    ELSE 'T0'
  END;
$$;

-- compute_trust_confidence
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
  _wallet_age_days integer := 0;
  _sybil_risk text := 'low';
  _fraud_risk text := 'low';
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

  -- SS: Social Trust (system-issued attestation count)
  SELECT COUNT(*)::int INTO _sbt_count
  FROM public.attestation_log
  WHERE to_did = _did_id AND status = 'active';
  _ss := LEAST(1.00, 0.20 + _sbt_count * 0.10);

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
  -- Whitelist bonus
  IF EXISTS (SELECT 1 FROM public.fraud_whitelist WHERE user_id = _did.user_id) THEN
    _hs := LEAST(1.00, _hs + 0.20);
  END IF;

  -- Risk Factor
  IF _fraud_signals >= 5 THEN
    _rf := 0.30;
    _fraud_risk := 'critical';
  ELSIF _fraud_signals >= 3 THEN
    _rf := 0.60;
    _fraud_risk := 'high';
  ELSIF _fraud_signals >= 1 THEN
    _rf := 0.85;
    _fraud_risk := 'medium';
  END IF;

  -- Sybil risk (basic heuristic via device count)
  IF EXISTS (
    SELECT 1 FROM public.pplp_device_registry
    WHERE device_fingerprint IN (
      SELECT device_fingerprint FROM public.pplp_device_registry WHERE user_id = _did.user_id
    )
    GROUP BY device_fingerprint HAVING COUNT(DISTINCT user_id) >= 3
  ) THEN
    _sybil_risk := 'high';
    _rf := LEAST(_rf, 0.70);
  END IF;

  -- SBT Trust Weight bonus
  SELECT COALESCE(SUM(trust_weight), 0) INTO _sbt_bonus
  FROM public.sbt_registry
  WHERE did_id = _did_id AND status = 'active';
  _sbt_bonus := LEAST(0.30, _sbt_bonus);

  -- Final TC
  _tc := (0.30 * _vs + 0.25 * _bs + 0.15 * _ss + 0.20 * _os + 0.10 * _hs) * _rf + _sbt_bonus;
  _tc := GREATEST(0.300, LEAST(1.500, _tc));

  RETURN jsonb_build_object(
    'tc', round(_tc::numeric, 3),
    'tier', public.get_trust_tier(_tc),
    'vs', round(_vs::numeric, 2),
    'bs', round(_bs::numeric, 2),
    'ss', round(_ss::numeric, 2),
    'os', round(_os::numeric, 2),
    'hs', round(_hs::numeric, 2),
    'risk_factor', round(_rf::numeric, 2),
    'sybil_risk', _sybil_risk,
    'fraud_risk', _fraud_risk,
    'sbt_bonus', round(_sbt_bonus::numeric, 2)
  );
END;
$$;

-- update_trust_profile
CREATE OR REPLACE FUNCTION public.update_trust_profile(_did_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
  _user_id uuid;
BEGIN
  SELECT user_id INTO _user_id FROM public.user_dids WHERE id = _did_id;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'did_not_found');
  END IF;

  _result := public.compute_trust_confidence(_did_id);

  INSERT INTO public.trust_profile (
    did_id, user_id, tc, trust_tier, vs, bs, ss, os, hs,
    risk_factor, sybil_risk, fraud_risk, computation_meta, last_computed_at, updated_at
  ) VALUES (
    _did_id, _user_id,
    (_result->>'tc')::numeric,
    _result->>'tier',
    (_result->>'vs')::numeric,
    (_result->>'bs')::numeric,
    (_result->>'ss')::numeric,
    (_result->>'os')::numeric,
    (_result->>'hs')::numeric,
    (_result->>'risk_factor')::numeric,
    _result->>'sybil_risk',
    _result->>'fraud_risk',
    _result,
    now(), now()
  )
  ON CONFLICT (did_id) DO UPDATE SET
    tc = EXCLUDED.tc,
    trust_tier = EXCLUDED.trust_tier,
    vs = EXCLUDED.vs, bs = EXCLUDED.bs, ss = EXCLUDED.ss,
    os = EXCLUDED.os, hs = EXCLUDED.hs,
    risk_factor = EXCLUDED.risk_factor,
    sybil_risk = EXCLUDED.sybil_risk,
    fraud_risk = EXCLUDED.fraud_risk,
    computation_meta = EXCLUDED.computation_meta,
    last_computed_at = now(),
    updated_at = now();

  RETURN _result;
END;
$$;

-- issue_sbt
CREATE OR REPLACE FUNCTION public.issue_sbt(
  _did_id uuid,
  _sbt_type text,
  _sbt_subtype text,
  _issuer text DEFAULT 'system',
  _evidence_hash text DEFAULT NULL,
  _trust_weight numeric DEFAULT 0.05,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _token_id text;
  _new_id uuid;
BEGIN
  SELECT user_id INTO _user_id FROM public.user_dids WHERE id = _did_id;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'DID not found'; END IF;

  _token_id := 'sbt_' || _sbt_type || '_' || encode(gen_random_bytes(8), 'hex');

  INSERT INTO public.sbt_registry (
    token_id, did_id, user_id, sbt_type, sbt_subtype,
    issuer, evidence_hash, trust_weight, metadata
  ) VALUES (
    _token_id, _did_id, _user_id, _sbt_type, _sbt_subtype,
    _issuer, _evidence_hash, _trust_weight, _metadata
  ) RETURNING id INTO _new_id;

  -- Auto-recompute trust profile after issuance
  PERFORM public.update_trust_profile(_did_id);
  RETURN _new_id;
END;
$$;

-- compute_dib_vault_hashes
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

  SELECT did || '|' || COALESCE(wallet_address,'') || '|' || did_level::text || '|' || verification_state::text
    INTO _identity_data FROM public.user_dids WHERE id = _did_id;

  SELECT COALESCE(tc::text || '|' || trust_tier || '|' || sybil_risk, 'none')
    INTO _trust_data FROM public.trust_profile WHERE did_id = _did_id;

  SELECT COALESCE(string_agg(token_id, ',' ORDER BY token_id), 'none')
    INTO _rep_data FROM public.sbt_registry
    WHERE did_id = _did_id AND status = 'active';

  SELECT COALESCE(SUM(user_amount)::text, '0')
    INTO _contrib_data FROM public.fun_distribution_logs WHERE actor_id = _user_id;

  _cred_data := 'credentials_v1';
  _gov_data := 'governance_v1';

  SELECT COALESCE(string_agg(sbt_type || ':' || sbt_subtype, ',' ORDER BY sbt_type), 'none')
    INTO _econ_data FROM public.sbt_registry
    WHERE did_id = _did_id AND status = 'active' AND sbt_type IN ('trust','legacy');

  _vaults := jsonb_build_object(
    'identity_vault_hash', encode(digest(_identity_data, 'sha256'), 'hex'),
    'trust_vault_hash', encode(digest(_trust_data, 'sha256'), 'hex'),
    'reputation_vault_hash', encode(digest(_rep_data, 'sha256'), 'hex'),
    'contribution_vault_hash', encode(digest(_contrib_data, 'sha256'), 'hex'),
    'credential_vault_hash', encode(digest(_cred_data, 'sha256'), 'hex'),
    'governance_vault_hash', encode(digest(_gov_data, 'sha256'), 'hex'),
    'economic_access_hash', encode(digest(_econ_data, 'sha256'), 'hex')
  );

  -- Compute snapshot root
  _vaults := _vaults || jsonb_build_object(
    'snapshot_root_hash', encode(digest(_vaults::text, 'sha256'), 'hex')
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

-- check_mint_gate
CREATE OR REPLACE FUNCTION public.check_mint_gate(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tier text := 'T0';
  _tc numeric := 0.300;
  _cap_pct numeric := 0.5;
  _warning text := NULL;
  _did_id uuid;
BEGIN
  SELECT id INTO _did_id FROM public.user_dids WHERE user_id = _user_id;
  IF _did_id IS NULL THEN
    RETURN jsonb_build_object(
      'tier','T0','tc',0.3,'cap_pct',0.5,
      'warning','Bạn chưa tạo Định danh số (DID). Tạo ngay để mở khoá 100% phần thưởng.',
      'has_did', false
    );
  END IF;

  SELECT trust_tier, tc INTO _tier, _tc FROM public.trust_profile WHERE did_id = _did_id;
  IF _tier IS NULL THEN
    _tier := 'T0';
    _tc := 0.300;
  END IF;

  _cap_pct := CASE _tier
    WHEN 'T0' THEN 0.5
    ELSE 1.0
  END;

  IF _tier = 'T0' THEN
    _warning := 'Trust Tier T0: bạn nhận 50% phần thưởng. Hãy xác minh email/wallet để mở 100%.';
  END IF;

  RETURN jsonb_build_object(
    'tier', _tier,
    'tc', _tc,
    'cap_pct', _cap_pct,
    'warning', _warning,
    'has_did', true
  );
END;
$$;

-- take_identity_snapshot
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
BEGIN
  SELECT * INTO _did FROM public.user_dids WHERE id = _did_id;
  IF _did IS NULL THEN RETURN jsonb_build_object('error','did_not_found'); END IF;
  _user_id := _did.user_id;

  PERFORM public.update_trust_profile(_did_id);
  _vaults := public.compute_dib_vault_hashes(_did_id);

  SELECT * INTO _trust FROM public.trust_profile WHERE did_id = _did_id;
  SELECT COUNT(*) INTO _sbt_count FROM public.sbt_registry WHERE did_id = _did_id AND status = 'active';

  INSERT INTO public.light_score_snapshots (
    user_id, did_id, snapshot_epoch, light_score,
    pillar_s, pillar_t, pillar_h, pillar_c, pillar_u,
    total_actions, trust_multiplier, time_decay_factor, snapshot_hash,
    did_level, tc, trust_tier, sybil_risk, active_sbt_count, dib_state_root
  ) VALUES (
    _user_id, _did_id, _epoch, 0,
    0,0,0,0,0,
    0, COALESCE(_trust.tc, 1.0), 1.0,
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
    dib_state_root = EXCLUDED.dib_state_root;

  RETURN jsonb_build_object('snapshot_epoch', _epoch, 'vaults', _vaults, 'tc', _trust.tc, 'tier', _trust.trust_tier);
END;
$$;

-- ============================================================================
-- TRIGGER: auto-create trust_profile + dib_profile khi DID tạo mới
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_auto_init_trust_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.trust_profile (did_id, user_id) VALUES (NEW.id, NEW.user_id)
  ON CONFLICT (did_id) DO NOTHING;
  INSERT INTO public.dib_profile (did_id, user_id) VALUES (NEW.id, NEW.user_id)
  ON CONFLICT (did_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_did_init_trust ON public.user_dids;
CREATE TRIGGER trg_did_init_trust
  AFTER INSERT ON public.user_dids
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_init_trust_profile();

-- ============================================================================
-- TRIGGER: updated_at cho các bảng mới
-- ============================================================================
CREATE TRIGGER trg_trust_profile_updated_at
  BEFORE UPDATE ON public.trust_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_sbt_registry_updated_at
  BEFORE UPDATE ON public.sbt_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_dib_profile_updated_at
  BEFORE UPDATE ON public.dib_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- SEED tham số vào pplp_parameter_config
-- ============================================================================
INSERT INTO public.pplp_parameter_config (key, value, phase, description) VALUES
  ('trust_engine_weights',
   '{"vs":0.30,"bs":0.25,"ss":0.15,"os":0.20,"hs":0.10}'::jsonb,
   'production', 'Trọng số 5 nhóm trong công thức TC'),
  ('trust_tier_bands',
   '{"T0":[0.300,0.599],"T1":[0.600,0.799],"T2":[0.800,0.999],"T3":[1.000,1.249],"T4":[1.250,1.500]}'::jsonb,
   'production', 'Khoảng TC cho từng tier'),
  ('mint_gate_caps',
   '{"T0":0.5,"T1":1.0,"T2":1.0,"T3":1.0,"T4":1.0}'::jsonb,
   'production', 'Hệ số cap cho Mint Gate mềm theo tier'),
  ('sbt_trust_weights',
   '{"identity":{"per":0.05,"max":0.10},"trust":{"per":0.08,"max":0.16},"contribution":{"per":0.05,"max":0.20},"credential":{"per":0.03,"max":0.15},"milestone":{"per":0.02,"max":0.10},"legacy":{"per":0.10,"max":0.20}}'::jsonb,
   'production', 'Trọng số trust bonus mỗi loại SBT')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();