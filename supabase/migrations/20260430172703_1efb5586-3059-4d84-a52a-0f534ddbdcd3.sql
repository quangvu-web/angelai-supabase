-- =====================================================
-- CONNECTOR LAYER v1 — First On-chain Giver
-- =====================================================

-- 1) connectors: 1 record / newcomer
CREATE TABLE public.connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newcomer_user_id UUID NOT NULL UNIQUE,
  newcomer_did TEXT,
  connector_user_id UUID,
  connector_wallet TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  chain_id INT NOT NULL DEFAULT 97,
  token_symbol TEXT NOT NULL,
  token_amount NUMERIC NOT NULL,
  block_number BIGINT NOT NULL,
  tx_index INT NOT NULL DEFAULT 0,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','revoked')),
  revoke_reason TEXT,
  evidence_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connectors_connector_user ON public.connectors(connector_user_id);
CREATE INDEX idx_connectors_status ON public.connectors(status, created_at DESC);
CREATE INDEX idx_connectors_wallet ON public.connectors(connector_wallet);

ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Newcomer or connector can view own row"
  ON public.connectors FOR SELECT
  USING (auth.uid() = newcomer_user_id OR auth.uid() = connector_user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admin can update connectors"
  ON public.connectors FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

-- INSERT only via service role (no policy = denied for anon/authenticated)

-- 2) connector_events: log mọi ứng viên
CREATE TABLE public.connector_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newcomer_user_id UUID NOT NULL,
  candidate_wallet TEXT,
  tx_hash TEXT,
  reason TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connector_events_newcomer ON public.connector_events(newcomer_user_id, created_at DESC);
CREATE INDEX idx_connector_events_reason ON public.connector_events(reason);

ALTER TABLE public.connector_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Newcomer can view own events"
  ON public.connector_events FOR SELECT
  USING (auth.uid() = newcomer_user_id OR public.has_role(auth.uid(),'admin'));

-- 3) connector_disputes
CREATE TABLE public.connector_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL,
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','upheld','rejected')),
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connector_disputes_status ON public.connector_disputes(status, created_at DESC);
CREATE INDEX idx_connector_disputes_connector ON public.connector_disputes(connector_id);

ALTER TABLE public.connector_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Raiser or admin can view"
  ON public.connector_disputes FOR SELECT
  USING (auth.uid() = raised_by OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated can raise dispute"
  ON public.connector_disputes FOR INSERT
  WITH CHECK (auth.uid() = raised_by);

CREATE POLICY "Admin can resolve"
  ON public.connector_disputes FOR UPDATE
  USING (public.has_role(auth.uid(),'admin'));

-- 4) profiles ALTER
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS connector_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_connector BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS connector_window_expires_at TIMESTAMPTZ;

-- Backfill window for existing profiles (created_at + 48h, capped to past = expired)
UPDATE public.profiles
SET connector_window_expires_at = created_at + INTERVAL '48 hours'
WHERE connector_window_expires_at IS NULL;

-- Trigger to auto-set window for new profiles
CREATE OR REPLACE FUNCTION public.set_connector_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.connector_window_expires_at IS NULL THEN
    NEW.connector_window_expires_at := COALESCE(NEW.created_at, now()) + INTERVAL '48 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_connector_window ON public.profiles;
CREATE TRIGGER trg_set_connector_window
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_connector_window();

-- 5) updated_at triggers
CREATE TRIGGER trg_connectors_updated
  BEFORE UPDATE ON public.connectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_connector_disputes_updated
  BEFORE UPDATE ON public.connector_disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) RPC: atomic claim slot (called from edge function with service role)
CREATE OR REPLACE FUNCTION public.claim_connector_slot(
  p_newcomer_user_id UUID,
  p_newcomer_did TEXT,
  p_connector_user_id UUID,
  p_connector_wallet TEXT,
  p_tx_hash TEXT,
  p_chain_id INT,
  p_token_symbol TEXT,
  p_token_amount NUMERIC,
  p_block_number BIGINT,
  p_tx_index INT,
  p_evidence_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.connectors (
    newcomer_user_id, newcomer_did, connector_user_id, connector_wallet,
    tx_hash, chain_id, token_symbol, token_amount, block_number, tx_index,
    confirmed_at, status, evidence_hash
  ) VALUES (
    p_newcomer_user_id, p_newcomer_did, p_connector_user_id, lower(p_connector_wallet),
    lower(p_tx_hash), p_chain_id, p_token_symbol, p_token_amount, p_block_number, p_tx_index,
    now(), 'confirmed', p_evidence_hash
  )
  ON CONFLICT (newcomer_user_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    UPDATE public.profiles
       SET has_connector = true
     WHERE user_id = p_newcomer_user_id;

    IF p_connector_user_id IS NOT NULL THEN
      UPDATE public.profiles
         SET connector_count = connector_count + 1
       WHERE user_id = p_connector_user_id;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;