
-- =====================================================
-- LIGHT MASTERY FOUNDATION (Sprint 1)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_mastery (
  user_id uuid PRIMARY KEY,
  total_xp bigint NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  pending_perks int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own mastery" ON public.user_mastery FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.mastery_perk_catalog (
  level int PRIMARY KEY,
  options jsonb NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mastery_perk_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads catalog" ON public.mastery_perk_catalog FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_mastery_perks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  level_unlocked int NOT NULL,
  perk_key text NOT NULL,
  chosen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, level_unlocked)
);
ALTER TABLE public.user_mastery_perks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own perks" ON public.user_mastery_perks FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_mastery_xp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  source_ref text NOT NULL,
  amount int NOT NULL,
  level_before int,
  level_after int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_ref)
);
ALTER TABLE public.user_mastery_xp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own log" ON public.user_mastery_xp_log FOR SELECT USING (auth.uid() = user_id);

-- Compute level from total XP using formula xp_needed(L) = 500 * L^1.35
-- Cumulative threshold to REACH level L = sum_{k=1..L-1} 500*k^1.35
CREATE OR REPLACE FUNCTION public.mastery_level_from_xp(p_xp bigint)
RETURNS int LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_level int := 1;
  v_cum numeric := 0;
  v_needed numeric;
BEGIN
  FOR i IN 1..49 LOOP
    v_needed := 500 * (i::numeric ^ 1.35);
    v_cum := v_cum + v_needed;
    IF p_xp >= v_cum THEN
      v_level := i + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  IF v_level > 50 THEN v_level := 50; END IF;
  RETURN v_level;
END;
$$;

-- add_mastery_xp: idempotent via (user_id, source, source_ref)
CREATE OR REPLACE FUNCTION public.add_mastery_xp(
  p_user uuid,
  p_source text,
  p_source_ref text,
  p_amount int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing int;
  v_before_level int;
  v_after_level int;
  v_new_xp bigint;
  v_new_pending int;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_input');
  END IF;

  -- Check idempotency
  SELECT id INTO v_existing FROM public.user_mastery_xp_log
    WHERE user_id = p_user AND source = p_source AND source_ref = p_source_ref;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'duplicate');
  END IF;

  -- Ensure row exists
  INSERT INTO public.user_mastery (user_id, total_xp, level)
    VALUES (p_user, 0, 1)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT level INTO v_before_level FROM public.user_mastery WHERE user_id = p_user;

  UPDATE public.user_mastery
    SET total_xp = total_xp + p_amount,
        updated_at = now()
    WHERE user_id = p_user
    RETURNING total_xp INTO v_new_xp;

  v_after_level := public.mastery_level_from_xp(v_new_xp);

  -- Count new perk milestones crossed (every 5 levels)
  v_new_pending := GREATEST(0, (v_after_level / 5) - (v_before_level / 5));

  UPDATE public.user_mastery
    SET level = v_after_level,
        pending_perks = pending_perks + v_new_pending,
        updated_at = now()
    WHERE user_id = p_user;

  INSERT INTO public.user_mastery_xp_log (user_id, source, source_ref, amount, level_before, level_after)
    VALUES (p_user, p_source, p_source_ref, p_amount, v_before_level, v_after_level);

  RETURN jsonb_build_object(
    'ok', true,
    'xp', v_new_xp,
    'level_before', v_before_level,
    'level_after', v_after_level,
    'new_pending_perks', v_new_pending
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mastery_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row record;
  v_cum numeric := 0;
  v_needed_to_next numeric := 0;
  v_xp_at_level numeric := 0;
  v_perks jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauth');
  END IF;

  INSERT INTO public.user_mastery (user_id, total_xp, level)
    VALUES (v_user, 0, 1) ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.user_mastery WHERE user_id = v_user;

  -- Cumulative XP at start of current level
  FOR i IN 1..(v_row.level - 1) LOOP
    v_xp_at_level := v_xp_at_level + 500 * (i::numeric ^ 1.35);
  END LOOP;
  -- XP needed for next level
  IF v_row.level < 50 THEN
    v_needed_to_next := 500 * (v_row.level::numeric ^ 1.35);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('level_unlocked', level_unlocked, 'perk_key', perk_key)), '[]'::jsonb)
    INTO v_perks
    FROM public.user_mastery_perks WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'ok', true,
    'level', v_row.level,
    'total_xp', v_row.total_xp,
    'pending_perks', v_row.pending_perks,
    'xp_into_level', GREATEST(0, v_row.total_xp - v_xp_at_level::bigint),
    'xp_needed_for_next', v_needed_to_next::bigint,
    'perks', v_perks
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_mastery_perk(p_level int, p_perk_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_level int;
  v_catalog jsonb;
  v_valid boolean := false;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauth'); END IF;
  IF p_level % 5 <> 0 OR p_level < 5 OR p_level > 50 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_level');
  END IF;

  SELECT level INTO v_user_level FROM public.user_mastery WHERE user_id = v_user;
  IF v_user_level IS NULL OR v_user_level < p_level THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'level_not_reached');
  END IF;

  -- Validate perk_key against catalog
  SELECT options INTO v_catalog FROM public.mastery_perk_catalog WHERE level = p_level;
  IF v_catalog IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_catalog'); END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_catalog) AS opt
    WHERE opt->>'key' = p_perk_key
  ) INTO v_valid;
  IF NOT v_valid THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_perk_key'); END IF;

  -- Insert perk choice (unique constraint guards duplicates)
  BEGIN
    INSERT INTO public.user_mastery_perks (user_id, level_unlocked, perk_key)
      VALUES (v_user, p_level, p_perk_key);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_chosen');
  END;

  UPDATE public.user_mastery
    SET pending_perks = GREATEST(0, pending_perks - 1), updated_at = now()
    WHERE user_id = v_user;

  RETURN jsonb_build_object('ok', true, 'level', p_level, 'perk', p_perk_key);
END;
$$;

-- Bridge trigger: mirror Season XP into Mastery
CREATE OR REPLACE FUNCTION public.tg_mastery_from_season_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.amount > 0 THEN
    PERFORM public.add_mastery_xp(
      NEW.user_id,
      COALESCE(NEW.source, 'season') || ':season',
      COALESCE(NEW.source_ref, NEW.id::text),
      NEW.amount
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_user_season_xp_to_mastery ON public.user_season_xp_log;
CREATE TRIGGER tg_user_season_xp_to_mastery
  AFTER INSERT ON public.user_season_xp_log
  FOR EACH ROW EXECUTE FUNCTION public.tg_mastery_from_season_xp();

-- Seed catalog: 10 mốc (5,10,...,50), mỗi mốc 2 lựa chọn perk
INSERT INTO public.mastery_perk_catalog (level, description, options) VALUES
  (5,  'Khởi đầu thuần khiết',  '[{"key":"camly_boost_2","label":"+2% Camly mọi nguồn","desc":"Cộng dồn vĩnh viễn 2% Camly khi claim."},{"key":"streak_shield_1","label":"+1 vé bảo vệ streak/tháng","desc":"Tự bù 1 ngày nếu lỡ streak (cấp mỗi tháng)."}]'::jsonb),
  (10, 'Người gieo ánh sáng',    '[{"key":"box_ticket_weekly_1","label":"+1 Common Box/tuần","desc":"Tự cấp 1 vé common box mỗi tuần."},{"key":"pet_xp_5","label":"+5% Pet XP","desc":"Pet tiến hoá nhanh hơn 5%."}]'::jsonb),
  (15, 'Tâm vững',                '[{"key":"camly_boost_3","label":"+3% Camly mọi nguồn","desc":"Bonus cộng dồn (tổng tối đa được normalize cap mềm)."},{"key":"quest_bonus_xp_10","label":"+10% Season XP từ Daily Quest","desc":"XP mùa khi claim quest +10%."}]'::jsonb),
  (20, 'Bậc chiêm nghiệm',        '[{"key":"lamp_share_floor_1","label":"+1% sàn share Lamp Loot","desc":"Sàn chia loot trong vòng sáng +1%."},{"key":"riddle_spark_bonus_1","label":"+1 Riddle Spark/ngày","desc":"Mỗi câu đố đúng cộng thêm 1 Spark."}]'::jsonb),
  (25, 'Đường ánh sáng',          '[{"key":"box_ticket_weekly_rare","label":"+1 Rare Box/tháng","desc":"Cấp 1 vé Rare Box mỗi tháng."},{"key":"forge_discount_5","label":"-5% Camly đốt khi Forge","desc":"Light Forge tiết kiệm 5% chi phí."}]'::jsonb),
  (30, 'Trung tâm vòng tròn',     '[{"key":"circle_preset_cosmic","label":"Mở preset Cosmic cho Lamp","desc":"Officer được chọn preset Cosmic khi thắp đèn."},{"key":"co_op_bonus_camly_50","label":"+50 Camly khi co-op thành công","desc":"Mỗi lượt giải đố/lantern theo nhóm +50 Camly."}]'::jsonb),
  (35, 'Người canh đèn',          '[{"key":"streak_shield_2","label":"+2 vé bảo vệ streak/tháng","desc":"Nâng cấp shield streak (thay thế perk cũ nếu chọn)."},{"key":"lantern_bonus_xp_15","label":"+15% Lantern XP","desc":"Hoàn thành chặng lantern XP +15%."}]'::jsonb),
  (40, 'Hơi thở thiên hà',        '[{"key":"forge_echo_2x","label":"Forge Echo drop ×2","desc":"Tỉ lệ drop Forge Echo từ 5% lên 10%."},{"key":"riddle_co_op_bonus_100","label":"+100 Camly khi co-op riddle","desc":"Bonus Camly khi vòng giải ≥5 đáp đúng/ngày."}]'::jsonb),
  (45, 'Bậc dẫn lối',             '[{"key":"camly_boost_5","label":"+5% Camly mọi nguồn","desc":"Bonus cộng dồn, normalize cap mềm."},{"key":"box_ticket_monthly_epic","label":"+1 Epic Box/quý","desc":"Cấp 1 vé Epic Box mỗi quý."}]'::jsonb),
  (50, 'Bậc trọn vẹn',            '[{"key":"genesis_pet_evolution","label":"Genesis Pet evolution","desc":"Pet hiện tại tiến hoá soulbound (1 lần duy nhất)."},{"key":"founder_aura","label":"Founder Aura badge","desc":"Mở badge xuất hiện trên FUN ID vĩnh viễn."}]'::jsonb)
ON CONFLICT (level) DO UPDATE SET options = EXCLUDED.options, description = EXCLUDED.description;
