
-- Slash proposals table
CREATE TABLE IF NOT EXISTS public.slash_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id UUID NOT NULL REFERENCES public.validator_stakes(id) ON DELETE CASCADE,
  did_id UUID NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  detection_type TEXT NOT NULL, -- 'abuse_flags', 'reciprocal_loop', 'attestation_burst', 'sybil_cluster', 'manual'
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  suggested_slash_pct NUMERIC NOT NULL DEFAULT 0.25 CHECK (suggested_slash_pct > 0 AND suggested_slash_pct <= 1),
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  review_notes TEXT,
  applied_slash_pct NUMERIC,
  slashed_amount NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slash_proposals_status ON public.slash_proposals(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_slash_proposals_did ON public.slash_proposals(did_id);
CREATE INDEX IF NOT EXISTS idx_slash_proposals_stake ON public.slash_proposals(stake_id);

ALTER TABLE public.slash_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage slash proposals"
  ON public.slash_proposals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own slash proposals"
  ON public.slash_proposals FOR SELECT
  USING (auth.uid() = user_id);

-- Detection function: returns suspicious validator stakes with evidence
CREATE OR REPLACE FUNCTION public.detect_slash_candidates(_limit INT DEFAULT 50)
RETURNS TABLE(
  stake_id UUID,
  did_id UUID,
  user_id UUID,
  did TEXT,
  display_name TEXT,
  stake_amount NUMERIC,
  detection_type TEXT,
  severity TEXT,
  suggested_slash_pct NUMERIC,
  reason TEXT,
  evidence JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH active_stakes AS (
    SELECT vs.id AS stake_id, vs.did_id, vs.user_id, vs.amount,
           ud.did, COALESCE(op.display_name, 'Unknown') AS display_name
    FROM validator_stakes vs
    JOIN user_dids ud ON ud.id = vs.did_id
    LEFT JOIN org_profiles op ON op.did_id = vs.did_id
    WHERE vs.status = 'active'
  ),
  -- Pattern 1: many open abuse flags
  abuse_pattern AS (
    SELECT s.stake_id, s.did_id, s.user_id, s.did, s.display_name, s.amount,
           COUNT(af.id) AS open_flags,
           MAX(af.severity) AS max_severity
    FROM active_stakes s
    JOIN attestation_abuse_flags af ON af.did_id = s.did_id AND af.is_resolved = false
    GROUP BY s.stake_id, s.did_id, s.user_id, s.did, s.display_name, s.amount
    HAVING COUNT(af.id) >= 3
  ),
  -- Pattern 2: reciprocal loops A->B->A in last 14 days
  reciprocal_pattern AS (
    SELECT s.stake_id, s.did_id, s.user_id, s.did, s.display_name, s.amount,
           COUNT(*) AS reciprocal_count
    FROM active_stakes s
    JOIN attestation_log a1 ON a1.from_did = s.did_id
      AND a1.created_at > now() - interval '14 days'
      AND a1.status = 'active'
    JOIN attestation_log a2 ON a2.from_did = a1.to_did AND a2.to_did = a1.from_did
      AND a2.created_at > now() - interval '14 days'
      AND a2.status = 'active'
    GROUP BY s.stake_id, s.did_id, s.user_id, s.did, s.display_name, s.amount
    HAVING COUNT(*) >= 5
  ),
  -- Pattern 3: attestation burst (many attestations in short window)
  burst_pattern AS (
    SELECT s.stake_id, s.did_id, s.user_id, s.did, s.display_name, s.amount,
           MAX(hourly_count) AS max_hour
    FROM active_stakes s
    JOIN (
      SELECT from_did, date_trunc('hour', created_at) AS h, COUNT(*) AS hourly_count
      FROM attestation_log
      WHERE created_at > now() - interval '7 days' AND status = 'active'
      GROUP BY from_did, date_trunc('hour', created_at)
    ) ag ON ag.from_did = s.did_id
    GROUP BY s.stake_id, s.did_id, s.user_id, s.did, s.display_name, s.amount
    HAVING MAX(hourly_count) >= 20
  )
  -- Combine all patterns, prefer most severe
  SELECT * FROM (
    SELECT ap.stake_id, ap.did_id, ap.user_id, ap.did, ap.display_name, ap.amount AS stake_amount,
           'abuse_flags'::TEXT AS detection_type,
           CASE WHEN ap.open_flags >= 7 OR ap.max_severity >= 4 THEN 'critical'
                WHEN ap.open_flags >= 5 THEN 'high'
                ELSE 'medium' END AS severity,
           CASE WHEN ap.open_flags >= 7 THEN 0.75
                WHEN ap.open_flags >= 5 THEN 0.50
                ELSE 0.25 END AS suggested_slash_pct,
           format('%s cảnh báo lạm dụng chưa giải quyết (severity tối đa %s)', ap.open_flags, ap.max_severity) AS reason,
           jsonb_build_object('open_flags', ap.open_flags, 'max_severity', ap.max_severity) AS evidence
    FROM abuse_pattern ap
    UNION ALL
    SELECT rp.stake_id, rp.did_id, rp.user_id, rp.did, rp.display_name, rp.amount,
           'reciprocal_loop',
           CASE WHEN rp.reciprocal_count >= 15 THEN 'critical'
                WHEN rp.reciprocal_count >= 10 THEN 'high'
                ELSE 'medium' END,
           CASE WHEN rp.reciprocal_count >= 15 THEN 0.60
                WHEN rp.reciprocal_count >= 10 THEN 0.40
                ELSE 0.25 END,
           format('%s cặp chứng thực qua lại (A↔B) trong 14 ngày', rp.reciprocal_count),
           jsonb_build_object('reciprocal_pairs', rp.reciprocal_count, 'window_days', 14)
    FROM reciprocal_pattern rp
    UNION ALL
    SELECT bp.stake_id, bp.did_id, bp.user_id, bp.did, bp.display_name, bp.amount,
           'attestation_burst',
           CASE WHEN bp.max_hour >= 50 THEN 'critical'
                WHEN bp.max_hour >= 30 THEN 'high'
                ELSE 'medium' END,
           CASE WHEN bp.max_hour >= 50 THEN 0.50
                WHEN bp.max_hour >= 30 THEN 0.30
                ELSE 0.20 END,
           format('Bùng phát chứng thực: %s/giờ trong 7 ngày qua', bp.max_hour),
           jsonb_build_object('max_per_hour', bp.max_hour, 'window_days', 7)
    FROM burst_pattern bp
  ) combined
  ORDER BY
    CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
    suggested_slash_pct DESC
  LIMIT _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_slash_candidates(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_slash_candidates(INT) TO authenticated;

-- Auto-create proposals from detection (admin only)
CREATE OR REPLACE FUNCTION public.propose_auto_slash(_limit INT DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_created INT := 0;
  v_skipped INT := 0;
  rec RECORD;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin only');
  END IF;

  FOR rec IN SELECT * FROM public.detect_slash_candidates(_limit) LOOP
    -- skip if pending proposal already exists for this stake + detection_type
    IF EXISTS (
      SELECT 1 FROM public.slash_proposals
      WHERE stake_id = rec.stake_id
        AND detection_type = rec.detection_type
        AND status = 'pending'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.slash_proposals(
      stake_id, did_id, user_id, detection_type, severity,
      suggested_slash_pct, reason, evidence, status
    ) VALUES (
      rec.stake_id, rec.did_id, rec.user_id, rec.detection_type, rec.severity,
      rec.suggested_slash_pct, rec.reason, rec.evidence, 'pending'
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'created', v_created, 'skipped', v_skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.propose_auto_slash(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_auto_slash(INT) TO authenticated;

-- Approve proposal: invokes slash logic
CREATE OR REPLACE FUNCTION public.approve_slash_proposal(
  _proposal_id UUID,
  _override_pct NUMERIC DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_prop RECORD;
  v_pct NUMERIC;
  v_slash_result JSONB;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin only');
  END IF;

  SELECT * INTO v_prop FROM public.slash_proposals WHERE id = _proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'proposal not found');
  END IF;
  IF v_prop.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'proposal not pending');
  END IF;

  v_pct := COALESCE(_override_pct, v_prop.suggested_slash_pct);
  IF v_pct <= 0 OR v_pct > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid slash pct');
  END IF;

  -- Call existing slash_validator
  SELECT public.slash_validator(v_prop.stake_id, v_prop.reason || ' [auto-detected: ' || v_prop.detection_type || ']', v_pct) INTO v_slash_result;

  IF (v_slash_result->>'success')::BOOLEAN IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', v_slash_result->>'error');
  END IF;

  UPDATE public.slash_proposals
  SET status = 'approved',
      reviewed_at = now(),
      reviewed_by = v_caller,
      review_notes = _notes,
      applied_slash_pct = v_pct,
      slashed_amount = (v_slash_result->>'slashed_amount')::NUMERIC
  WHERE id = _proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'slashed_amount', v_slash_result->>'slashed_amount',
    'applied_pct', v_pct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_slash_proposal(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_slash_proposal(UUID, NUMERIC, TEXT) TO authenticated;

-- Reject proposal
CREATE OR REPLACE FUNCTION public.reject_slash_proposal(
  _proposal_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin only');
  END IF;

  UPDATE public.slash_proposals
  SET status = 'rejected',
      reviewed_at = now(),
      reviewed_by = v_caller,
      review_notes = _notes
  WHERE id = _proposal_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'proposal not found or not pending');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_slash_proposal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_slash_proposal(UUID, TEXT) TO authenticated;
