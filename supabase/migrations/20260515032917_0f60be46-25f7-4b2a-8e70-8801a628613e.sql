-- ============================================================
-- PHASE 7: PvE BOSS RAID
-- ============================================================

-- 1) Tables
CREATE TABLE public.raid_bosses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID REFERENCES public.game_seasons(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  lore TEXT,
  art_url TEXT,
  total_hp BIGINT NOT NULL CHECK (total_hp > 0),
  current_hp BIGINT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('upcoming','active','defeated','expired')),
  defeated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_raid_bosses_status ON public.raid_bosses(status, ends_at);
CREATE INDEX idx_raid_bosses_season ON public.raid_bosses(season_id);

CREATE TABLE public.raid_loot_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id UUID NOT NULL REFERENCES public.raid_bosses(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('common','rare','epic','cosmic')),
  min_contribution_pct NUMERIC(7,4) NOT NULL CHECK (min_contribution_pct >= 0 AND min_contribution_pct <= 100),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('camly','box_ticket','fun_money','pet_xp','nft','season_xp')),
  reward_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  label TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  expired_eligible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_raid_loot_boss ON public.raid_loot_table(boss_id, position);

CREATE TABLE public.raid_attacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id UUID NOT NULL REFERENCES public.raid_bosses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  damage INT NOT NULL CHECK (damage > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (boss_id, user_id, source, ref_id)
);
CREATE INDEX idx_raid_attacks_boss_user ON public.raid_attacks(boss_id, user_id);
CREATE INDEX idx_raid_attacks_recent ON public.raid_attacks(boss_id, created_at DESC);

CREATE TABLE public.raid_contributions (
  boss_id UUID NOT NULL REFERENCES public.raid_bosses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  total_damage BIGINT NOT NULL DEFAULT 0,
  attack_count INT NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  PRIMARY KEY (boss_id, user_id)
);
CREATE INDEX idx_raid_contrib_top ON public.raid_contributions(boss_id, total_damage DESC);

CREATE TABLE public.raid_loot_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id UUID NOT NULL REFERENCES public.raid_bosses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  loot_id UUID NOT NULL REFERENCES public.raid_loot_table(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (boss_id, user_id, loot_id)
);
CREATE INDEX idx_raid_claims_user ON public.raid_loot_claims(user_id, boss_id);

-- 2) RLS
ALTER TABLE public.raid_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raid_loot_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raid_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raid_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raid_loot_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY raid_bosses_public_read ON public.raid_bosses FOR SELECT USING (true);
CREATE POLICY raid_loot_public_read ON public.raid_loot_table FOR SELECT USING (true);
CREATE POLICY raid_contrib_public_read ON public.raid_contributions FOR SELECT USING (true);

CREATE POLICY raid_attacks_self_read ON public.raid_attacks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY raid_claims_self_read ON public.raid_loot_claims
  FOR SELECT USING (auth.uid() = user_id);

-- (No INSERT/UPDATE policies — all writes go through SECURITY DEFINER RPC)

-- 3) attack_boss RPC
CREATE OR REPLACE FUNCTION public.attack_boss(
  p_user_id UUID,
  p_source TEXT,
  p_ref_id TEXT,
  p_damage INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boss RECORD;
  v_actual INT;
  v_total BIGINT;
  v_defeated BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR p_damage IS NULL OR p_damage <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_input');
  END IF;

  SELECT * INTO v_boss FROM public.raid_bosses
   WHERE status = 'active' AND now() BETWEEN starts_at AND ends_at
   ORDER BY starts_at DESC LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_boss');
  END IF;

  -- Idempotent insert
  BEGIN
    INSERT INTO public.raid_attacks (boss_id, user_id, source, ref_id, damage)
    VALUES (v_boss.id, p_user_id, p_source, p_ref_id, p_damage);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END;

  -- Cap damage to remaining HP
  v_actual := LEAST(p_damage, GREATEST(v_boss.current_hp, 0)::int);

  UPDATE public.raid_bosses
     SET current_hp = GREATEST(current_hp - v_actual, 0),
         status = CASE WHEN current_hp - v_actual <= 0 THEN 'defeated' ELSE status END,
         defeated_at = CASE WHEN current_hp - v_actual <= 0 AND defeated_at IS NULL THEN now() ELSE defeated_at END
   WHERE id = v_boss.id
   RETURNING current_hp, status INTO v_boss.current_hp, v_boss.status;

  v_defeated := v_boss.status = 'defeated';

  -- Aggregate
  INSERT INTO public.raid_contributions (boss_id, user_id, total_damage, attack_count, last_hit_at)
  VALUES (v_boss.id, p_user_id, v_actual, 1, now())
  ON CONFLICT (boss_id, user_id) DO UPDATE
    SET total_damage = raid_contributions.total_damage + EXCLUDED.total_damage,
        attack_count = raid_contributions.attack_count + 1,
        last_hit_at = now()
  RETURNING total_damage INTO v_total;

  RETURN jsonb_build_object(
    'success', true,
    'damage_dealt', v_actual,
    'total_damage', v_total,
    'hp_left', v_boss.current_hp,
    'defeated', v_defeated
  );
END;
$$;

-- 4) Trigger on user_season_xp_log → auto attack_boss
CREATE OR REPLACE FUNCTION public.trg_xp_log_attack_boss()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dmg INT;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  -- Damage = xp amount × 5 (treasure_solve=30xp → 150 dmg, jackpot=200xp → 1000 dmg, quest=20xp → 100 dmg)
  v_dmg := GREATEST(1, NEW.amount * 5);
  PERFORM public.attack_boss(
    NEW.user_id,
    'xp:' || NEW.source,
    NEW.ref_id,
    v_dmg
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block xp log on raid failure
  RETURN NEW;
END;
$$;

CREATE TRIGGER xp_log_attack_boss
AFTER INSERT ON public.user_season_xp_log
FOR EACH ROW EXECUTE FUNCTION public.trg_xp_log_attack_boss();

-- 5) get_active_boss (public-preview for guests)
CREATE OR REPLACE FUNCTION public.get_active_boss()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_boss RECORD;
  v_user UUID := auth.uid();
  v_my_dmg BIGINT := 0;
  v_my_pct NUMERIC := 0;
  v_top JSONB;
BEGIN
  SELECT * INTO v_boss FROM public.raid_bosses
   WHERE status IN ('active','defeated')
   ORDER BY (status='active') DESC, starts_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  IF v_user IS NOT NULL THEN
    SELECT total_damage INTO v_my_dmg FROM public.raid_contributions
      WHERE boss_id = v_boss.id AND user_id = v_user;
    v_my_dmg := COALESCE(v_my_dmg, 0);
    IF v_boss.total_hp > 0 THEN
      v_my_pct := ROUND((v_my_dmg::numeric / v_boss.total_hp::numeric) * 100, 4);
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', rc.user_id,
      'display_name', COALESCE(p.display_name, p.handle, 'Ẩn danh'),
      'handle', p.handle,
      'avatar_url', p.avatar_url,
      'pct', ROUND((rc.total_damage::numeric / v_boss.total_hp::numeric) * 100, 3)
    )), '[]'::jsonb)
  INTO v_top
  FROM (
    SELECT user_id, total_damage FROM public.raid_contributions
    WHERE boss_id = v_boss.id ORDER BY total_damage DESC LIMIT 10
  ) rc
  LEFT JOIN public.profiles p ON p.id = rc.user_id;

  RETURN jsonb_build_object(
    'active', true,
    'boss', jsonb_build_object(
      'id', v_boss.id,
      'code', v_boss.code,
      'name', v_boss.name,
      'lore', v_boss.lore,
      'art_url', v_boss.art_url,
      'total_hp', v_boss.total_hp,
      'current_hp', v_boss.current_hp,
      'hp_pct', ROUND((v_boss.current_hp::numeric / v_boss.total_hp::numeric) * 100, 2),
      'status', v_boss.status,
      'starts_at', v_boss.starts_at,
      'ends_at', v_boss.ends_at,
      'defeated_at', v_boss.defeated_at
    ),
    'me', jsonb_build_object(
      'damage', v_my_dmg,
      'pct', v_my_pct,
      'authenticated', v_user IS NOT NULL
    ),
    'top_contributors', v_top
  );
END;
$$;

-- 6) get_boss_loot_preview
CREATE OR REPLACE FUNCTION public.get_boss_loot_preview(p_boss_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_boss RECORD;
  v_my_pct NUMERIC := 0;
  v_loot JSONB;
BEGIN
  SELECT * INTO v_boss FROM public.raid_bosses WHERE id = p_boss_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','boss_not_found');
  END IF;

  IF v_user IS NOT NULL AND v_boss.total_hp > 0 THEN
    SELECT ROUND((COALESCE(total_damage,0)::numeric / v_boss.total_hp::numeric) * 100, 4)
      INTO v_my_pct
      FROM public.raid_contributions
     WHERE boss_id = p_boss_id AND user_id = v_user;
    v_my_pct := COALESCE(v_my_pct, 0);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'tier', l.tier,
    'label', l.label,
    'reward_type', l.reward_type,
    'reward_value', l.reward_value,
    'min_pct', l.min_contribution_pct,
    'eligible', (v_boss.status='defeated' AND v_my_pct >= l.min_contribution_pct)
                OR (v_boss.status='expired' AND l.expired_eligible AND v_my_pct >= l.min_contribution_pct),
    'claimed', EXISTS (
      SELECT 1 FROM public.raid_loot_claims c
       WHERE c.boss_id = p_boss_id AND c.user_id = v_user AND c.loot_id = l.id
    ),
    'position', l.position
  ) ORDER BY l.position), '[]'::jsonb)
  INTO v_loot
  FROM public.raid_loot_table l
  WHERE l.boss_id = p_boss_id;

  RETURN jsonb_build_object(
    'boss_status', v_boss.status,
    'my_pct', v_my_pct,
    'loot', v_loot
  );
END;
$$;

-- 7) claim_boss_loot
CREATE OR REPLACE FUNCTION public.claim_boss_loot(p_boss_id UUID, p_loot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_boss RECORD;
  v_loot RECORD;
  v_my_pct NUMERIC := 0;
  v_my_dmg BIGINT := 0;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_boss FROM public.raid_bosses WHERE id = p_boss_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','boss_not_found'); END IF;
  IF v_boss.status NOT IN ('defeated','expired') THEN
    RETURN jsonb_build_object('success',false,'error','boss_alive');
  END IF;

  SELECT * INTO v_loot FROM public.raid_loot_table WHERE id = p_loot_id AND boss_id = p_boss_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','loot_not_found'); END IF;

  IF v_boss.status = 'expired' AND NOT v_loot.expired_eligible THEN
    RETURN jsonb_build_object('success',false,'error','tier_locked_on_expire');
  END IF;

  SELECT total_damage INTO v_my_dmg FROM public.raid_contributions
    WHERE boss_id = p_boss_id AND user_id = v_user;
  v_my_dmg := COALESCE(v_my_dmg, 0);
  IF v_boss.total_hp > 0 THEN
    v_my_pct := (v_my_dmg::numeric / v_boss.total_hp::numeric) * 100;
  END IF;

  IF v_my_pct < v_loot.min_contribution_pct THEN
    RETURN jsonb_build_object('success',false,'error','insufficient_contribution',
                              'my_pct', v_my_pct, 'required_pct', v_loot.min_contribution_pct);
  END IF;

  -- Idempotent claim
  BEGIN
    INSERT INTO public.raid_loot_claims (boss_id, user_id, loot_id)
      VALUES (p_boss_id, v_user, p_loot_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success',false,'error','already_claimed');
  END;

  -- Grant reward
  IF v_loot.reward_type = 'camly' THEN
    PERFORM public.add_camly_coins(v_user, COALESCE((v_loot.reward_value->>'amount')::int, 0), 'raid_loot', p_loot_id::text);
  ELSIF v_loot.reward_type = 'box_ticket' THEN
    PERFORM public.grant_box_ticket(
      v_user,
      COALESCE(v_loot.reward_value->>'tier','common'),
      'raid_loot:' || p_loot_id::text
    );
  ELSIF v_loot.reward_type = 'pet_xp' THEN
    PERFORM public.pet_gain_xp(v_user, COALESCE((v_loot.reward_value->>'amount')::int,0), 'raid_loot:' || p_loot_id::text);
  ELSIF v_loot.reward_type = 'season_xp' THEN
    PERFORM public.add_season_xp('raid_loot', p_loot_id::text, COALESCE((v_loot.reward_value->>'amount')::int,0));
  ELSIF v_loot.reward_type = 'nft' THEN
    PERFORM public.enqueue_nft_mint(
      v_user,
      v_loot.reward_value->>'collection_code',
      'raid_loot:' || p_loot_id::text,
      v_loot.reward_value
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'reward_type', v_loot.reward_type, 'reward_value', v_loot.reward_value);
END;
$$;

-- 8) expire_old_bosses (cron)
CREATE OR REPLACE FUNCTION public.expire_old_bosses()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  UPDATE public.raid_bosses
     SET status = 'expired'
   WHERE status = 'active' AND ends_at < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- 9) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.raid_bosses;

-- 10) Grants
GRANT EXECUTE ON FUNCTION public.get_active_boss() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_boss_loot_preview(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_boss_loot(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_bosses() TO service_role;
-- attack_boss + trigger function are internal (called by trigger or RPC), no public grant.

-- 11) Seed boss + loot for cosmic-summer-2026
DO $seed$
DECLARE
  v_season_id UUID;
  v_boss_id UUID;
BEGIN
  SELECT id INTO v_season_id FROM public.game_seasons WHERE code = 'cosmic-summer-2026' LIMIT 1;
  IF v_season_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.raid_bosses (season_id, code, name, lore, art_url, total_hp, current_hp, starts_at, ends_at, status)
  VALUES (
    v_season_id,
    'shadow-of-unknowing-2026',
    'Bóng Tối Vô Minh',
    'Một thực thể cổ xưa hiện ra khi mùa hè cosmic chạm đỉnh. Mỗi việc tốt của con người là một tia sáng bào mòn nó.',
    NULL,
    50000000,
    50000000,
    now(),
    (SELECT ends_at FROM public.game_seasons WHERE id = v_season_id),
    'active'
  )
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_boss_id;

  IF v_boss_id IS NULL THEN
    SELECT id INTO v_boss_id FROM public.raid_bosses WHERE code='shadow-of-unknowing-2026';
  END IF;

  -- Loot tiers
  INSERT INTO public.raid_loot_table (boss_id, tier, min_contribution_pct, reward_type, reward_value, label, position, expired_eligible) VALUES
    (v_boss_id, 'common', 0.01, 'camly',      jsonb_build_object('amount', 200),                 '+200 Camly',                    1, true),
    (v_boss_id, 'common', 0.05, 'season_xp',  jsonb_build_object('amount', 50),                  '+50 Season XP',                 2, true),
    (v_boss_id, 'rare',   0.20, 'box_ticket', jsonb_build_object('tier','common'),               'Common Box Ticket',             3, true),
    (v_boss_id, 'rare',   0.50, 'box_ticket', jsonb_build_object('tier','rare'),                 'Rare Box Ticket',               4, false),
    (v_boss_id, 'epic',   1.00, 'box_ticket', jsonb_build_object('tier','epic'),                 'Epic Box Ticket',               5, false),
    (v_boss_id, 'cosmic', 5.00, 'box_ticket', jsonb_build_object('tier','cosmic'),               'Cosmic Box (huyền thoại)',     6, false)
  ON CONFLICT DO NOTHING;
END $seed$;