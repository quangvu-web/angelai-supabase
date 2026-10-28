
-- Phase 11: Officer-customizable lamp loot tier

-- 1) Add loot_tier column
ALTER TABLE public.light_circle_lamps
  ADD COLUMN IF NOT EXISTS loot_tier text NOT NULL DEFAULT 'standard'
    CHECK (loot_tier IN ('standard','rare','epic'));

-- 2) Update create_circle_lamp to accept loot_tier
CREATE OR REPLACE FUNCTION public.create_circle_lamp(
  p_name text,
  p_target bigint,
  p_ends_at timestamptz DEFAULT NULL,
  p_loot_tier text DEFAULT 'standard'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_circle uuid; v_role text; v_id uuid; v_tier text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT circle_id, role INTO v_circle, v_role FROM light_circle_members WHERE user_id=v_uid;
  IF v_circle IS NULL THEN RAISE EXCEPTION 'not_in_circle'; END IF;
  IF v_role NOT IN ('founder','steward') THEN RAISE EXCEPTION 'not_officer'; END IF;
  IF p_target IS NULL OR p_target <= 0 OR p_target > 100000000 THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF length(coalesce(p_name,'')) < 2 OR length(p_name) > 60 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  v_tier := COALESCE(p_loot_tier, 'standard');
  IF v_tier NOT IN ('standard','rare','epic') THEN RAISE EXCEPTION 'invalid_loot_tier'; END IF;
  IF EXISTS (SELECT 1 FROM light_circle_lamps WHERE circle_id=v_circle AND status='active') THEN
    RAISE EXCEPTION 'lamp_active_exists';
  END IF;
  INSERT INTO light_circle_lamps(circle_id, name, target_light, ends_at, created_by, loot_tier)
    VALUES (v_circle, p_name, p_target, p_ends_at, v_uid, v_tier)
    RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

-- 3) Update trigger to read loot_tier
CREATE OR REPLACE FUNCTION public.tg_lamp_loot_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_loot_id uuid;
  v_total bigint;
  v_count int;
  v_base_box int;
  v_base_xp int;
  v_base_camly int;
  v_base_tier text;
BEGIN
  IF NEW.status <> 'completed' OR COALESCE(OLD.status,'') = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Tier presets
  CASE COALESCE(NEW.loot_tier, 'standard')
    WHEN 'rare' THEN
      v_base_box := 15; v_base_xp := 4000; v_base_camly := 10000; v_base_tier := 'rare';
    WHEN 'epic' THEN
      v_base_box := 20; v_base_xp := 8000; v_base_camly := 20000; v_base_tier := 'epic';
    ELSE
      v_base_box := 10; v_base_xp := 2000; v_base_camly := 5000; v_base_tier := 'common';
  END CASE;

  SELECT COALESCE(SUM(amount),0), COUNT(DISTINCT user_id)
    INTO v_total, v_count
    FROM public.light_circle_lamp_contributions
    WHERE lamp_id = NEW.id;

  IF v_total <= 0 OR v_count = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.light_circle_lamp_loot (
    lamp_id, circle_id, total_contributors, total_light,
    base_box_tier, base_box_count, base_xp, base_camly
  ) VALUES (
    NEW.id, NEW.circle_id, v_count, v_total,
    v_base_tier, v_base_box, v_base_xp, v_base_camly
  )
  ON CONFLICT (lamp_id) DO NOTHING
  RETURNING id INTO v_loot_id;

  IF v_loot_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.light_circle_lamp_loot_grants (
    lamp_id, circle_id, user_id, contribution, share_pct,
    box_tickets_granted, xp_granted, camly_granted
  )
  SELECT
    NEW.id, NEW.circle_id, c.user_id, c.contrib,
    ROUND((c.contrib::numeric / v_total::numeric) * 100, 2),
    GREATEST(1,   ROUND((c.contrib::numeric / v_total::numeric) * v_base_box))::int,
    GREATEST(50,  ROUND((c.contrib::numeric / v_total::numeric) * v_base_xp))::int,
    GREATEST(100, ROUND((c.contrib::numeric / v_total::numeric) * v_base_camly))::int
  FROM (
    SELECT user_id, SUM(amount)::bigint AS contrib
    FROM public.light_circle_lamp_contributions
    WHERE lamp_id = NEW.id
    GROUP BY user_id
  ) c
  ON CONFLICT (lamp_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
