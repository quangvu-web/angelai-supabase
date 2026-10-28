
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS total_xp bigint NOT NULL DEFAULT 0;

-- Backfill: total_xp = current xp + sum of positive xp deltas in ledger
UPDATE public.pets p
SET total_xp = GREATEST(
  p.xp,
  COALESCE((SELECT SUM(GREATEST(xp_delta, 0)) FROM public.pet_xp_ledger WHERE pet_id = p.id), 0)
);

CREATE OR REPLACE FUNCTION public.pet_evolution_for_total_xp(_total_xp bigint)
RETURNS pet_evolution
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN _total_xp >= 40000 THEN 'cosmos'::public.pet_evolution
    WHEN _total_xp >= 15000 THEN 'sun'
    WHEN _total_xp >= 6000  THEN 'star'
    WHEN _total_xp >= 2000  THEN 'flame'
    WHEN _total_xp >= 500   THEN 'glow'
    ELSE 'spark'
  END;
$$;

CREATE OR REPLACE FUNCTION public.pet_aura_bonus_for_evolution(_e pet_evolution)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _e
    WHEN 'cosmos' THEN 6
    WHEN 'sun'    THEN 5
    WHEN 'star'   THEN 4
    WHEN 'flame'  THEN 3
    WHEN 'glow'   THEN 2
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.pet_gain_xp(p_user_id uuid, p_xp integer, p_source text, p_source_ref text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_pet public.pets;
  v_new_xp bigint;
  v_new_lvl int;
  v_need bigint;
  v_total bigint;
  v_old_evo pet_evolution;
  v_new_evo pet_evolution;
  v_aura_bonus int;
BEGIN
  SELECT * INTO v_pet FROM public.pets WHERE user_id = p_user_id FOR UPDATE;
  IF v_pet.id IS NULL THEN RETURN jsonb_build_object('skipped', true); END IF;

  v_new_xp := v_pet.xp + GREATEST(p_xp, 0);
  v_total  := v_pet.total_xp + GREATEST(p_xp, 0);
  v_new_lvl := v_pet.level;
  LOOP
    v_need := public.pet_xp_for_level(v_new_lvl);
    EXIT WHEN v_new_xp < v_need OR v_new_lvl >= 100;
    v_new_xp := v_new_xp - v_need;
    v_new_lvl := v_new_lvl + 1;
  END LOOP;

  v_old_evo := v_pet.evolution;
  v_new_evo := public.pet_evolution_for_total_xp(v_total);
  v_aura_bonus := public.pet_aura_bonus_for_evolution(v_new_evo);

  UPDATE public.pets
  SET xp = v_new_xp,
      total_xp = v_total,
      level = v_new_lvl,
      evolution = v_new_evo,
      mood = LEAST(100, mood + 2),
      aura = LEAST(100, aura + v_aura_bonus),
      updated_at = now()
  WHERE id = v_pet.id;

  INSERT INTO public.pet_xp_ledger (pet_id, user_id, source, source_ref, xp_delta, level_after)
  VALUES (v_pet.id, p_user_id, p_source, p_source_ref, p_xp, v_new_lvl);

  RETURN jsonb_build_object(
    'pet_id', v_pet.id,
    'xp_delta', p_xp,
    'level', v_new_lvl,
    'leveled_up', v_new_lvl > v_pet.level,
    'total_xp', v_total,
    'evolution', v_new_evo,
    'evolved', v_new_evo <> v_old_evo
  );
END;
$function$;

-- Sync evolution for existing pets to match their backfilled total_xp
UPDATE public.pets SET evolution = public.pet_evolution_for_total_xp(total_xp);
