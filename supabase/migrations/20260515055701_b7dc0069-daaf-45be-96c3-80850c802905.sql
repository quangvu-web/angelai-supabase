
-- ============ Phase 9 — Lamp Loot tables ============
CREATE TABLE public.light_circle_lamp_loot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lamp_id uuid NOT NULL UNIQUE REFERENCES public.light_circle_lamps(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.light_circles(id) ON DELETE CASCADE,
  total_contributors int NOT NULL DEFAULT 0,
  total_light bigint NOT NULL DEFAULT 0,
  base_box_tier text NOT NULL DEFAULT 'common',
  base_box_count int NOT NULL DEFAULT 10,
  base_xp int NOT NULL DEFAULT 2000,
  base_camly int NOT NULL DEFAULT 5000,
  distributed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lamp_loot_circle ON public.light_circle_lamp_loot(circle_id);

CREATE TABLE public.light_circle_lamp_loot_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lamp_id uuid NOT NULL REFERENCES public.light_circle_lamps(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL REFERENCES public.light_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  contribution bigint NOT NULL,
  share_pct numeric(5,2) NOT NULL,
  box_tickets_granted int NOT NULL,
  xp_granted int NOT NULL,
  camly_granted int NOT NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lamp_id, user_id)
);
CREATE INDEX idx_lamp_grants_user ON public.light_circle_lamp_loot_grants(user_id, claimed_at);
CREATE INDEX idx_lamp_grants_lamp ON public.light_circle_lamp_loot_grants(lamp_id);

ALTER TABLE public.light_circle_lamp_loot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.light_circle_lamp_loot_grants ENABLE ROW LEVEL SECURITY;

-- RLS: members see loot summary of their circle
CREATE POLICY "members can view lamp loot of their circle"
ON public.light_circle_lamp_loot FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.light_circle_members m
  WHERE m.circle_id = light_circle_lamp_loot.circle_id AND m.user_id = auth.uid()
));

-- RLS: see own grant or officer of the circle
CREATE POLICY "view own grant or officer"
ON public.light_circle_lamp_loot_grants FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.light_circle_members m
    WHERE m.circle_id = light_circle_lamp_loot_grants.circle_id
      AND m.user_id = auth.uid()
      AND m.role IN ('founder','steward')
  )
);

-- ============ Trigger: distribute on completion ============
CREATE OR REPLACE FUNCTION public.tg_lamp_loot_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loot_id uuid;
  v_total bigint;
  v_count int;
  v_base_box int := 10;
  v_base_xp int := 2000;
  v_base_camly int := 5000;
  v_base_tier text := 'common';
BEGIN
  IF NEW.status <> 'completed' OR COALESCE(OLD.status,'') = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Aggregate contributions
  SELECT COALESCE(SUM(amount),0), COUNT(DISTINCT user_id)
    INTO v_total, v_count
    FROM public.light_circle_lamp_contributions
    WHERE lamp_id = NEW.id;

  IF v_total <= 0 OR v_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Insert loot summary (UNIQUE lamp_id → no-op if exists)
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
    RETURN NEW; -- already distributed
  END IF;

  -- Insert per-user grants with floor minimums
  INSERT INTO public.light_circle_lamp_loot_grants (
    lamp_id, circle_id, user_id, contribution, share_pct,
    box_tickets_granted, xp_granted, camly_granted
  )
  SELECT
    NEW.id, NEW.circle_id, c.user_id, c.contrib,
    ROUND((c.contrib::numeric / v_total::numeric) * 100, 2) AS share_pct,
    GREATEST(1, ROUND((c.contrib::numeric / v_total::numeric) * v_base_box))::int,
    GREATEST(50, ROUND((c.contrib::numeric / v_total::numeric) * v_base_xp))::int,
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
$$;

CREATE TRIGGER tg_lamp_loot_on_complete
AFTER UPDATE ON public.light_circle_lamps
FOR EACH ROW
EXECUTE FUNCTION public.tg_lamp_loot_on_complete();

-- ============ RPC: get_lamp_loot ============
CREATE OR REPLACE FUNCTION public.get_lamp_loot(p_lamp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_loot jsonb;
  v_grant jsonb;
  v_total_claimed int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','unauthorized');
  END IF;

  SELECT to_jsonb(l) INTO v_loot
  FROM public.light_circle_lamp_loot l
  WHERE l.lamp_id = p_lamp_id
    AND EXISTS (SELECT 1 FROM public.light_circle_members m
                WHERE m.circle_id = l.circle_id AND m.user_id = v_uid);

  IF v_loot IS NULL THEN
    RETURN jsonb_build_object('has_loot', false);
  END IF;

  SELECT to_jsonb(g) INTO v_grant
  FROM public.light_circle_lamp_loot_grants g
  WHERE g.lamp_id = p_lamp_id AND g.user_id = v_uid;

  SELECT COUNT(*) INTO v_total_claimed
  FROM public.light_circle_lamp_loot_grants
  WHERE lamp_id = p_lamp_id AND claimed_at IS NOT NULL;

  RETURN jsonb_build_object(
    'has_loot', true,
    'loot', v_loot,
    'my_grant', v_grant,
    'total_claimed', v_total_claimed
  );
END;
$$;

-- ============ RPC: claim_lamp_loot ============
CREATE OR REPLACE FUNCTION public.claim_lamp_loot(p_lamp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_grant public.light_circle_lamp_loot_grants%ROWTYPE;
  v_tier text;
  v_i int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_grant
  FROM public.light_circle_lamp_loot_grants
  WHERE lamp_id = p_lamp_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_grant';
  END IF;

  IF v_grant.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  SELECT base_box_tier INTO v_tier
  FROM public.light_circle_lamp_loot
  WHERE lamp_id = p_lamp_id;

  -- Grant box tickets (loop)
  FOR v_i IN 1..GREATEST(0, v_grant.box_tickets_granted) LOOP
    PERFORM public.grant_box_ticket(v_uid, v_tier, 'lamp_loot', p_lamp_id::text);
  END LOOP;

  -- Grant XP
  IF v_grant.xp_granted > 0 THEN
    PERFORM public.add_season_xp(v_uid, 'lamp_loot', p_lamp_id::text, v_grant.xp_granted);
  END IF;

  -- Grant Camly
  IF v_grant.camly_granted > 0 THEN
    PERFORM public.add_camly_coins(
      v_uid, v_grant.camly_granted::bigint, 'quest_reward'::coin_transaction_type,
      'Lamp loot', NULL,
      jsonb_build_object('source','lamp_loot','lamp_id', p_lamp_id)
    );
  END IF;

  UPDATE public.light_circle_lamp_loot_grants
  SET claimed_at = now()
  WHERE id = v_grant.id;

  RETURN jsonb_build_object(
    'ok', true,
    'granted', jsonb_build_object(
      'boxes', v_grant.box_tickets_granted,
      'xp', v_grant.xp_granted,
      'camly', v_grant.camly_granted,
      'tier', v_tier
    )
  );
END;
$$;

-- Realtime
ALTER TABLE public.light_circle_lamp_loot REPLICA IDENTITY FULL;
ALTER TABLE public.light_circle_lamp_loot_grants REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.light_circle_lamp_loot;
ALTER PUBLICATION supabase_realtime ADD TABLE public.light_circle_lamp_loot_grants;
