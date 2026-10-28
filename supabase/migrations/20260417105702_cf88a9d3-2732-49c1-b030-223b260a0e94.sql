
-- ============================================================
-- SBT On-chain Queue Helper Functions (Phase 5 — P)
-- ============================================================

-- 1. Enqueue an SBT for on-chain minting (user-facing)
CREATE OR REPLACE FUNCTION public.enqueue_sbt_mint(
  _sbt_id uuid,
  _wallet_address text,
  _network text DEFAULT 'bsc-testnet',
  _metadata_uri text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sbt RECORD;
  v_existing uuid;
  v_queue_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT id, did_id, user_id, status INTO v_sbt
  FROM public.sbt_registry WHERE id = _sbt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'sbt_not_found');
  END IF;

  IF v_sbt.user_id <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owner');
  END IF;

  IF v_sbt.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'sbt_not_active');
  END IF;

  -- prevent duplicate active queue entries
  SELECT id INTO v_existing FROM public.sbt_onchain_queue
  WHERE sbt_id = _sbt_id AND status IN ('pending','processing','minted')
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_queued', 'queue_id', v_existing);
  END IF;

  IF _wallet_address !~ '^0x[a-fA-F0-9]{40}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_wallet');
  END IF;

  INSERT INTO public.sbt_onchain_queue (
    sbt_id, did_id, user_id, network, wallet_address, metadata_uri, status
  ) VALUES (
    _sbt_id, v_sbt.did_id, v_user_id, _network, lower(_wallet_address), _metadata_uri, 'pending'
  ) RETURNING id INTO v_queue_id;

  RETURN jsonb_build_object('success', true, 'queue_id', v_queue_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_sbt_mint(uuid,text,text,text) TO authenticated;

-- 2. Claim next pending mint (admin/service only) — uses FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_next_sbt_mint(
  _network text DEFAULT 'bsc-testnet',
  _max_retry int DEFAULT 3
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  WITH next_item AS (
    SELECT id FROM public.sbt_onchain_queue
    WHERE status = 'pending'
      AND network = _network
      AND retry_count < _max_retry
    ORDER BY enqueued_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.sbt_onchain_queue q
  SET status = 'processing',
      processed_at = now()
  FROM next_item ni
  WHERE q.id = ni.id
  RETURNING q.id, q.sbt_id, q.user_id, q.wallet_address, q.network, q.metadata_uri INTO v_item;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'item', null);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'item', jsonb_build_object(
      'id', v_item.id,
      'sbt_id', v_item.sbt_id,
      'user_id', v_item.user_id,
      'wallet_address', v_item.wallet_address,
      'network', v_item.network,
      'metadata_uri', v_item.metadata_uri
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_next_sbt_mint(text,int) TO authenticated, service_role;

-- 3. Mark minted (admin/service)
CREATE OR REPLACE FUNCTION public.mark_sbt_minted(
  _queue_id uuid,
  _tx_hash text,
  _block_number bigint,
  _on_chain_token_id text,
  _contract_address text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.sbt_onchain_queue
  SET status = 'minted',
      tx_hash = _tx_hash,
      block_number = _block_number,
      on_chain_token_id = _on_chain_token_id,
      contract_address = _contract_address,
      minted_at = now(),
      error_message = NULL
  WHERE id = _queue_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_sbt_minted(uuid,text,bigint,text,text) TO authenticated, service_role;

-- 4. Mark failed (admin/service)
CREATE OR REPLACE FUNCTION public.mark_sbt_failed(
  _queue_id uuid,
  _error_message text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  UPDATE public.sbt_onchain_queue
  SET status = CASE WHEN retry_count + 1 >= 3 THEN 'failed' ELSE 'pending' END,
      retry_count = retry_count + 1,
      error_message = left(coalesce(_error_message, 'unknown'), 500),
      processed_at = now()
  WHERE id = _queue_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_sbt_failed(uuid,text) TO authenticated, service_role;

-- 5. Stats
CREATE OR REPLACE FUNCTION public.get_sbt_mint_queue_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pending',    count(*) FILTER (WHERE status='pending'),
    'processing', count(*) FILTER (WHERE status='processing'),
    'minted',     count(*) FILTER (WHERE status='minted'),
    'failed',     count(*) FILTER (WHERE status='failed'),
    'cancelled',  count(*) FILTER (WHERE status='cancelled'),
    'total',      count(*)
  )
  FROM public.sbt_onchain_queue;
$$;

GRANT EXECUTE ON FUNCTION public.get_sbt_mint_queue_stats() TO authenticated;
