-- ===== Phase 5A: NFT Collection foundation =====

-- 1) Collections
CREATE TABLE IF NOT EXISTS public.nft_collections (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  supply_max INTEGER,                 -- NULL = unlimited
  supply_minted INTEGER NOT NULL DEFAULT 0,
  soulbound BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  traits_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nft_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_collections public read"
  ON public.nft_collections FOR SELECT
  USING (true);

-- 2) Items (issued NFTs)
CREATE TABLE IF NOT EXISTS public.nft_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_code TEXT NOT NULL REFERENCES public.nft_collections(code),
  owner_user_id UUID NOT NULL,
  token_id INTEGER NOT NULL,                -- per-collection sequential
  traits JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_type TEXT NOT NULL,                -- 'box_reveal' | 'streak_milestone' | 'quest' | 'manual'
  source_ref TEXT,                          -- e.g. 'streak_30', 'box_<id>'
  mint_status TEXT NOT NULL DEFAULT 'simulated', -- 'pending' | 'simulated' | 'onchain'
  tx_hash TEXT,
  minted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_code, token_id)
);

-- Prevent duplicate issuance per (user, collection, source_ref)
CREATE UNIQUE INDEX IF NOT EXISTS nft_items_dedup_idx
  ON public.nft_items (collection_code, owner_user_id, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS nft_items_owner_idx ON public.nft_items(owner_user_id, created_at DESC);

ALTER TABLE public.nft_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_items owner read"
  ON public.nft_items FOR SELECT
  USING (auth.uid() = owner_user_id);
CREATE POLICY "nft_items public read collection counts"
  ON public.nft_items FOR SELECT
  USING (true);  -- allow read for global stats; PII-safe (only owner_user_id is exposed, used for stats)

-- 3) Mint queue (on-chain processor reads this)
CREATE TABLE IF NOT EXISTS public.nft_mint_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.nft_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',   -- 'queued' | 'processing' | 'done' | 'failed' | 'skipped'
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nft_mint_queue ENABLE ROW LEVEL SECURITY;
-- queue is admin-only; processor uses service role
CREATE POLICY "nft_mint_queue admin only"
  ON public.nft_mint_queue FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Core RPC: enqueue (cấp NFT)
CREATE OR REPLACE FUNCTION public.enqueue_nft_mint(
  p_user_id UUID,
  p_collection TEXT,
  p_source_type TEXT,
  p_source_ref TEXT,
  p_traits JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col RECORD;
  v_token_id INTEGER;
  v_item_id UUID;
BEGIN
  -- Lock collection row
  SELECT * INTO v_col FROM public.nft_collections WHERE code = p_collection AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'collection_not_found'; END IF;

  -- Supply check
  IF v_col.supply_max IS NOT NULL AND v_col.supply_minted >= v_col.supply_max THEN
    RETURN NULL; -- silent skip: collection sold out
  END IF;

  -- Dup check (deterministic)
  IF p_source_ref IS NOT NULL THEN
    SELECT id INTO v_item_id FROM public.nft_items
    WHERE collection_code = p_collection AND owner_user_id = p_user_id AND source_ref = p_source_ref;
    IF v_item_id IS NOT NULL THEN RETURN v_item_id; END IF;
  END IF;

  -- Allocate token_id
  v_token_id := v_col.supply_minted + 1;
  UPDATE public.nft_collections SET supply_minted = v_token_id WHERE code = p_collection;

  INSERT INTO public.nft_items(collection_code, owner_user_id, token_id, traits, source_type, source_ref, mint_status, minted_at)
  VALUES (p_collection, p_user_id, v_token_id, COALESCE(p_traits, '{}'::jsonb), p_source_type, p_source_ref, 'simulated', now())
  RETURNING id INTO v_item_id;

  -- Enqueue for on-chain (will be processed in 5A.2)
  INSERT INTO public.nft_mint_queue(item_id) VALUES (v_item_id);

  RETURN v_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_nft_mint(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- 5) Trigger: streak milestone → Lighthouse Badge
CREATE OR REPLACE FUNCTION public.trg_streak_milestone_nft()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestones INT[] := ARRAY[7, 30, 90, 180, 365];
  v_m INT;
BEGIN
  IF NEW.current_streak IS NULL THEN RETURN NEW; END IF;
  FOREACH v_m IN ARRAY v_milestones LOOP
    IF NEW.current_streak >= v_m AND (OLD.current_streak IS NULL OR OLD.current_streak < v_m) THEN
      PERFORM public.enqueue_nft_mint(
        NEW.user_id,
        'lighthouse_badge',
        'streak_milestone',
        'streak_' || v_m::text,
        jsonb_build_object('milestone_days', v_m, 'awarded_at', now())
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS streak_milestone_nft_trigger ON public.user_quest_streaks;
CREATE TRIGGER streak_milestone_nft_trigger
AFTER INSERT OR UPDATE OF current_streak ON public.user_quest_streaks
FOR EACH ROW EXECUTE FUNCTION public.trg_streak_milestone_nft();

-- 6) Trigger: box reveal rare+ → chance Light Spark
-- Drop chance: rare 2%, epic 8%, legendary 25%, cosmic 100%
CREATE OR REPLACE FUNCTION public.trg_box_reveal_nft()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chance NUMERIC := 0;
  v_traits JSONB;
  v_colors TEXT[] := ARRAY['azure','gold','rose','jade','violet'];
  v_auras  TEXT[] := ARRAY['halo','flame','mist','ripple'];
  v_glyphs TEXT[] := ARRAY['lotus','star','sun','tree','wave'];
BEGIN
  IF NEW.status <> 'revealed' OR (OLD.status = NEW.status) THEN RETURN NEW; END IF;
  v_chance := CASE NEW.tier_code
    WHEN 'rare' THEN 0.02
    WHEN 'epic' THEN 0.08
    WHEN 'legendary' THEN 0.25
    WHEN 'cosmic' THEN 1.0
    ELSE 0
  END;
  IF v_chance > 0 AND random() < v_chance THEN
    v_traits := jsonb_build_object(
      'color',  v_colors[1 + floor(random()*array_length(v_colors,1))::int],
      'aura',   v_auras[1 + floor(random()*array_length(v_auras,1))::int],
      'glyph',  v_glyphs[1 + floor(random()*array_length(v_glyphs,1))::int],
      'tier_origin', NEW.tier_code
    );
    PERFORM public.enqueue_nft_mint(
      NEW.user_id,
      'light_spark',
      'box_reveal',
      'box_' || NEW.id::text,
      v_traits
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS box_reveal_nft_trigger ON public.box_tickets;
CREATE TRIGGER box_reveal_nft_trigger
AFTER UPDATE OF status ON public.box_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_box_reveal_nft();

-- 7) Seed collections
INSERT INTO public.nft_collections (code, name, description, supply_max, soulbound, image_url, traits_schema)
VALUES
  ('light_spark', 'Light Spark', 'Avatar skin NFT — tia sáng cá nhân hoá, drop ngẫu nhiên khi mở Mystery Box rare+.',
   10000, false, NULL,
   '{"color":["azure","gold","rose","jade","violet"],"aura":["halo","flame","mist","ripple"],"glyph":["lotus","star","sun","tree","wave"]}'::jsonb),
  ('lighthouse_badge', 'Lighthouse Badge', 'Huy hiệu soulbound cho mỗi mốc streak: 7/30/90/180/365 ngày.',
   NULL, true, NULL,
   '{"milestone_days":[7,30,90,180,365]}'::jsonb)
ON CONFLICT (code) DO NOTHING;