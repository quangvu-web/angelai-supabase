-- 1) Add decay tracking columns to trust_profile
ALTER TABLE public.trust_profile
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS decay_factor numeric DEFAULT 1.0;

-- Initialize last_activity_at for existing rows
UPDATE public.trust_profile tp
SET last_activity_at = COALESCE((
  SELECT MAX(created_at) FROM public.pplp_actions WHERE actor_id = tp.user_id
), tp.updated_at, now())
WHERE last_activity_at IS NULL;

-- 2) trust_history table (daily snapshots)
CREATE TABLE IF NOT EXISTS public.trust_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  did_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  tc numeric NOT NULL,
  trust_tier text NOT NULL,
  decay_factor numeric NOT NULL DEFAULT 1.0,
  vs numeric, bs numeric, ss numeric, os numeric, hs numeric,
  days_inactive int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_trust_history_user_date
  ON public.trust_history (user_id, snapshot_date DESC);

ALTER TABLE public.trust_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own trust history" ON public.trust_history;
CREATE POLICY "Users view own trust history"
  ON public.trust_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all trust history" ON public.trust_history;
CREATE POLICY "Admins view all trust history"
  ON public.trust_history FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "System insert trust history" ON public.trust_history;
CREATE POLICY "System insert trust history"
  ON public.trust_history FOR INSERT
  WITH CHECK (true);

-- 3) Updated compute_trust_confidence with decay + history snapshot
CREATE OR REPLACE FUNCTION public.compute_trust_confidence(_did_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _vs numeric := 0; _bs numeric := 0; _ss numeric := 0;
  _os numeric := 0; _hs numeric := 0;
  _rf numeric := 1.0;
  _did_level int; _wallet text; _user_id uuid;
  _account_age int; _action_count int; _fraud_count int;
  _sbt_bonus numeric := 0; _trust_sbt_count int := 0;
  _attestation_bonus numeric := 0;
  _tc numeric; _tc_pre_decay numeric;
  _last_activity timestamptz; _days_inactive int := 0;
  _decay numeric := 1.0;
  _tier text;
BEGIN
  SELECT did_level, wallet_address, user_id INTO _did_level, _wallet, _user_id
  FROM public.user_dids WHERE id = _did_id;

  IF _did_level IS NULL THEN RETURN 0.3; END IF;

  _vs := CASE _did_level WHEN 0 THEN 0 WHEN 1 THEN 0.4 WHEN 2 THEN 0.7 WHEN 3 THEN 0.9 ELSE 1.0 END;

  SELECT EXTRACT(DAY FROM now() - created_at)::int INTO _account_age
  FROM auth.users WHERE id = _user_id;
  _account_age := COALESCE(_account_age, 0);

  SELECT COUNT(*) INTO _action_count
  FROM public.pplp_actions
  WHERE actor_id = _user_id AND created_at > now() - interval '30 days';

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

  _tc_pre_decay := (_vs * 0.30 + _bs * 0.25 + _ss * 0.15 + _os * 0.20 + _hs * 0.10) * _rf + _sbt_bonus;

  -- DECAY: refresh last_activity from latest action
  SELECT GREATEST(
    COALESCE((SELECT MAX(created_at) FROM public.pplp_actions WHERE actor_id = _user_id), 'epoch'::timestamptz),
    COALESCE((SELECT last_activity_at FROM public.trust_profile WHERE did_id = _did_id), 'epoch'::timestamptz)
  ) INTO _last_activity;

  _days_inactive := GREATEST(0, EXTRACT(DAY FROM now() - _last_activity)::int);

  _decay := CASE
    WHEN _days_inactive < 60  THEN 1.0
    WHEN _days_inactive < 90  THEN 0.95
    WHEN _days_inactive < 120 THEN 0.85
    WHEN _days_inactive < 180 THEN 0.70
    ELSE 0.50
  END;

  _tc := GREATEST(0.3, LEAST(1.5, _tc_pre_decay * _decay));
  _tier := public.get_trust_tier(_tc);

  UPDATE public.trust_profile
  SET vs = _vs, bs = _bs, ss = _ss, os = _os, hs = _hs,
      risk_factor = _rf, tc = _tc,
      trust_tier = _tier,
      sybil_risk = CASE WHEN _trust_sbt_count >= 2 THEN 'low' ELSE sybil_risk END,
      last_activity_at = _last_activity,
      decay_factor = _decay,
      last_computed_at = now()
  WHERE did_id = _did_id;

  -- Snapshot daily history (idempotent per day)
  INSERT INTO public.trust_history (
    user_id, did_id, snapshot_date, tc, trust_tier, decay_factor,
    vs, bs, ss, os, hs, days_inactive
  )
  VALUES (
    _user_id, _did_id, (now() AT TIME ZONE 'UTC')::date, _tc, _tier, _decay,
    _vs, _bs, _ss, _os, _hs, _days_inactive
  )
  ON CONFLICT (user_id, snapshot_date) DO UPDATE
  SET tc = EXCLUDED.tc,
      trust_tier = EXCLUDED.trust_tier,
      decay_factor = EXCLUDED.decay_factor,
      vs = EXCLUDED.vs, bs = EXCLUDED.bs, ss = EXCLUDED.ss,
      os = EXCLUDED.os, hs = EXCLUDED.hs,
      days_inactive = EXCLUDED.days_inactive;

  RETURN _tc;
END;
$function$;

-- 4) Batch decay applier (cron daily)
CREATE OR REPLACE FUNCTION public.apply_trust_decay_batch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _did record;
  _processed int := 0;
  _decayed int := 0;
BEGIN
  FOR _did IN
    SELECT tp.did_id
    FROM public.trust_profile tp
    JOIN public.user_dids ud ON ud.id = tp.did_id
  LOOP
    PERFORM public.compute_trust_confidence(_did.did_id);
    _processed := _processed + 1;
  END LOOP;

  SELECT COUNT(*) INTO _decayed
  FROM public.trust_profile WHERE decay_factor < 1.0;

  RETURN jsonb_build_object(
    'processed', _processed,
    'decayed', _decayed,
    'ran_at', now()
  );
END;
$$;

-- 5) Trust trend RPC for charting
CREATE OR REPLACE FUNCTION public.get_trust_trend(_user_id uuid, _days int DEFAULT 30)
RETURNS TABLE (
  snapshot_date date,
  tc numeric,
  trust_tier text,
  decay_factor numeric,
  days_inactive int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT snapshot_date, tc, trust_tier, decay_factor, days_inactive
  FROM public.trust_history
  WHERE user_id = _user_id
    AND snapshot_date >= ((now() AT TIME ZONE 'UTC')::date - (_days || ' days')::interval)::date
  ORDER BY snapshot_date ASC;
$$;