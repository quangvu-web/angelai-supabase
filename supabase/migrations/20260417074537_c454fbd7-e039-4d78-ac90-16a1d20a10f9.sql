
-- 1. VALIDATOR REWARDS TABLE
CREATE TABLE IF NOT EXISTS public.validator_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  did_id uuid NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  source_type text NOT NULL CHECK (source_type IN ('attestation','curation','governance','protocol_grant')),
  source_ref uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','forfeited')),
  claimed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validator_rewards_did ON public.validator_rewards(did_id);
CREATE INDEX IF NOT EXISTS idx_validator_rewards_user_status ON public.validator_rewards(user_id, status);

ALTER TABLE public.validator_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own rewards"
ON public.validator_rewards FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all rewards"
ON public.validator_rewards FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. SLASH VALIDATOR (admin only)
CREATE OR REPLACE FUNCTION public.slash_validator(
  _stake_id uuid,
  _reason text,
  _slash_pct numeric DEFAULT 0.5
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _stake record;
  _slash_amount numeric;
  _refund_amount numeric;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  IF _slash_pct <= 0 OR _slash_pct > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slash_pct');
  END IF;

  SELECT * INTO _stake FROM validator_stakes
  WHERE id = _stake_id AND status = 'active';

  IF _stake IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'stake_not_found_or_inactive');
  END IF;

  _slash_amount := _stake.amount * _slash_pct;
  _refund_amount := _stake.amount - _slash_amount;

  -- Mark stake as slashed
  UPDATE validator_stakes
  SET status = 'slashed', slash_reason = _reason, updated_at = now()
  WHERE id = _stake_id;

  -- Refund non-slashed portion to user
  IF _refund_amount > 0 THEN
    UPDATE camly_coin_balances
    SET balance = balance + _refund_amount,
        lifetime_earned = lifetime_earned + _refund_amount,
        updated_at = now()
    WHERE user_id = _stake.user_id;

    INSERT INTO camly_coin_transactions (user_id, amount, transaction_type, description, source_ref)
    VALUES (_stake.user_id, _refund_amount, 'earn', 'Validator stake partial refund after slash', _stake_id::text);
  END IF;

  -- Reduce trust risk
  UPDATE trust_profile
  SET risk_factor = LEAST(1.0, COALESCE(risk_factor, 0) + 0.15),
      updated_at = now()
  WHERE did_id = _stake.did_id;

  -- Forfeit pending rewards
  UPDATE validator_rewards
  SET status = 'forfeited'
  WHERE user_id = _stake.user_id AND status = 'pending';

  -- Log identity event
  INSERT INTO did_events (did_id, user_id, event_type, event_data)
  VALUES (
    _stake.did_id, _stake.user_id, 'validator_slashed',
    jsonb_build_object('stake_id', _stake_id, 'amount_slashed', _slash_amount, 'reason', _reason, 'slashed_by', auth.uid())
  );

  RETURN jsonb_build_object(
    'success', true,
    'slashed_amount', _slash_amount,
    'refunded', _refund_amount
  );
END;
$$;

-- 3. DISTRIBUTE VALIDATOR REWARD (system, can be called by triggers/edge functions)
CREATE OR REPLACE FUNCTION public.distribute_validator_reward(
  _did_id uuid,
  _amount numeric,
  _source_type text,
  _source_ref uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _reward_id uuid;
BEGIN
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  -- Verify is active validator
  SELECT user_id INTO _user_id FROM user_dids
  WHERE id = _did_id AND entity_type = 'validator';

  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_validator');
  END IF;

  -- Must have at least 1 active stake
  IF NOT EXISTS (SELECT 1 FROM validator_stakes WHERE did_id = _did_id AND status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_stake');
  END IF;

  INSERT INTO validator_rewards (did_id, user_id, amount, source_type, source_ref)
  VALUES (_did_id, _user_id, _amount, _source_type, _source_ref)
  RETURNING id INTO _reward_id;

  RETURN jsonb_build_object('success', true, 'reward_id', _reward_id);
END;
$$;

-- 4. CLAIM VALIDATOR REWARDS
CREATE OR REPLACE FUNCTION public.claim_validator_rewards()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _total numeric;
  _count integer;
BEGIN
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO _total, _count
  FROM validator_rewards
  WHERE user_id = auth.uid() AND status = 'pending';

  IF _total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_rewards');
  END IF;

  UPDATE validator_rewards
  SET status = 'claimed', claimed_at = now()
  WHERE user_id = auth.uid() AND status = 'pending';

  -- Credit balance
  INSERT INTO camly_coin_balances (user_id, balance, lifetime_earned)
  VALUES (auth.uid(), _total, _total)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = camly_coin_balances.balance + EXCLUDED.balance,
      lifetime_earned = camly_coin_balances.lifetime_earned + EXCLUDED.lifetime_earned,
      updated_at = now();

  INSERT INTO camly_coin_transactions (user_id, amount, transaction_type, description, source_ref)
  VALUES (auth.uid(), _total, 'earn', 'Validator rewards claim', 'validator_rewards_batch');

  RETURN jsonb_build_object('success', true, 'amount', _total, 'count', _count);
END;
$$;

-- 5. GET PENDING REWARDS SUMMARY
CREATE OR REPLACE FUNCTION public.get_validator_pending_rewards()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  _total numeric;
  _count integer;
  _by_source jsonb;
BEGIN
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO _total, _count
  FROM validator_rewards
  WHERE user_id = auth.uid() AND status = 'pending';

  SELECT COALESCE(jsonb_object_agg(source_type, total_amount), '{}'::jsonb) INTO _by_source
  FROM (
    SELECT source_type, SUM(amount) AS total_amount
    FROM validator_rewards
    WHERE user_id = auth.uid() AND status = 'pending'
    GROUP BY source_type
  ) t;

  RETURN jsonb_build_object('total', _total, 'count', _count, 'by_source', _by_source);
END;
$$;

-- 6. UPDATE create_attestation to apply validator weight ×2 + auto-reward
CREATE OR REPLACE FUNCTION public.create_attestation(
  _to_did uuid,
  _attestation_type text,
  _evidence jsonb DEFAULT '{}'::jsonb,
  _weight numeric DEFAULT 1.0,
  _expires_in_days integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _from_did_id uuid;
  _from_entity text;
  _final_weight numeric;
  _attestation_id uuid;
  _validator_reward numeric := 5; -- 5 CLY per attestation
BEGIN
  -- Get caller's DID + entity type
  SELECT id, entity_type INTO _from_did_id, _from_entity
  FROM user_dids WHERE user_id = auth.uid() LIMIT 1;

  IF _from_did_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_did');
  END IF;

  IF _from_did_id = _to_did THEN
    RETURN jsonb_build_object('success', false, 'error', 'self_attestation_not_allowed');
  END IF;

  -- Validator gets ×2 weight boost
  _final_weight := _weight;
  IF _from_entity = 'validator' AND EXISTS (
    SELECT 1 FROM validator_stakes WHERE did_id = _from_did_id AND status = 'active'
  ) THEN
    _final_weight := _weight * 2;
  END IF;

  -- Insert attestation
  INSERT INTO attestation_log (
    from_did, to_did, attestation_type, evidence, weight, expires_at, status
  )
  VALUES (
    _from_did_id, _to_did, _attestation_type, _evidence, _final_weight,
    CASE WHEN _expires_in_days IS NOT NULL THEN now() + (_expires_in_days || ' days')::interval ELSE NULL END,
    'active'
  )
  RETURNING id INTO _attestation_id;

  -- If validator, distribute reward
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

ALTER FUNCTION public.slash_validator(uuid,text,numeric) SET search_path = public;
ALTER FUNCTION public.distribute_validator_reward(uuid,numeric,text,uuid) SET search_path = public;
ALTER FUNCTION public.claim_validator_rewards() SET search_path = public;
ALTER FUNCTION public.get_validator_pending_rewards() SET search_path = public;
ALTER FUNCTION public.create_attestation(uuid,text,jsonb,numeric,integer) SET search_path = public;
