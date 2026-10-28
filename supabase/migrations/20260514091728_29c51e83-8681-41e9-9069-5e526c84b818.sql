
-- Pet element + personality enum
CREATE TYPE public.pet_element AS ENUM ('fire','water','earth','air','light');
CREATE TYPE public.pet_personality AS ENUM ('joyful','wise','bold','gentle');
CREATE TYPE public.pet_evolution AS ENUM ('spark','glow','flame','star','sun','cosmos');

-- Pets table (1 pet per user for now)
CREATE TABLE public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  element public.pet_element NOT NULL,
  personality public.pet_personality NOT NULL,
  level int NOT NULL DEFAULT 1,
  xp bigint NOT NULL DEFAULT 0,
  energy int NOT NULL DEFAULT 80,
  mood int NOT NULL DEFAULT 80,
  aura int NOT NULL DEFAULT 50,
  evolution public.pet_evolution NOT NULL DEFAULT 'spark',
  last_fed_at timestamptz,
  last_chat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pet" ON public.pets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pet" ON public.pets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own pet" ON public.pets FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_pets_updated_at BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pet XP ledger
CREATE TABLE public.pet_xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source text NOT NULL,
  source_ref text,
  xp_delta int NOT NULL,
  level_after int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pet_xp_ledger_pet ON public.pet_xp_ledger (pet_id, created_at DESC);
ALTER TABLE public.pet_xp_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pet xp" ON public.pet_xp_ledger FOR SELECT USING (auth.uid() = user_id);

-- Pet chat messages
CREATE TABLE public.pet_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pet_chat_pet ON public.pet_chat_messages (pet_id, created_at DESC);
ALTER TABLE public.pet_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own pet chat" ON public.pet_chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own pet chat" ON public.pet_chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Adopt pet
CREATE OR REPLACE FUNCTION public.adopt_pet(
  p_name text,
  p_element public.pet_element,
  p_personality public.pet_personality
) RETURNS public.pets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pet public.pets;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 1 THEN RAISE EXCEPTION 'name required'; END IF;

  INSERT INTO public.pets (user_id, name, element, personality)
  VALUES (v_uid, trim(p_name), p_element, p_personality)
  ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name
  RETURNING * INTO v_pet;

  RETURN v_pet;
END;
$$;

-- Evolution stage by level
CREATE OR REPLACE FUNCTION public.pet_evolution_for_level(_lvl int)
RETURNS public.pet_evolution
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _lvl >= 91 THEN 'cosmos'::public.pet_evolution
    WHEN _lvl >= 61 THEN 'sun'
    WHEN _lvl >= 31 THEN 'star'
    WHEN _lvl >= 11 THEN 'flame'
    WHEN _lvl >= 5  THEN 'glow'
    ELSE 'spark'
  END;
$$;

-- XP needed to reach next level (simple curve: lvl*100)
CREATE OR REPLACE FUNCTION public.pet_xp_for_level(_lvl int)
RETURNS bigint
LANGUAGE sql IMMUTABLE AS $$
  SELECT (_lvl::bigint * 100);
$$;

-- Gain XP (security definer; called by edge functions on quest claim or chat)
CREATE OR REPLACE FUNCTION public.pet_gain_xp(
  p_user_id uuid,
  p_xp int,
  p_source text,
  p_source_ref text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet public.pets;
  v_new_xp bigint;
  v_new_lvl int;
  v_need bigint;
BEGIN
  SELECT * INTO v_pet FROM public.pets WHERE user_id = p_user_id FOR UPDATE;
  IF v_pet.id IS NULL THEN RETURN jsonb_build_object('skipped', true); END IF;

  v_new_xp := v_pet.xp + GREATEST(p_xp, 0);
  v_new_lvl := v_pet.level;
  LOOP
    v_need := public.pet_xp_for_level(v_new_lvl);
    EXIT WHEN v_new_xp < v_need OR v_new_lvl >= 100;
    v_new_xp := v_new_xp - v_need;
    v_new_lvl := v_new_lvl + 1;
  END LOOP;

  UPDATE public.pets
  SET xp = v_new_xp,
      level = v_new_lvl,
      evolution = public.pet_evolution_for_level(v_new_lvl),
      mood = LEAST(100, mood + 2),
      aura = LEAST(100, aura + 1),
      updated_at = now()
  WHERE id = v_pet.id;

  INSERT INTO public.pet_xp_ledger (pet_id, user_id, source, source_ref, xp_delta, level_after)
  VALUES (v_pet.id, p_user_id, p_source, p_source_ref, p_xp, v_new_lvl);

  RETURN jsonb_build_object(
    'pet_id', v_pet.id,
    'xp_delta', p_xp,
    'level', v_new_lvl,
    'leveled_up', v_new_lvl > v_pet.level,
    'evolution', public.pet_evolution_for_level(v_new_lvl)
  );
END;
$$;

-- Get pet multiplier for camly rewards
CREATE OR REPLACE FUNCTION public.get_pet_multiplier(p_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE
       WHEN level >= 91 THEN 1.20
       WHEN level >= 61 THEN 1.15
       WHEN level >= 31 THEN 1.10
       WHEN level >= 11 THEN 1.05
       ELSE 1.00
     END FROM public.pets WHERE user_id = p_user_id),
    1.00
  );
$$;
