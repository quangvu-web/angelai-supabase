
-- ============================================
-- LAYER 1: Digital Identity Bank (DIB) Schema
-- ============================================

-- 1. User DIDs - Decentralized Identity records
CREATE TABLE public.user_dids (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  did TEXT NOT NULL UNIQUE, -- e.g. did:fun:0x...hash
  did_hash TEXT NOT NULL, -- keccak256 of the DID for on-chain anchoring
  wallet_address TEXT, -- primary wallet bound to this DID
  secondary_wallets TEXT[] DEFAULT '{}',
  trust_seed TEXT, -- initial trust randomness
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  on_chain_anchor_hash TEXT, -- tx hash of on-chain DID registration
  on_chain_anchor_block BIGINT, -- block number
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Soulbound NFTs - Non-transferable identity tokens
CREATE TABLE public.soulbound_nfts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  did_id UUID NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  token_id BIGINT, -- on-chain NFT token ID (null until minted)
  contract_address TEXT, -- SBT smart contract address
  did_hash TEXT NOT NULL, -- stored in NFT metadata
  trust_seed TEXT NOT NULL,
  creation_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  mint_tx_hash TEXT, -- on-chain mint transaction
  mint_block BIGINT,
  mint_status TEXT NOT NULL DEFAULT 'pending' CHECK (mint_status IN ('pending', 'minted', 'failed')),
  metadata_uri TEXT, -- IPFS/Arweave URI for NFT metadata
  metadata_hash TEXT, -- hash of off-chain metadata for integrity
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Identity Metadata Store - Encrypted off-chain data with on-chain hash pointers
CREATE TABLE public.identity_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  did_id UUID NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  data_type TEXT NOT NULL, -- 'profile', 'kyc', 'reputation', 'credentials'
  encrypted_data TEXT, -- encrypted off-chain payload
  data_hash TEXT NOT NULL, -- hash of raw data for on-chain pointer
  on_chain_hash TEXT, -- tx hash anchoring this data hash
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. DID Events - Audit trail for all identity changes
CREATE TABLE public.did_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  did_id UUID NOT NULL REFERENCES public.user_dids(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'wallet_bound', 'sbt_minted', 'metadata_updated', 'suspended', 'revoked'
  event_data JSONB DEFAULT '{}',
  on_chain_hash TEXT, -- anchor tx for this event
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Light Score Snapshots - Periodic snapshots with on-chain anchoring
CREATE TABLE public.light_score_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  did_id UUID REFERENCES public.user_dids(id),
  snapshot_epoch TEXT NOT NULL, -- e.g. '2026-02-27', 'week-2026-09'
  light_score NUMERIC NOT NULL,
  pillar_s NUMERIC NOT NULL DEFAULT 0,
  pillar_t NUMERIC NOT NULL DEFAULT 0,
  pillar_h NUMERIC NOT NULL DEFAULT 0,
  pillar_c NUMERIC NOT NULL DEFAULT 0,
  pillar_u NUMERIC NOT NULL DEFAULT 0,
  total_actions INTEGER NOT NULL DEFAULT 0,
  trust_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  time_decay_factor NUMERIC NOT NULL DEFAULT 1.0,
  snapshot_hash TEXT NOT NULL, -- hash of all snapshot data
  on_chain_anchor_hash TEXT, -- tx hash storing snapshot_hash on-chain
  on_chain_anchor_block BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_user_dids_wallet ON public.user_dids(wallet_address);
CREATE INDEX idx_user_dids_did ON public.user_dids(did);
CREATE INDEX idx_soulbound_nfts_did ON public.soulbound_nfts(did_id);
CREATE INDEX idx_identity_metadata_did ON public.identity_metadata(did_id, data_type);
CREATE INDEX idx_identity_metadata_current ON public.identity_metadata(user_id, data_type) WHERE is_current = true;
CREATE INDEX idx_did_events_did ON public.did_events(did_id, event_type);
CREATE INDEX idx_light_score_snapshots_user ON public.light_score_snapshots(user_id, snapshot_epoch);
CREATE UNIQUE INDEX idx_light_score_snapshots_unique ON public.light_score_snapshots(user_id, snapshot_epoch);

-- Enable RLS
ALTER TABLE public.user_dids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soulbound_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.did_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.light_score_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies - user_dids
CREATE POLICY "Users can view their own DID" ON public.user_dids FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages DIDs" ON public.user_dids FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies - soulbound_nfts
CREATE POLICY "Users can view their own SBT" ON public.soulbound_nfts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages SBTs" ON public.soulbound_nfts FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies - identity_metadata
CREATE POLICY "Users can view their own metadata" ON public.identity_metadata FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages metadata" ON public.identity_metadata FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies - did_events
CREATE POLICY "Users can view their own DID events" ON public.did_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages DID events" ON public.did_events FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- RLS Policies - light_score_snapshots
CREATE POLICY "Users can view their own snapshots" ON public.light_score_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages snapshots" ON public.light_score_snapshots FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_user_dids_updated_at BEFORE UPDATE ON public.user_dids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_soulbound_nfts_updated_at BEFORE UPDATE ON public.soulbound_nfts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_identity_metadata_updated_at BEFORE UPDATE ON public.identity_metadata
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for snapshots
ALTER PUBLICATION supabase_realtime ADD TABLE public.light_score_snapshots;
