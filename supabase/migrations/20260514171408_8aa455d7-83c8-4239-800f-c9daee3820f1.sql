-- ============================================================
-- 3) Helper: get current active season
-- ============================================================
CREATE OR REPLACE FUNCTION public._current_season()
RETURNS public.game_seasons
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.game_seasons
  WHERE is_active = true AND now() BETWEEN starts_at AND ends_at
  ORDER BY starts_at DESC
  LIMIT 1;
$$;

-- ============================================================
-- 4) RPC: add_season_xp (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_season_xp(
  p_user_id UUID,
  p_source TEXT,
  p_ref_id TEXT,
  p_amount INT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_season public.game_seasons;
  v_pass public.user_season_pass;
  v_old_level INT;
  v_new_level INT;
  v_inserted BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  v_season := public._current_season();
  IF v_season.id IS NULL THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'no_active_season');
  END IF;

  -- Idempotent insert
  BEGIN
    INSERT INTO public.user_season_xp_log(user_id, season_id, source, ref_id, amount)
    VALUES (p_user_id, v_season.id, p_source, p_ref_id, p_amount);
    v_inserted := true;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'duplicate');
  END;

  -- Upsert pass
  INSERT INTO public.user_season_pass(user_id, season_id, xp, level)
  VALUES (p_user_id, v_season.id, p_amount, 1)
  ON CONFLICT (user_id, season_id) DO UPDATE
    SET xp = user_season_pass.xp + EXCLUDED.xp,
        updated_at = now()
  RETURNING * INTO v_pass;

  v_old_level := v_pass.level;
  v_new_level := LEAST(v_season.max_level, GREATEST(1, 1 + v_pass.xp / v_season.xp_per_level));

  IF v_new_level <> v_old_level THEN
    UPDATE public.user_season_pass SET level = v_new_level, updated_at = now()
    WHERE id = v_pass.id;
  END IF;

  RETURN jsonb_build_object(
    'season_id', v_season.id,
    'xp', v_pass.xp,
    'level', v_new_level,
    'levels_gained', GREATEST(0, v_new_level - v_old_level),
    'amount', p_amount
  );
END;
$$;

-- ============================================================
-- 5) RPC: get_active_season
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_season()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_season public.game_seasons;
  v_user UUID := auth.uid();
  v_pass public.user_season_pass;
BEGIN
  v_season := public._current_season();
  IF v_season.id IS NULL THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  IF v_user IS NOT NULL THEN
    SELECT * INTO v_pass FROM public.user_season_pass
    WHERE user_id = v_user AND season_id = v_season.id;
  END IF;

  RETURN jsonb_build_object(
    'active', true,
    'season', to_jsonb(v_season),
    'pass', CASE WHEN v_pass.id IS NULL THEN NULL ELSE to_jsonb(v_pass) END,
    'rewards', COALESCE((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.level, r.track)
      FROM public.season_pass_rewards r
      WHERE r.season_id = v_season.id
    ), '[]'::jsonb),
    'claimed', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('level', c.level, 'track', c.track))
      FROM public.user_season_claims c
      WHERE c.user_id = v_user AND c.season_id = v_season.id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_season() TO authenticated, anon;

-- ============================================================
-- 6) RPC: claim_season_reward
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_season_reward(p_level INT, p_track TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_season public.game_seasons;
  v_pass public.user_season_pass;
  v_reward public.season_pass_rewards;
  v_value JSONB;
  v_ticket UUID;
  v_amount INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_track NOT IN ('free','premium') THEN RAISE EXCEPTION 'invalid_track'; END IF;

  v_season := public._current_season();
  IF v_season.id IS NULL THEN RAISE EXCEPTION 'no_active_season'; END IF;

  SELECT * INTO v_pass FROM public.user_season_pass
  WHERE user_id = v_user AND season_id = v_season.id;
  IF v_pass.id IS NULL THEN RAISE EXCEPTION 'no_pass_yet'; END IF;
  IF v_pass.level < p_level THEN RAISE EXCEPTION 'level_not_reached'; END IF;
  IF p_track = 'premium' AND NOT v_pass.is_premium THEN RAISE EXCEPTION 'premium_required'; END IF;

  SELECT * INTO v_reward FROM public.season_pass_rewards
  WHERE season_id = v_season.id AND level = p_level AND track = p_track;
  IF v_reward.id IS NULL THEN RAISE EXCEPTION 'reward_not_found'; END IF;

  -- Insert claim first (atomic dedup)
  BEGIN
    INSERT INTO public.user_season_claims(user_pass_id, season_id, user_id, level, track, reward_type, reward_value)
    VALUES (v_pass.id, v_season.id, v_user, p_level, p_track, v_reward.reward_type, v_reward.reward_value);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_claimed';
  END;

  v_value := v_reward.reward_value;

  -- Dispatch reward
  IF v_reward.reward_type = 'camly' THEN
    v_amount := COALESCE((v_value->>'amount')::int, 0);
    IF v_amount > 0 THEN
      PERFORM public.add_camly_coins(
        v_user, v_amount::bigint, 'season_pass_reward'::coin_transaction_type,
        format('Season %s · Level %s · %s', v_season.code, p_level, p_track),
        NULL::numeric, jsonb_build_object('season', v_season.code, 'level', p_level, 'track', p_track)
      );
    END IF;
  ELSIF v_reward.reward_type = 'box_ticket' THEN
    v_ticket := public.grant_box_ticket(
      v_user,
      COALESCE(v_value->>'tier', 'common'),
      'season_pass',
      format('%s:%s:%s', v_season.code, p_level, p_track)
    );
    v_value := v_value || jsonb_build_object('ticket_id', v_ticket);
  ELSIF v_reward.reward_type = 'pet_xp' THEN
    v_amount := COALESCE((v_value->>'xp')::int, 0);
    IF v_amount > 0 THEN
      PERFORM public.pet_gain_xp(v_user, v_amount, 'season_pass', format('%s:%s:%s', v_season.code, p_level, p_track));
    END IF;
  END IF;
  -- 'badge', 'cosmetic', 'fun_money' are recorded only (UI displays them)

  RETURN jsonb_build_object(
    'level', p_level, 'track', p_track,
    'reward_type', v_reward.reward_type, 'reward_value', v_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_season_reward(INT, TEXT) TO authenticated;

-- ============================================================
-- 7) RPC: unlock_season_premium
-- ============================================================
CREATE OR REPLACE FUNCTION public.unlock_season_premium()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_season public.game_seasons;
  v_pass public.user_season_pass;
  v_balance BIGINT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  v_season := public._current_season();
  IF v_season.id IS NULL THEN RAISE EXCEPTION 'no_active_season'; END IF;

  -- Ensure pass exists
  INSERT INTO public.user_season_pass(user_id, season_id) VALUES (v_user, v_season.id)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  SELECT * INTO v_pass FROM public.user_season_pass
  WHERE user_id = v_user AND season_id = v_season.id;

  IF v_pass.is_premium THEN
    RETURN jsonb_build_object('already_premium', true);
  END IF;

  -- Charge camly
  SELECT balance INTO v_balance FROM public.camly_coin WHERE user_id = v_user;
  IF COALESCE(v_balance, 0) < v_season.premium_price_camly THEN
    RAISE EXCEPTION 'insufficient_camly';
  END IF;

  PERFORM public.add_camly_coins(
    v_user, -v_season.premium_price_camly::bigint, 'spending'::coin_transaction_type,
    format('Unlock Season Premium · %s', v_season.code),
    NULL::numeric, jsonb_build_object('season', v_season.code, 'kind', 'premium_unlock')
  );

  UPDATE public.user_season_pass
  SET is_premium = true, premium_unlocked_at = now(), updated_at = now()
  WHERE id = v_pass.id;

  RETURN jsonb_build_object('ok', true, 'season', v_season.code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_season_premium() TO authenticated;

-- ============================================================
-- 8) Triggers — auto award XP from existing activities
-- ============================================================

-- Quest claim approved → +20 XP
CREATE OR REPLACE FUNCTION public.trg_season_xp_quest()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID;
BEGIN
  IF NEW.decision <> 'approved' THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user FROM public.user_daily_quests WHERE id = NEW.claim_id;
  IF v_user IS NOT NULL THEN
    PERFORM public.add_season_xp(v_user, 'daily_quest', NEW.claim_id::text, 20);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_season_xp_quest ON public.quest_evidence_audit;
CREATE TRIGGER trg_season_xp_quest AFTER INSERT ON public.quest_evidence_audit
FOR EACH ROW EXECUTE FUNCTION public.trg_season_xp_quest();

-- Treasure clue solved → +30 XP
CREATE OR REPLACE FUNCTION public.trg_season_xp_treasure_solve()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.add_season_xp(NEW.user_id, 'treasure_solve', NEW.id::text, 30);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_season_xp_treasure_solve ON public.treasure_progress;
CREATE TRIGGER trg_season_xp_treasure_solve AFTER INSERT ON public.treasure_progress
FOR EACH ROW EXECUTE FUNCTION public.trg_season_xp_treasure_solve();

-- Treasure jackpot claim → +200 XP
CREATE OR REPLACE FUNCTION public.trg_season_xp_jackpot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.add_season_xp(NEW.user_id, 'treasure_jackpot', NEW.id::text, 200);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_season_xp_jackpot ON public.treasure_jackpot_claims;
CREATE TRIGGER trg_season_xp_jackpot AFTER INSERT ON public.treasure_jackpot_claims
FOR EACH ROW EXECUTE FUNCTION public.trg_season_xp_jackpot();

-- Box revealed → +10 XP (status revealed)
CREATE OR REPLACE FUNCTION public.trg_season_xp_box_reveal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'revealed' AND (OLD.status IS DISTINCT FROM 'revealed') THEN
    PERFORM public.add_season_xp(NEW.user_id, 'box_reveal', NEW.id::text, 10);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_season_xp_box_reveal ON public.box_tickets;
CREATE TRIGGER trg_season_xp_box_reveal AFTER UPDATE OF status ON public.box_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_season_xp_box_reveal();

-- Pet XP gained → +5 XP per ledger entry (cap by ref id)
CREATE OR REPLACE FUNCTION public.trg_season_xp_pet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Skip self-loop from season_pass-granted pet xp
  IF NEW.source = 'season_pass' THEN RETURN NEW; END IF;
  PERFORM public.add_season_xp(NEW.user_id, 'pet_xp', NEW.id::text, 5);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_season_xp_pet ON public.pet_xp_ledger;
CREATE TRIGGER trg_season_xp_pet AFTER INSERT ON public.pet_xp_ledger
FOR EACH ROW EXECUTE FUNCTION public.trg_season_xp_pet();

-- Referral completed → +100 XP for both
CREATE OR REPLACE FUNCTION public.trg_season_xp_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL) THEN
    PERFORM public.add_season_xp(NEW.referrer_id, 'referral', NEW.id::text || ':r', 100);
    PERFORM public.add_season_xp(NEW.invitee_id, 'referral', NEW.id::text || ':i', 100);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_season_xp_referral ON public.viral_referrals;
CREATE TRIGGER trg_season_xp_referral AFTER UPDATE OF completed_at ON public.viral_referrals
FOR EACH ROW EXECUTE FUNCTION public.trg_season_xp_referral();