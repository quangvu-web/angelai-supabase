-- ============================================
-- PHASE 1: Mint Stuck Panel & Pipeline Health
-- ============================================

-- 1. Audit log table
CREATE TABLE IF NOT EXISTS public.pplp_mint_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('nudge','cancel','force_expire','auto_expire')),
  actor_id UUID,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pplp_mint_audit_request ON public.pplp_mint_audit(request_id);
CREATE INDEX IF NOT EXISTS idx_pplp_mint_audit_created ON public.pplp_mint_audit(created_at DESC);

ALTER TABLE public.pplp_mint_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read mint audit" ON public.pplp_mint_audit;
CREATE POLICY "Admins can read mint audit"
  ON public.pplp_mint_audit FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert mint audit" ON public.pplp_mint_audit;
CREATE POLICY "Admins can insert mint audit"
  ON public.pplp_mint_audit FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. RPC: cancel_mint_request_safe
CREATE OR REPLACE FUNCTION public.cancel_mint_request_safe(
  p_request_id UUID,
  p_reason TEXT DEFAULT 'Admin cancelled stuck request'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_caller UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT * INTO v_request
  FROM public.pplp_mint_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mint request not found: %', p_request_id;
  END IF;

  IF v_request.status NOT IN ('pending_sig','pending','approved','signed') THEN
    RAISE EXCEPTION 'Cannot cancel request in status: %', v_request.status;
  END IF;

  -- Cancel the request
  UPDATE public.pplp_mint_requests
  SET status = 'cancelled',
      updated_at = now(),
      on_chain_error = COALESCE(on_chain_error,'') || E'\n[ADMIN CANCEL] ' || p_reason
  WHERE id = p_request_id;

  -- Reset allocation linked to this action (so user can re-claim)
  UPDATE public.pplp_mint_allocations
  SET status = 'pending',
      updated_at = now(),
      ineligibility_reason = NULL
  WHERE user_id = v_request.actor_id
    AND status IN ('claimed','minting','minted')
    AND fun_allocated = v_request.amount;

  -- Reset action status so user can retry
  UPDATE public.pplp_actions
  SET status = 'scored',
      mint_request_hash = NULL
  WHERE id = v_request.action_id
    AND status IN ('mint_pending','minting');

  -- Audit log
  INSERT INTO public.pplp_mint_audit(request_id, action, actor_id, reason, metadata)
  VALUES (p_request_id, 'cancel', v_caller, p_reason, jsonb_build_object(
    'amount', v_request.amount,
    'actor_id', v_request.actor_id,
    'previous_status', v_request.status
  ));

  RETURN jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'amount_refunded', v_request.amount,
    'actor_id', v_request.actor_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_mint_request_safe(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_mint_request_safe(UUID, TEXT) TO authenticated;

-- 3. RPC: notify_attesters
CREATE OR REPLACE FUNCTION public.notify_attesters(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_caller UUID := auth.uid();
  v_attester_addresses TEXT[] := ARRAY[
    '0xe32d50a0badE4cbD5B0d6120d3A5FD07f63694f1',
    '0xfd0Da7a744245e7aCECCd786d5a743Ef9291a557',
    '0x02D5578173bd0DB25462BB32A254Cd4b2E6D9a0D',
    '0xCa319fBc39F519822385F2D0a0114B14fa89A301',
    '0xDf8249159BB67804D718bc8186f95B75CE5ECbe8',
    '0x5102Ecc4a458a1af76aFA50d23359a712658a402',
    '0xE418a560611e80E4239F5513D41e583fC9AC2E6d',
    '0x67464Df3082828b3Cf10C5Cb08FC24A28228EFd1',
    '0x9ec8C51175526BEbB1D04100256De71CF99B7CCC'
  ];
  v_user_ids UUID[];
  v_uid UUID;
  v_count INT := 0;
  v_age_hours NUMERIC;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT * INTO v_request
  FROM public.pplp_mint_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mint request not found: %', p_request_id;
  END IF;

  v_age_hours := EXTRACT(EPOCH FROM (now() - v_request.created_at))/3600;

  -- Find user_ids of attester wallets via web3_wallet_links (lowercase)
  SELECT ARRAY_AGG(DISTINCT user_id)
  INTO v_user_ids
  FROM public.web3_wallet_links
  WHERE LOWER(wallet_address) = ANY (
    SELECT LOWER(unnest(v_attester_addresses))
  );

  IF v_user_ids IS NULL THEN
    v_user_ids := ARRAY[]::UUID[];
  END IF;

  FOREACH v_uid IN ARRAY v_user_ids LOOP
    INSERT INTO public.notifications(user_id, type, title, content, reference_id, reference_type, metadata)
    VALUES (
      v_uid,
      'attester_nudge',
      '🔔 Mint request đang chờ ký',
      'Một yêu cầu mint ' || v_request.amount || ' FUN đã chờ ' || ROUND(v_age_hours,1) || ' giờ. Vui lòng truy cập Attester Panel để ký.',
      p_request_id::text,
      'mint_request',
      jsonb_build_object(
        'request_id', p_request_id,
        'amount', v_request.amount,
        'age_hours', v_age_hours,
        'deep_link', '/admin/mint-approval'
      )
    );
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO public.pplp_mint_audit(request_id, action, actor_id, reason, metadata)
  VALUES (p_request_id, 'nudge', v_caller, 'Admin nudged attesters', jsonb_build_object(
    'notified_count', v_count
  ));

  RETURN jsonb_build_object(
    'success', true,
    'notified_count', v_count,
    'request_id', p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_attesters(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notify_attesters(UUID) TO authenticated;

-- 4. RPC: get_mint_pipeline_health
CREATE OR REPLACE FUNCTION public.get_mint_pipeline_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_pending_24h INT;
  v_pending_total INT;
  v_total_stuck_fun BIGINT;
  v_oldest_age_hours NUMERIC;
  v_scored_no_mint INT;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE created_at < now() - INTERVAL '24 hours'),
    COUNT(*),
    COALESCE(SUM(amount), 0),
    COALESCE(EXTRACT(EPOCH FROM (now() - MIN(created_at)))/3600, 0)
  INTO v_pending_24h, v_pending_total, v_total_stuck_fun, v_oldest_age_hours
  FROM public.pplp_mint_requests
  WHERE status = 'pending_sig';

  SELECT COUNT(*) INTO v_scored_no_mint
  FROM public.pplp_actions a
  WHERE a.status = 'scored'
    AND NOT EXISTS (
      SELECT 1 FROM public.pplp_mint_requests r WHERE r.action_id = a.id
    );

  RETURN jsonb_build_object(
    'pending_sig_total', v_pending_total,
    'pending_sig_over_24h', v_pending_24h,
    'total_stuck_fun', v_total_stuck_fun,
    'oldest_age_hours', ROUND(v_oldest_age_hours, 1),
    'scored_no_mint_backlog', v_scored_no_mint,
    'is_critical', (v_pending_total > 5 OR v_oldest_age_hours > 48)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_mint_pipeline_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_mint_pipeline_health() TO authenticated;