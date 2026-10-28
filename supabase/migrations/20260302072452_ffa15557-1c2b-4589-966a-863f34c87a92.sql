
-- Add multisig columns to pplp_mint_requests
ALTER TABLE public.pplp_mint_requests
  ADD COLUMN IF NOT EXISTS multisig_signatures JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS multisig_completed_groups TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS multisig_required_groups TEXT[] DEFAULT '{will,wisdom,love}',
  ADD COLUMN IF NOT EXISTS amount_wei TEXT,
  ADD COLUMN IF NOT EXISTS platform_id TEXT DEFAULT 'angel_ai';

-- Enable Realtime for pplp_mint_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.pplp_mint_requests;

-- RLS: Attester can SELECT requests in pending_sig/signing/signed status
CREATE POLICY "Attester can view signing requests"
  ON public.pplp_mint_requests
  FOR SELECT
  USING (status IN ('pending_sig', 'signing', 'signed'));

-- RLS: Attester can UPDATE multisig fields on pending_sig/signing requests
CREATE POLICY "Attester can update multisig signatures"
  ON public.pplp_mint_requests
  FOR UPDATE
  USING (status IN ('pending_sig', 'signing'))
  WITH CHECK (status IN ('pending_sig', 'signing', 'signed'));
