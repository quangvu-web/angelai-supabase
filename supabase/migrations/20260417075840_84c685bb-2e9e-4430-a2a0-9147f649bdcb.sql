-- ===== Trust Admin Console RPCs =====

-- 1) Freeze SBT
CREATE OR REPLACE FUNCTION public.admin_freeze_sbt(_token_id text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row sbt_registry%ROWTYPE;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  SELECT * INTO _row FROM sbt_registry WHERE token_id = _token_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sbt not found'; END IF;
  UPDATE sbt_registry
    SET status = 'frozen', updated_at = now(),
        metadata = metadata || jsonb_build_object('frozen_reason', _reason, 'frozen_by', auth.uid(), 'frozen_at', now())
    WHERE token_id = _token_id;
  INSERT INTO identity_recovery_log(did_id, user_id, recovery_type, status, metadata)
    VALUES (_row.did_id, _row.user_id, 'governance', 'completed',
            jsonb_build_object('event_type','admin_sbt_action','action','freeze','token_id',_token_id,'reason',_reason,'admin_id',auth.uid()));
  RETURN jsonb_build_object('ok', true, 'token_id', _token_id, 'status', 'frozen');
END$$;

-- 2) Revoke SBT
CREATE OR REPLACE FUNCTION public.admin_revoke_sbt(_token_id text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row sbt_registry%ROWTYPE;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  SELECT * INTO _row FROM sbt_registry WHERE token_id = _token_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sbt not found'; END IF;
  UPDATE sbt_registry
    SET status = 'revoked', trust_weight = 0, revoked_at = now(),
        revocation_reason = _reason, updated_at = now(),
        metadata = metadata || jsonb_build_object('revoked_by', auth.uid())
    WHERE token_id = _token_id;
  INSERT INTO identity_recovery_log(did_id, user_id, recovery_type, status, metadata)
    VALUES (_row.did_id, _row.user_id, 'governance', 'completed',
            jsonb_build_object('event_type','admin_sbt_action','action','revoke','token_id',_token_id,'reason',_reason,'admin_id',auth.uid()));
  RETURN jsonb_build_object('ok', true, 'token_id', _token_id, 'status', 'revoked');
END$$;

-- 3) Extend SBT expiry
CREATE OR REPLACE FUNCTION public.admin_extend_sbt(_token_id text, _new_expiry timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row sbt_registry%ROWTYPE;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  IF _new_expiry IS NOT NULL AND _new_expiry < now() THEN
    RAISE EXCEPTION 'new expiry must be in the future';
  END IF;
  SELECT * INTO _row FROM sbt_registry WHERE token_id = _token_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sbt not found'; END IF;
  UPDATE sbt_registry
    SET expires_at = _new_expiry, updated_at = now(),
        metadata = metadata || jsonb_build_object('expiry_extended_by', auth.uid(), 'expiry_extended_at', now())
    WHERE token_id = _token_id;
  INSERT INTO identity_recovery_log(did_id, user_id, recovery_type, status, metadata)
    VALUES (_row.did_id, _row.user_id, 'governance', 'completed',
            jsonb_build_object('event_type','admin_sbt_action','action','extend','token_id',_token_id,'new_expiry',_new_expiry,'admin_id',auth.uid()));
  RETURN jsonb_build_object('ok', true, 'token_id', _token_id, 'expires_at', _new_expiry);
END$$;

-- 4) Admin override: approve/reject recovery_request
CREATE OR REPLACE FUNCTION public.admin_resolve_recovery(_request_id uuid, _decision text, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _row recovery_requests%ROWTYPE;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  IF _decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'decision must be approve or reject';
  END IF;
  SELECT * INTO _row FROM recovery_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF _row.status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'request not actionable (status=%)', _row.status;
  END IF;
  UPDATE recovery_requests
    SET status = CASE WHEN _decision='approve' THEN 'approved' ELSE 'rejected' END,
        approved_at = CASE WHEN _decision='approve' THEN now() ELSE approved_at END,
        reason = COALESCE(_reason, reason),
        updated_at = now()
    WHERE id = _request_id;
  INSERT INTO identity_recovery_log(did_id, user_id, recovery_type, status, metadata)
    SELECT (SELECT id FROM user_dids WHERE user_id = _row.user_id LIMIT 1),
           _row.user_id, 'governance',
           CASE WHEN _decision='approve' THEN 'approved' ELSE 'rejected' END,
           jsonb_build_object('event_type','admin_recovery_override','request_id',_request_id,'decision',_decision,'reason',_reason,'admin_id',auth.uid());
  RETURN jsonb_build_object('ok', true, 'request_id', _request_id, 'decision', _decision);
END$$;

-- 5) Aggregated stats for admin dashboard
CREATE OR REPLACE FUNCTION public.get_trust_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tier_dist jsonb;
  _sybil_dist jsonb;
  _trend jsonb;
  _sbt_stats jsonb;
  _recovery_pending int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT jsonb_object_agg(trust_tier, c) INTO _tier_dist
  FROM (SELECT trust_tier, count(*)::int c FROM trust_profile GROUP BY trust_tier) t;

  SELECT jsonb_object_agg(sybil_risk, c) INTO _sybil_dist
  FROM (SELECT sybil_risk, count(*)::int c FROM trust_profile GROUP BY sybil_risk) t;

  SELECT jsonb_agg(jsonb_build_object('day', day, 'avg_tc', avg_tc) ORDER BY day) INTO _trend
  FROM (
    SELECT date_trunc('day', created_at)::date AS day,
           round(avg(tc)::numeric, 4) AS avg_tc
    FROM trust_history
    WHERE created_at >= now() - interval '30 days'
    GROUP BY 1
  ) t;

  SELECT jsonb_object_agg(status, c) INTO _sbt_stats
  FROM (SELECT status, count(*)::int c FROM sbt_registry GROUP BY status) t;

  SELECT count(*)::int INTO _recovery_pending FROM recovery_requests WHERE status = 'pending';

  RETURN jsonb_build_object(
    'tier_distribution', COALESCE(_tier_dist, '{}'::jsonb),
    'sybil_distribution', COALESCE(_sybil_dist, '{}'::jsonb),
    'tc_trend_30d', COALESCE(_trend, '[]'::jsonb),
    'sbt_status', COALESCE(_sbt_stats, '{}'::jsonb),
    'recovery_pending', _recovery_pending,
    'computed_at', now()
  );
END$$;

-- 6) Admin SBT list with filters
CREATE OR REPLACE FUNCTION public.admin_list_sbts(
  _sbt_type text DEFAULT NULL,
  _status text DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit int DEFAULT 100
)
RETURNS TABLE(
  token_id text, did text, user_id uuid, sbt_type text, sbt_subtype text,
  status text, trust_weight numeric, issuer text, issued_at timestamptz, expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  RETURN QUERY
  SELECT s.token_id, d.did, s.user_id, s.sbt_type, s.sbt_subtype,
         s.status, s.trust_weight, s.issuer, s.issued_at, s.expires_at
  FROM sbt_registry s
  JOIN user_dids d ON d.id = s.did_id
  WHERE (_sbt_type IS NULL OR s.sbt_type = _sbt_type)
    AND (_status IS NULL OR s.status = _status)
    AND (_search IS NULL OR d.did ILIKE '%'||_search||'%' OR s.token_id ILIKE '%'||_search||'%')
  ORDER BY s.issued_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END$$;

GRANT EXECUTE ON FUNCTION public.admin_freeze_sbt(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_sbt(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_sbt(text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_recovery(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trust_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_sbts(text, text, text, int) TO authenticated;