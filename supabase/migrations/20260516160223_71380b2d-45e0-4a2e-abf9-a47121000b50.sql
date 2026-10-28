
-- Helper: sinh trait ngẫu nhiên cho NFT
CREATE OR REPLACE FUNCTION public.fn_random_nft_traits(p_collection text, p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_seed bytea;
  v_b0 int; v_b1 int; v_b2 int; v_b3 int; v_b4 int; v_b5 int; v_b6 int; v_b7 int;
  v_palettes text[] := ARRAY['dawn','dusk','forest','ocean','ember','aurora'];
  v_patterns text[] := ARRAY['waves','rays','spiral','lattice','bloom'];
  v_glyphs   text[] := ARRAY['moon','star','leaf','drop','flame','eye'];
  v_alphabet text   := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_constellation text;
  v_common jsonb;
  v_extra jsonb := '{}'::jsonb;
BEGIN
  -- Per-mint random bytes; collection+user mixed in via prefix for traceability
  v_seed := extensions.gen_random_bytes(8);
  v_b0 := get_byte(v_seed,0); v_b1 := get_byte(v_seed,1);
  v_b2 := get_byte(v_seed,2); v_b3 := get_byte(v_seed,3);
  v_b4 := get_byte(v_seed,4); v_b5 := get_byte(v_seed,5);
  v_b6 := get_byte(v_seed,6); v_b7 := get_byte(v_seed,7);

  v_constellation :=
       substr(v_alphabet, (v_b4 % length(v_alphabet)) + 1, 1)
    || substr(v_alphabet, (v_b5 % length(v_alphabet)) + 1, 1)
    || substr(v_alphabet, (v_b6 % length(v_alphabet)) + 1, 1)
    || substr(v_alphabet, (v_b7 % length(v_alphabet)) + 1, 1);

  v_common := jsonb_build_object(
    'palette_variant', v_palettes[(v_b0 % array_length(v_palettes,1)) + 1],
    'pattern',         v_patterns[(v_b1 % array_length(v_patterns,1)) + 1],
    'accent_glyph',    v_glyphs[(v_b2 % array_length(v_glyphs,1)) + 1],
    'aura_intensity',  (v_b3 % 4),                                         -- 0..3
    'birth_constellation', v_constellation,
    'mint_epoch',      extract(week from now())::int
  );

  CASE p_collection
    WHEN 'lighthouse_badge' THEN
      v_extra := jsonb_build_object(
        'flame_shape', (ARRAY['tear','wave','crown'])[(v_b4 % 3) + 1],
        'halo_rings',  (v_b5 % 3) + 1
      );
    WHEN 'light_spark' THEN
      v_extra := jsonb_build_object(
        'petal_count', 5 + (v_b4 % 5),                                     -- 5..9
        'core_glyph',  v_glyphs[(v_b2 % array_length(v_glyphs,1)) + 1]
      );
    WHEN 'pet_genesis' THEN
      v_extra := jsonb_build_object(
        'eye_style',   (ARRAY['round','sleepy','sparkle','wink'])[(v_b4 % 4) + 1],
        'cheek_color', (ARRAY['rose','peach','coral'])[(v_b5 % 3) + 1]
      );
    WHEN 'treasure_map_fragment' THEN
      v_extra := jsonb_build_object(
        'compass_skew', ((v_b4 % 31) - 15),                                -- -15..15
        'ink_color',    (ARRAY['sepia','indigo','crimson'])[(v_b5 % 3) + 1]
      );
    WHEN 'cosmic_seed' THEN
      v_extra := jsonb_build_object(
        'vein_count', 3 + (v_b4 % 4),                                      -- 3..6
        'glow_pulse', (ARRAY['slow','med','fast'])[(v_b5 % 3) + 1]
      );
    WHEN 'angel_wing' THEN
      v_extra := jsonb_build_object(
        'feather_layers', 2 + (v_b4 % 3),                                  -- 2..4
        'shimmer_hue',    (v_b5 * 360 / 256)                               -- 0..359
      );
    ELSE
      v_extra := '{}'::jsonb;
  END CASE;

  RETURN v_common || v_extra;
END;
$$;

-- Update enqueue_nft_mint: auto-merge random traits (caller traits override)
CREATE OR REPLACE FUNCTION public.enqueue_nft_mint(
  p_user_id uuid, p_collection text, p_source_type text,
  p_source_ref text, p_traits jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_col RECORD;
  v_token_id INTEGER;
  v_item_id UUID;
  v_random_traits jsonb;
  v_final_traits jsonb;
BEGIN
  SELECT * INTO v_col FROM public.nft_collections WHERE code = p_collection AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'collection_not_found'; END IF;

  IF v_col.supply_max IS NOT NULL AND v_col.supply_minted >= v_col.supply_max THEN
    RETURN NULL;
  END IF;

  IF p_source_ref IS NOT NULL THEN
    SELECT id INTO v_item_id FROM public.nft_items
    WHERE collection_code = p_collection AND owner_user_id = p_user_id AND source_ref = p_source_ref;
    IF v_item_id IS NOT NULL THEN RETURN v_item_id; END IF;
  END IF;

  v_token_id := v_col.supply_minted + 1;
  UPDATE public.nft_collections SET supply_minted = v_token_id WHERE code = p_collection;

  -- Merge: random traits as base, caller-provided traits override (domain wins)
  v_random_traits := public.fn_random_nft_traits(p_collection, p_user_id);
  v_final_traits  := v_random_traits || COALESCE(p_traits, '{}'::jsonb);

  INSERT INTO public.nft_items(collection_code, owner_user_id, token_id, traits, source_type, source_ref, mint_status, minted_at)
  VALUES (p_collection, p_user_id, v_token_id, v_final_traits, p_source_type, p_source_ref, 'simulated', now())
  RETURNING id INTO v_item_id;

  INSERT INTO public.nft_mint_queue(item_id) VALUES (v_item_id);

  RETURN v_item_id;
END;
$$;
