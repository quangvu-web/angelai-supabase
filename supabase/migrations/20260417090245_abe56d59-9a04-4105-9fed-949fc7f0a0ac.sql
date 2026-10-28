-- ============================================
-- Phase 4-J: Validator Marketplace RPCs
-- ============================================

-- 1. Marketplace listing with filters + sort + 30d stats
CREATE OR REPLACE FUNCTION public.get_validator_marketplace_list(
  _category text DEFAULT NULL,
  _sort text DEFAULT 'top_stake',
  _search text DEFAULT NULL,
  _limit int DEFAULT 24,
  _offset int DEFAULT 0
)
RETURNS TABLE(
  did_id uuid,
  display_name text,
  slug text,
  logo_url text,
  category text,
  is_verified boolean,
  description text,
  total_stake numeric,
  staker_count int,
  attestation_count_30d int,
  avg_weight numeric,
  tier text,
  sybil_risk text,
  uptime_score numeric,
  registered_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stakes_agg AS (
    SELECT 
      vs.did_id,
      COALESCE(SUM(vs.amount), 0) AS total_stake,
      COUNT(DISTINCT vs.user_id)::int AS staker_count
    FROM validator_stakes vs
    WHERE vs.status = 'active'
    GROUP BY vs.did_id
  ),
  attest_agg AS (
    SELECT
      al.from_did AS did_id,
      COUNT(*)::int AS attestation_count_30d,
      AVG(al.weight)::numeric AS avg_weight,
      COUNT(DISTINCT date_trunc('day', al.created_at))::int AS active_days
    FROM attestation_log al
    WHERE al.created_at >= now() - interval '30 days'
      AND al.status = 'active'
    GROUP BY al.from_did
  )
  SELECT
    op.did_id,
    op.display_name,
    op.slug,
    op.logo_url,
    op.category,
    op.is_verified,
    op.description,
    COALESCE(sa.total_stake, 0) AS total_stake,
    COALESCE(sa.staker_count, 0) AS staker_count,
    COALESCE(aa.attestation_count_30d, 0) AS attestation_count_30d,
    COALESCE(aa.avg_weight, 0) AS avg_weight,
    COALESCE(tp.trust_tier, 'T0') AS tier,
    COALESCE(tp.sybil_risk, 'low') AS sybil_risk,
    ROUND(COALESCE(aa.active_days, 0) / 30.0 * 100, 1) AS uptime_score,
    op.created_at AS registered_at
  FROM org_profiles op
  LEFT JOIN stakes_agg sa ON sa.did_id = op.did_id
  LEFT JOIN attest_agg aa ON aa.did_id = op.did_id
  LEFT JOIN trust_profile tp ON tp.did_id = op.did_id
  WHERE EXISTS (SELECT 1 FROM validator_stakes vs2 WHERE vs2.did_id = op.did_id AND vs2.status = 'active')
    AND (_category IS NULL OR op.category = _category)
    AND (_search IS NULL OR _search = '' OR op.display_name ILIKE '%'||_search||'%' OR op.slug ILIKE '%'||_search||'%')
  ORDER BY
    CASE WHEN _sort = 'top_stake' THEN COALESCE(sa.total_stake, 0) END DESC NULLS LAST,
    CASE WHEN _sort = 'most_active' THEN COALESCE(aa.attestation_count_30d, 0) END DESC NULLS LAST,
    CASE WHEN _sort = 'best_uptime' THEN COALESCE(aa.active_days, 0) END DESC NULLS LAST,
    CASE WHEN _sort = 'newest' THEN op.created_at END DESC NULLS LAST,
    op.created_at DESC
  LIMIT _limit OFFSET _offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_validator_marketplace_list(text, text, text, int, int) TO authenticated, anon;

-- 2. My validator portfolio (stakes I made + claim history)
CREATE OR REPLACE FUNCTION public.get_my_validator_portfolio()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _stakes jsonb;
  _total_active numeric;
  _total_unstaking numeric;
  _claimable numeric;
  _lifetime_claimed numeric;
  _validator_count int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'stake_id', vs.id,
    'did_id', vs.did_id,
    'validator_name', op.display_name,
    'validator_slug', op.slug,
    'validator_logo', op.logo_url,
    'amount', vs.amount,
    'status', vs.status,
    'locked_until', vs.locked_until,
    'is_unlockable', (vs.locked_until <= now() AND vs.status = 'active'),
    'created_at', vs.created_at
  ) ORDER BY vs.created_at DESC)
  INTO _stakes
  FROM validator_stakes vs
  LEFT JOIN org_profiles op ON op.did_id = vs.did_id
  WHERE vs.user_id = _uid AND vs.status IN ('active', 'unstaking');

  SELECT COALESCE(SUM(amount), 0) INTO _total_active
  FROM validator_stakes WHERE user_id = _uid AND status = 'active';

  SELECT COALESCE(SUM(amount), 0) INTO _total_unstaking
  FROM validator_stakes WHERE user_id = _uid AND status = 'unstaking';

  SELECT COUNT(DISTINCT did_id)::int INTO _validator_count
  FROM validator_stakes WHERE user_id = _uid AND status = 'active';

  -- Claimable rewards (if user is themselves a validator)
  SELECT COALESCE(SUM(amount), 0) INTO _claimable
  FROM validator_rewards vr
  JOIN user_dids ud ON ud.id = vr.did_id
  WHERE ud.user_id = _uid AND vr.status = 'pending';

  SELECT COALESCE(SUM(amount), 0) INTO _lifetime_claimed
  FROM validator_rewards vr
  JOIN user_dids ud ON ud.id = vr.did_id
  WHERE ud.user_id = _uid AND vr.status = 'claimed';

  RETURN jsonb_build_object(
    'stakes', COALESCE(_stakes, '[]'::jsonb),
    'total_active', _total_active,
    'total_unstaking', _total_unstaking,
    'validator_count', _validator_count,
    'claimable_rewards', _claimable,
    'lifetime_claimed', _lifetime_claimed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_validator_portfolio() TO authenticated;

-- 3. Validator detail extended: top stakers + recent attestations + uptime 30d
CREATE OR REPLACE FUNCTION public.get_validator_detail_extended(_did_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _top_stakers jsonb;
  _recent_attestations jsonb;
  _uptime_buckets jsonb;
  _reward_30d numeric;
BEGIN
  -- Top 10 stakers
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', vs.user_id,
    'amount', vs.amount,
    'locked_until', vs.locked_until,
    'created_at', vs.created_at,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url
  ) ORDER BY vs.amount DESC)
  INTO _top_stakers
  FROM (
    SELECT user_id, SUM(amount) AS amount, MIN(locked_until) AS locked_until, MIN(created_at) AS created_at
    FROM validator_stakes
    WHERE did_id = _did_id AND status = 'active'
    GROUP BY user_id
    ORDER BY SUM(amount) DESC
    LIMIT 10
  ) vs
  LEFT JOIN profiles p ON p.user_id = vs.user_id;

  -- Recent 10 attestations
  SELECT jsonb_agg(jsonb_build_object(
    'id', al.id,
    'to_did', al.to_did,
    'attestation_type', al.attestation_type,
    'weight', al.weight,
    'created_at', al.created_at
  ) ORDER BY al.created_at DESC)
  INTO _recent_attestations
  FROM (
    SELECT id, to_did, attestation_type, weight, created_at
    FROM attestation_log
    WHERE from_did = _did_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 10
  ) al;

  -- 30d uptime buckets (1 row per day)
  SELECT jsonb_agg(jsonb_build_object(
    'day', d::date,
    'count', COALESCE(c.cnt, 0)
  ) ORDER BY d)
  INTO _uptime_buckets
  FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
  LEFT JOIN (
    SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::int AS cnt
    FROM attestation_log
    WHERE from_did = _did_id AND status = 'active'
      AND created_at >= now() - interval '30 days'
    GROUP BY 1
  ) c ON c.day = d::date;

  -- 30d reward distributed
  SELECT COALESCE(SUM(amount), 0) INTO _reward_30d
  FROM validator_rewards
  WHERE did_id = _did_id AND created_at >= now() - interval '30 days';

  RETURN jsonb_build_object(
    'top_stakers', COALESCE(_top_stakers, '[]'::jsonb),
    'recent_attestations', COALESCE(_recent_attestations, '[]'::jsonb),
    'uptime_buckets', COALESCE(_uptime_buckets, '[]'::jsonb),
    'reward_30d', _reward_30d
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_validator_detail_extended(uuid) TO authenticated, anon;