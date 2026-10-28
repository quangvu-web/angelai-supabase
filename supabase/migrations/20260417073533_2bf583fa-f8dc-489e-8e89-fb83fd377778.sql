
-- 1. ORG PROFILES
CREATE TABLE IF NOT EXISTS public.org_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id uuid NOT NULL UNIQUE REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  banner_url text,
  website text,
  category text NOT NULL DEFAULT 'community',
  description text,
  member_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_profiles_did ON public.org_profiles(did_id);
CREATE INDEX IF NOT EXISTS idx_org_profiles_slug ON public.org_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_org_profiles_category ON public.org_profiles(category);

ALTER TABLE public.org_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view org profiles"
ON public.org_profiles FOR SELECT USING (true);

CREATE POLICY "Owner can update org profile"
ON public.org_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owner can insert org profile"
ON public.org_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_org_profiles_updated
BEFORE UPDATE ON public.org_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. VALIDATOR STAKES
CREATE TABLE IF NOT EXISTS public.validator_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id uuid NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  locked_until timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','unstaking','released','slashed')),
  slash_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validator_stakes_did ON public.validator_stakes(did_id);
CREATE INDEX IF NOT EXISTS idx_validator_stakes_status ON public.validator_stakes(status);

ALTER TABLE public.validator_stakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own stakes"
ON public.validator_stakes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Public can view active stakes summary"
ON public.validator_stakes FOR SELECT USING (status = 'active');

CREATE POLICY "Admins can view all stakes"
ON public.validator_stakes FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. REGISTER ORG / VALIDATOR
CREATE OR REPLACE FUNCTION public.register_org_or_validator(
  _entity_type text,
  _display_name text,
  _category text DEFAULT 'community',
  _description text DEFAULT NULL,
  _website text DEFAULT NULL,
  _logo_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _did_id uuid;
  _existing uuid;
  _slug text;
  _org_id uuid;
BEGIN
  IF _entity_type NOT IN ('org','validator') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_entity_type');
  END IF;

  SELECT id INTO _did_id FROM user_dids WHERE user_id = auth.uid() LIMIT 1;
  IF _did_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_did_found');
  END IF;

  SELECT id INTO _existing FROM org_profiles WHERE did_id = _did_id;
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_registered');
  END IF;

  -- Validator requires min trust tier T2
  IF _entity_type = 'validator' THEN
    IF NOT EXISTS (
      SELECT 1 FROM trust_profile
      WHERE did_id = _did_id AND trust_tier IN ('T2','T3','T4')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'validator_requires_tier_t2');
    END IF;
  END IF;

  _slug := lower(regexp_replace(_display_name, '[^a-z0-9]+', '-', 'gi'));
  _slug := substring(_slug || '-' || substring(_did_id::text, 1, 8) FROM 1 FOR 64);

  UPDATE user_dids SET entity_type = _entity_type, updated_at = now()
  WHERE id = _did_id;

  INSERT INTO org_profiles (did_id, user_id, display_name, slug, category, description, website, logo_url)
  VALUES (_did_id, auth.uid(), _display_name, _slug, _category, _description, _website, _logo_url)
  RETURNING id INTO _org_id;

  INSERT INTO did_events (did_id, user_id, event_type, event_data)
  VALUES (_did_id, auth.uid(), 'entity_promoted',
    jsonb_build_object('to', _entity_type, 'org_id', _org_id));

  RETURN jsonb_build_object('success', true, 'org_id', _org_id, 'slug', _slug, 'entity_type', _entity_type);
END;
$$;

-- 4. STAKE FOR VALIDATOR
CREATE OR REPLACE FUNCTION public.stake_for_validator(_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _did_id uuid;
  _balance numeric;
  _stake_id uuid;
  _min_stake numeric := 10000;
BEGIN
  IF _amount < _min_stake THEN
    RETURN jsonb_build_object('success', false, 'error', 'below_minimum', 'min', _min_stake);
  END IF;

  SELECT id INTO _did_id FROM user_dids WHERE user_id = auth.uid() LIMIT 1;
  IF _did_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_did');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM user_dids WHERE id = _did_id AND entity_type = 'validator') THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_validator');
  END IF;

  SELECT balance INTO _balance FROM camly_coin_balances WHERE user_id = auth.uid();
  IF COALESCE(_balance, 0) < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  -- Deduct from balance
  UPDATE camly_coin_balances
  SET balance = balance - _amount,
      lifetime_spent = lifetime_spent + _amount,
      updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO camly_coin_transactions (user_id, amount, transaction_type, description, source_ref)
  VALUES (auth.uid(), -_amount, 'spend', 'Validator stake lock', 'validator_stake');

  INSERT INTO validator_stakes (did_id, user_id, amount, locked_until)
  VALUES (_did_id, auth.uid(), _amount, now() + interval '30 days')
  RETURNING id INTO _stake_id;

  RETURN jsonb_build_object('success', true, 'stake_id', _stake_id, 'locked_until', (now() + interval '30 days'));
END;
$$;

-- 5. UNSTAKE VALIDATOR
CREATE OR REPLACE FUNCTION public.unstake_validator(_stake_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _stake record;
BEGIN
  SELECT * INTO _stake FROM validator_stakes
  WHERE id = _stake_id AND user_id = auth.uid() AND status = 'active';

  IF _stake IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'stake_not_found');
  END IF;

  IF _stake.locked_until > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'still_locked', 'unlock_at', _stake.locked_until);
  END IF;

  UPDATE validator_stakes SET status = 'released', updated_at = now() WHERE id = _stake_id;

  UPDATE camly_coin_balances
  SET balance = balance + _stake.amount,
      lifetime_earned = lifetime_earned + _stake.amount,
      updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO camly_coin_transactions (user_id, amount, transaction_type, description, source_ref)
  VALUES (auth.uid(), _stake.amount, 'earn', 'Validator unstake release', _stake_id::text);

  RETURN jsonb_build_object('success', true, 'amount', _stake.amount);
END;
$$;

-- 6. GET ORG BY DID (public)
CREATE OR REPLACE FUNCTION public.get_org_by_did(_did text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  _result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'org', to_jsonb(op.*),
    'did', to_jsonb(ud.*),
    'trust_tier', tp.trust_tier,
    'tc', tp.tc,
    'total_stake', COALESCE((SELECT SUM(amount) FROM validator_stakes WHERE did_id = ud.id AND status = 'active'), 0)
  ) INTO _result
  FROM user_dids ud
  LEFT JOIN org_profiles op ON op.did_id = ud.id
  LEFT JOIN trust_profile tp ON tp.did_id = ud.id
  WHERE ud.did = _did OR op.slug = _did
  LIMIT 1;

  RETURN COALESCE(_result, jsonb_build_object('error', 'not_found'));
END;
$$;

-- 7. TOP VALIDATORS
CREATE OR REPLACE FUNCTION public.get_top_validators(_limit integer DEFAULT 20)
RETURNS TABLE (
  did_id uuid,
  did text,
  display_name text,
  slug text,
  logo_url text,
  total_stake numeric,
  trust_tier text,
  is_verified boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    ud.id,
    ud.did,
    op.display_name,
    op.slug,
    op.logo_url,
    COALESCE(SUM(vs.amount), 0) AS total_stake,
    tp.trust_tier,
    op.is_verified
  FROM user_dids ud
  JOIN org_profiles op ON op.did_id = ud.id
  LEFT JOIN validator_stakes vs ON vs.did_id = ud.id AND vs.status = 'active'
  LEFT JOIN trust_profile tp ON tp.did_id = ud.id
  WHERE ud.entity_type = 'validator'
  GROUP BY ud.id, ud.did, op.display_name, op.slug, op.logo_url, tp.trust_tier, op.is_verified
  ORDER BY total_stake DESC
  LIMIT _limit;
$$;
