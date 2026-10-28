
-- Add coin transaction types for game
ALTER TYPE coin_transaction_type ADD VALUE IF NOT EXISTS 'quest_reward';
ALTER TYPE coin_transaction_type ADD VALUE IF NOT EXISTS 'box_reveal';

-- Box tiers config
CREATE TABLE public.box_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  drop_rate NUMERIC(5,4) NOT NULL,
  min_camly INT NOT NULL DEFAULT 0,
  max_camly INT NOT NULL DEFAULT 0,
  nft_chance NUMERIC(5,4) NOT NULL DEFAULT 0,
  color_hex TEXT DEFAULT '#daa520',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.box_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "box_tiers public read" ON public.box_tiers FOR SELECT USING (true);

INSERT INTO public.box_tiers(code, display_name, drop_rate, min_camly, max_camly, nft_chance, color_hex, sort_order) VALUES
('common',    'Common Box',    0.6000,    5,    50,  0.0010, '#9ca3af', 1),
('rare',      'Rare Box',      0.2500,   50,   300,  0.0100, '#3b82f6', 2),
('epic',      'Epic Box',      0.1000,  300,  1500,  0.0500, '#a855f7', 3),
('legendary', 'Legendary Box', 0.0400, 1500,  8000,  0.2500, '#f59e0b', 4),
('cosmic',    'Cosmic Box',    0.0100, 8000, 30000,  1.0000, '#ec4899', 5);

-- Box tickets
CREATE TABLE public.box_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tier_code TEXT NOT NULL REFERENCES public.box_tiers(code),
  source TEXT NOT NULL, -- 'streak_7','streak_14','quest_drop','admin','treasure'
  source_ref TEXT,
  server_seed TEXT NOT NULL, -- random hex, set on grant
  reveal_hash TEXT,          -- set on reveal
  status TEXT NOT NULL DEFAULT 'unrevealed', -- unrevealed | revealed | expired
  reward_camly INT,
  reward_nft_id UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_box_tickets_user ON public.box_tickets(user_id, status, created_at DESC);
ALTER TABLE public.box_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user view own box tickets" ON public.box_tickets FOR SELECT USING (auth.uid() = user_id);

-- User inventory (rewards items)
CREATE TABLE public.user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- nft_skin | booster | pet_item | badge | fragment
  item_name TEXT NOT NULL,
  rarity TEXT, -- common/rare/epic/legendary/cosmic
  metadata JSONB DEFAULT '{}'::jsonb,
  source_ticket_id UUID REFERENCES public.box_tickets(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_inventory_user ON public.user_inventory(user_id, created_at DESC);
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user view own inventory" ON public.user_inventory FOR SELECT USING (auth.uid() = user_id);

-- Grant box ticket
CREATE OR REPLACE FUNCTION public.grant_box_ticket(
  p_user_id UUID,
  p_tier_code TEXT,
  p_source TEXT,
  p_source_ref TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_seed TEXT;
BEGIN
  v_seed := encode(gen_random_bytes(16), 'hex');
  INSERT INTO public.box_tickets(user_id, tier_code, source, source_ref, server_seed)
  VALUES (p_user_id, p_tier_code, p_source, p_source_ref, v_seed)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Reveal box ticket — commit-reveal: hash(server_seed || ticket_id || now)
CREATE OR REPLACE FUNCTION public.reveal_box_ticket(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_tier RECORD;
  v_user UUID;
  v_hash TEXT;
  v_roll NUMERIC;
  v_camly INT;
  v_nft_chance NUMERIC;
  v_inventory_id UUID;
  v_got_nft BOOLEAN := FALSE;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_ticket FROM public.box_tickets WHERE id = p_ticket_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF v_ticket.status <> 'unrevealed' THEN RAISE EXCEPTION 'ticket already %', v_ticket.status; END IF;
  IF v_ticket.expires_at < now() THEN
    UPDATE public.box_tickets SET status='expired' WHERE id=p_ticket_id;
    RAISE EXCEPTION 'ticket expired';
  END IF;

  SELECT * INTO v_tier FROM public.box_tiers WHERE code = v_ticket.tier_code;

  -- commit-reveal hash
  v_hash := encode(digest(v_ticket.server_seed || p_ticket_id::text || now()::text, 'sha256'), 'hex');

  -- roll camly: deterministic from hash
  v_roll := ('x' || substr(v_hash, 1, 8))::bit(32)::int::numeric / 4294967295.0;
  IF v_roll < 0 THEN v_roll := -v_roll; END IF;
  v_camly := v_tier.min_camly + floor(v_roll * (v_tier.max_camly - v_tier.min_camly + 1))::int;

  -- nft roll
  v_nft_chance := ('x' || substr(v_hash, 9, 8))::bit(32)::int::numeric / 4294967295.0;
  IF v_nft_chance < 0 THEN v_nft_chance := -v_nft_chance; END IF;

  IF v_nft_chance < v_tier.nft_chance THEN
    INSERT INTO public.user_inventory(user_id, item_type, item_name, rarity, source_ticket_id, metadata)
    VALUES (v_user, 'nft_skin', 'Light Spark — ' || v_tier.display_name, v_tier.code, p_ticket_id,
            jsonb_build_object('reveal_hash', v_hash, 'tier', v_tier.code))
    RETURNING id INTO v_inventory_id;
    v_got_nft := TRUE;
  END IF;

  -- award camly
  PERFORM public.add_camly_coins(v_user, v_camly::bigint, 'box_reveal'::coin_transaction_type,
    'Mystery Box ' || v_tier.display_name, NULL,
    jsonb_build_object('ticket_id', p_ticket_id, 'tier', v_tier.code, 'reveal_hash', v_hash));

  UPDATE public.box_tickets
     SET status='revealed', reveal_hash=v_hash, reward_camly=v_camly,
         reward_nft_id=v_inventory_id, revealed_at=now()
   WHERE id=p_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'tier', v_tier.code,
    'tier_name', v_tier.display_name,
    'camly', v_camly,
    'nft', v_got_nft,
    'nft_id', v_inventory_id,
    'reveal_hash', v_hash
  );
END;
$$;
