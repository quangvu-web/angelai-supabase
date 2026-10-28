
-- ========== 1. mint_epochs: quản lý chu kỳ epoch ==========
CREATE TABLE public.mint_epochs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  epoch_label TEXT NOT NULL UNIQUE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  mint_pool_amount NUMERIC NOT NULL DEFAULT 0,
  total_light NUMERIC NOT NULL DEFAULT 0,
  user_count INTEGER NOT NULL DEFAULT 0,
  rules_version TEXT NOT NULL DEFAULT 'LS-Math-v1.0',
  status TEXT NOT NULL DEFAULT 'draft',
  finalized_at TIMESTAMPTZ,
  onchain_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_mint_epoch_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'finalized', 'onchain') THEN
    RAISE EXCEPTION 'Invalid mint_epoch status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_mint_epoch_status
  BEFORE INSERT OR UPDATE ON public.mint_epochs
  FOR EACH ROW EXECUTE FUNCTION public.validate_mint_epoch_status();

ALTER TABLE public.mint_epochs ENABLE ROW LEVEL SECURITY;

-- Users can view epochs (transparency)
CREATE POLICY "Anyone can view mint epochs"
  ON public.mint_epochs FOR SELECT USING (true);

-- Only service role can insert/update (via edge functions)
CREATE POLICY "Service role can manage mint epochs"
  ON public.mint_epochs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ========== 2. mint_allocations: phân bổ cho từng user ==========
CREATE TABLE public.mint_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  epoch_id UUID NOT NULL REFERENCES public.mint_epochs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  eligible BOOLEAN NOT NULL DEFAULT false,
  light_score NUMERIC NOT NULL DEFAULT 0,
  contribution_ratio NUMERIC NOT NULL DEFAULT 0,
  allocation_amount NUMERIC NOT NULL DEFAULT 0,
  reason_codes TEXT[] DEFAULT '{}',
  onchain_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(epoch_id, user_id)
);

CREATE INDEX idx_mint_allocations_epoch ON public.mint_allocations(epoch_id);
CREATE INDEX idx_mint_allocations_user ON public.mint_allocations(user_id);

ALTER TABLE public.mint_allocations ENABLE ROW LEVEL SECURITY;

-- Users can view their own allocations
CREATE POLICY "Users can view own allocations"
  ON public.mint_allocations FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all allocations
CREATE POLICY "Service role can manage allocations"
  ON public.mint_allocations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ========== 3. Thêm cột signature vào pplp_events ==========
ALTER TABLE public.pplp_events ADD COLUMN IF NOT EXISTS signature TEXT;
