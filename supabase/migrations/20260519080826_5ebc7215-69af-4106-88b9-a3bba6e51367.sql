
-- 1. Collection NFT light_ascendant
INSERT INTO public.nft_collections (code, name, description, supply_max, soulbound, active, traits_schema)
VALUES (
  'light_ascendant',
  'Light Ascendant',
  'Danh hiệu vĩnh viễn của những người đã Thăng Sáng (Ascension). Soulbound, không thể chuyển nhượng.',
  NULL,
  true,
  true,
  '{"tier": "integer 1-5"}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- 2. Cột ascension_tier trên profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ascension_tier smallint NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_ascension_tier_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ascension_tier_check CHECK (ascension_tier BETWEEN 0 AND 5);

-- 3. Bảng user_ascensions
CREATE TABLE IF NOT EXISTS public.user_ascensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier smallint NOT NULL CHECK (tier BETWEEN 1 AND 5),
  ascended_at timestamptz NOT NULL DEFAULT now(),
  camly_burned bigint NOT NULL DEFAULT 0,
  nft_burned_id uuid,
  nft_burned_tier text,
  title_nft_id uuid,
  UNIQUE (user_id, tier)
);
CREATE INDEX IF NOT EXISTS user_ascensions_user_idx ON public.user_ascensions (user_id, ascended_at DESC);

ALTER TABLE public.user_ascensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own ascensions" ON public.user_ascensions;
CREATE POLICY "user reads own ascensions" ON public.user_ascensions
  FOR SELECT USING (auth.uid() = user_id);

-- 4. RPC get_ascension_state
CREATE OR REPLACE FUNCTION public.get_ascension_state(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tier smallint;
  v_level int;
  v_epic_count int;
  v_legendary_count int;
  v_history jsonb;
  v_eligible boolean;
  v_next_tier smallint;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT COALESCE(ascension_tier, 0) INTO v_tier FROM public.profiles WHERE user_id = p_user_id;
  v_tier := COALESCE(v_tier, 0);
  SELECT COALESCE(level, 1) INTO v_level FROM public.user_mastery WHERE user_id = p_user_id;
  v_level := COALESCE(v_level, 1);

  SELECT count(*) FILTER (WHERE (traits->>'tier') = 'epic'),
         count(*) FILTER (WHERE (traits->>'tier') = 'legendary')
  INTO v_epic_count, v_legendary_count
  FROM public.nft_items
  WHERE owner_user_id = p_user_id
    AND collection_code <> 'light_ascendant';

  v_next_tier := v_tier + 1;
  v_eligible := (v_tier < 5) AND (v_level >= 50) AND ((v_epic_count > 0) OR (v_legendary_count > 0));

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tier', tier,
    'ascended_at', ascended_at,
    'camly_burned', camly_burned,
    'nft_burned_tier', nft_burned_tier
  ) ORDER BY tier), '[]'::jsonb)
  INTO v_history
  FROM public.user_ascensions
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'tier', v_tier,
    'next_tier', CASE WHEN v_tier < 5 THEN v_next_tier ELSE NULL END,
    'level', v_level,
    'epic_count', v_epic_count,
    'legendary_count', v_legendary_count,
    'eligible', v_eligible,
    'bonus_pct', v_tier,  -- = tier × 1%
    'cost_options', jsonb_build_array(
      jsonb_build_object('nft_tier', 'epic', 'camly', 50000),
      jsonb_build_object('nft_tier', 'legendary', 'camly', 10000)
    ),
    'history', v_history
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ascension_state(uuid) TO authenticated;

-- 5. RPC ascend_light
CREATE OR REPLACE FUNCTION public.ascend_light(p_nft_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tier smallint;
  v_level int;
  v_nft_tier text;
  v_nft_owner uuid;
  v_nft_collection text;
  v_camly_cost bigint;
  v_next_tier smallint;
  v_title_nft_id uuid;
  v_ascension_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Lock profile row
  SELECT COALESCE(ascension_tier, 0) INTO v_tier
  FROM public.profiles WHERE user_id = v_user_id FOR UPDATE;
  v_tier := COALESCE(v_tier, 0);

  IF v_tier >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'max_tier_reached');
  END IF;

  SELECT COALESCE(level, 1) INTO v_level FROM public.user_mastery WHERE user_id = v_user_id FOR UPDATE;
  IF COALESCE(v_level, 1) < 50 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mastery_below_50');
  END IF;

  -- Lock NFT row
  SELECT (traits->>'tier'), owner_user_id, collection_code
  INTO v_nft_tier, v_nft_owner, v_nft_collection
  FROM public.nft_items WHERE id = p_nft_id FOR UPDATE;

  IF v_nft_owner IS NULL OR v_nft_owner <> v_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'nft_not_owned');
  END IF;
  IF v_nft_collection = 'light_ascendant' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_burn_title');
  END IF;
  IF v_nft_tier = 'epic' THEN
    v_camly_cost := 50000;
  ELSIF v_nft_tier = 'legendary' THEN
    v_camly_cost := 10000;
  ELSE
    RETURN jsonb_build_object('ok', false, 'reason', 'nft_tier_invalid');
  END IF;

  -- Trừ Camly (raise nếu không đủ qua add_camly_coins)
  PERFORM public.add_camly_coins(
    v_user_id,
    -v_camly_cost,
    'forge_burn'::coin_transaction_type,
    'Light Ascension tier ' || (v_tier + 1)::text,
    NULL,
    jsonb_build_object('source', 'ascension', 'nft_tier', v_nft_tier)
  );

  -- Burn input NFT
  DELETE FROM public.nft_items WHERE id = p_nft_id;

  -- Reset mastery
  UPDATE public.user_mastery
  SET level = 1, total_xp = 0, updated_at = now()
  WHERE user_id = v_user_id;

  -- Increment ascension_tier
  v_next_tier := v_tier + 1;
  UPDATE public.profiles SET ascension_tier = v_next_tier WHERE user_id = v_user_id;

  -- Enqueue title NFT (soulbound)
  v_title_nft_id := public.enqueue_nft_mint(
    v_user_id,
    'light_ascendant',
    'ascension',
    'ascend:' || v_user_id::text || ':' || v_next_tier::text,
    jsonb_build_object('tier', v_next_tier, 'label', 'Light Ascendant T' || v_next_tier::text)
  );

  -- Log
  INSERT INTO public.user_ascensions (user_id, tier, camly_burned, nft_burned_id, nft_burned_tier, title_nft_id)
  VALUES (v_user_id, v_next_tier, v_camly_cost, p_nft_id, v_nft_tier, v_title_nft_id)
  RETURNING id INTO v_ascension_id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_tier', v_next_tier,
    'bonus_pct', v_next_tier,
    'camly_burned', v_camly_cost,
    'title_nft_id', v_title_nft_id,
    'ascension_id', v_ascension_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ascend_light(uuid) TO authenticated;
