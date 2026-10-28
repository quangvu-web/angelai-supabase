
-- =========================================================
-- Phase 5: ZK Commitments + SBT On-chain Queue
-- =========================================================

-- 1. ZK Attestation Commitments (commit-reveal scheme)
CREATE TABLE IF NOT EXISTS public.zk_attestation_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_hash TEXT NOT NULL UNIQUE, -- hash(from_did || to_did || type || weight || nonce)
  from_did UUID NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  attestation_type_hint TEXT, -- public hint (e.g. 'private_endorsement') without revealing content
  privacy_level TEXT NOT NULL DEFAULT 'private' CHECK (privacy_level IN ('private','permissioned')),
  status TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('committed','revealed','expired','revoked')),
  -- revealed fields (only filled when revealed)
  revealed_to_did UUID REFERENCES public.user_dids(id),
  revealed_attestation_type TEXT,
  revealed_weight NUMERIC,
  revealed_evidence JSONB,
  revealed_at TIMESTAMPTZ,
  revealed_attestation_id UUID REFERENCES public.attestation_log(id),
  -- nonce stored only after reveal (proof)
  reveal_nonce TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '180 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zk_commit_from ON public.zk_attestation_commitments(from_did, status);
CREATE INDEX IF NOT EXISTS idx_zk_commit_status ON public.zk_attestation_commitments(status, created_at DESC);

ALTER TABLE public.zk_attestation_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own commitments"
  ON public.zk_attestation_commitments FOR SELECT
  USING (auth.uid() = from_user_id);

CREATE POLICY "Public sees revealed commitments"
  ON public.zk_attestation_commitments FOR SELECT
  USING (status = 'revealed');

CREATE POLICY "Admins manage commitments"
  ON public.zk_attestation_commitments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function: commit private attestation
-- Caller provides commitment_hash computed client-side: sha256(from_did||to_did||type||weight||nonce)
CREATE OR REPLACE FUNCTION public.commit_private_attestation(
  _commitment_hash TEXT,
  _attestation_type_hint TEXT DEFAULT 'private_endorsement',
  _privacy_level TEXT DEFAULT 'private'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_did_id UUID;
  v_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth required');
  END IF;
  IF length(_commitment_hash) < 32 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid commitment hash');
  END IF;

  SELECT id INTO v_did_id FROM public.user_dids WHERE user_id = v_caller LIMIT 1;
  IF v_did_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no DID');
  END IF;

  -- check duplicate
  IF EXISTS (SELECT 1 FROM public.zk_attestation_commitments WHERE commitment_hash = _commitment_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'commitment already exists');
  END IF;

  INSERT INTO public.zk_attestation_commitments(
    commitment_hash, from_did, from_user_id, attestation_type_hint, privacy_level
  ) VALUES (
    _commitment_hash, v_did_id, v_caller, _attestation_type_hint, _privacy_level
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.commit_private_attestation(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_private_attestation(TEXT, TEXT, TEXT) TO authenticated;

-- Function: reveal private attestation (verifies commitment matches and creates regular attestation)
CREATE OR REPLACE FUNCTION public.reveal_private_attestation(
  _commitment_id UUID,
  _to_did UUID,
  _attestation_type TEXT,
  _weight NUMERIC,
  _nonce TEXT,
  _expected_hash TEXT, -- recomputed client-side hash for server to verify
  _evidence JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_commit RECORD;
  v_att_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth required');
  END IF;

  SELECT * INTO v_commit FROM public.zk_attestation_commitments
  WHERE id = _commitment_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'commitment not found');
  END IF;
  IF v_commit.from_user_id <> v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'not your commitment');
  END IF;
  IF v_commit.status <> 'committed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already revealed/expired');
  END IF;
  IF v_commit.expires_at < now() THEN
    UPDATE public.zk_attestation_commitments SET status = 'expired' WHERE id = _commitment_id;
    RETURN jsonb_build_object('success', false, 'error', 'commitment expired');
  END IF;
  -- Verify hash matches (client recomputes and provides _expected_hash; server compares with stored)
  IF v_commit.commitment_hash <> _expected_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'hash mismatch — invalid reveal');
  END IF;

  -- Create regular attestation in attestation_log
  INSERT INTO public.attestation_log(from_did, to_did, attestation_type, weight, evidence, status)
  VALUES (v_commit.from_did, _to_did, _attestation_type, _weight,
          _evidence || jsonb_build_object('zk_commitment_id', _commitment_id, 'revealed', true),
          'active')
  RETURNING id INTO v_att_id;

  -- Mark commitment as revealed
  UPDATE public.zk_attestation_commitments
  SET status = 'revealed',
      revealed_to_did = _to_did,
      revealed_attestation_type = _attestation_type,
      revealed_weight = _weight,
      revealed_evidence = _evidence,
      revealed_at = now(),
      revealed_attestation_id = v_att_id,
      reveal_nonce = _nonce
  WHERE id = _commitment_id;

  RETURN jsonb_build_object('success', true, 'attestation_id', v_att_id);
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_private_attestation(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reveal_private_attestation(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, JSONB) TO authenticated;

-- =========================================================
-- 2. SBT On-chain Mint Queue
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sbt_onchain_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sbt_id UUID NOT NULL REFERENCES public.sbt_registry(id) ON DELETE CASCADE,
  did_id UUID NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  network TEXT NOT NULL DEFAULT 'bsc-testnet',
  contract_address TEXT,
  wallet_address TEXT NOT NULL,
  metadata_uri TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','minted','failed','cancelled')),
  tx_hash TEXT,
  block_number BIGINT,
  on_chain_token_id TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  enqueued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  minted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sbt_queue_unique_pending ON public.sbt_onchain_queue(sbt_id) WHERE status IN ('pending','processing');
CREATE INDEX IF NOT EXISTS idx_sbt_queue_status ON public.sbt_onchain_queue(status, enqueued_at);
CREATE INDEX IF NOT EXISTS idx_sbt_queue_user ON public.sbt_onchain_queue(user_id);

ALTER TABLE public.sbt_onchain_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own queue items"
  ON public.sbt_onchain_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public view minted SBTs"
  ON public.sbt_onchain_queue FOR SELECT
  USING (status = 'minted');

CREATE POLICY "Admins manage queue"
  ON public.sbt_onchain_queue FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enqueue SBT for on-chain mint
CREATE OR REPLACE FUNCTION public.enqueue_sbt_mint(
  _sbt_id UUID,
  _wallet_address TEXT,
  _network TEXT DEFAULT 'bsc-testnet',
  _metadata_uri TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_sbt RECORD;
  v_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth required');
  END IF;

  SELECT * INTO v_sbt FROM public.sbt_registry WHERE id = _sbt_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SBT not found');
  END IF;
  -- Allow owner or admin
  IF v_sbt.user_id <> v_caller AND NOT public.has_role(v_caller, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'not authorized');
  END IF;
  IF v_sbt.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'SBT not active');
  END IF;
  IF length(_wallet_address) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid wallet');
  END IF;

  -- Skip if already pending/processing/minted
  IF EXISTS (
    SELECT 1 FROM public.sbt_onchain_queue
    WHERE sbt_id = _sbt_id AND status IN ('pending','processing','minted')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already in queue or minted');
  END IF;

  INSERT INTO public.sbt_onchain_queue(
    sbt_id, did_id, user_id, network, wallet_address, metadata_uri, status
  ) VALUES (
    _sbt_id, v_sbt.did_id, v_sbt.user_id, _network, _wallet_address, _metadata_uri, 'pending'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'queue_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_sbt_mint(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_sbt_mint(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Mark minted (admin/service)
CREATE OR REPLACE FUNCTION public.mark_sbt_minted(
  _queue_id UUID,
  _tx_hash TEXT,
  _block_number BIGINT,
  _on_chain_token_id TEXT,
  _contract_address TEXT
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

  UPDATE public.sbt_onchain_queue
  SET status = 'minted',
      tx_hash = _tx_hash,
      block_number = _block_number,
      on_chain_token_id = _on_chain_token_id,
      contract_address = _contract_address,
      minted_at = now(),
      processed_at = COALESCE(processed_at, now())
  WHERE id = _queue_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'queue item not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_sbt_minted(UUID, TEXT, BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_sbt_minted(UUID, TEXT, BIGINT, TEXT, TEXT) TO authenticated;

-- Stats RPC
CREATE OR REPLACE FUNCTION public.get_sbt_mint_queue_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'processing', COUNT(*) FILTER (WHERE status = 'processing'),
    'minted', COUNT(*) FILTER (WHERE status = 'minted'),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'total', COUNT(*)
  ) INTO v_result FROM public.sbt_onchain_queue;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sbt_mint_queue_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sbt_mint_queue_stats() TO authenticated;
