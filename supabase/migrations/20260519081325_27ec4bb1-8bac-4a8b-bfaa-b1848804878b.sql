
CREATE OR REPLACE FUNCTION public.add_camly_coins(_user_id uuid, _amount bigint, _transaction_type coin_transaction_type, _description text DEFAULT NULL::text, _purity_score numeric DEFAULT NULL::numeric, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_balance BIGINT;
  v_today date;
  v_cap bigint;
  v_earned bigint;
  v_remaining bigint;
  v_clipped bigint := 0;
  v_original bigint := _amount;
  v_meta jsonb := COALESCE(_metadata, '{}'::jsonb);
  v_counts boolean;
  v_bonus_eligible boolean;
  v_asc_tier smallint := 0;
  v_asc_bonus bigint := 0;
BEGIN
  -- Có tính vào trần ngày không? (loại trừ di chuyển nội bộ)
  v_counts := _amount > 0 AND _transaction_type IN (
    'chat_reward','gratitude_reward','journal_reward','engagement_reward',
    'referral_bonus','challenge_reward','daily_login','bounty_reward',
    'build_idea','content_share','knowledge_upload','feedback_reward',
    'vision_reward','community_support','project_reward','pplp_reward',
    'lixi_claim','quest_reward','box_reveal'
  );

  -- Bonus ascension chỉ áp cho reward thuần (loại trừ lixi/gift/admin)
  v_bonus_eligible := _amount > 0 AND _transaction_type IN (
    'chat_reward','gratitude_reward','journal_reward','engagement_reward',
    'referral_bonus','challenge_reward','daily_login','bounty_reward',
    'build_idea','content_share','knowledge_upload','feedback_reward',
    'vision_reward','community_support','project_reward','pplp_reward',
    'quest_reward','box_reveal','season_pass_reward','lantern_day',
    'lantern_weekly','riddle_solve','forge_reward'
  );

  IF v_bonus_eligible THEN
    SELECT COALESCE(ascension_tier, 0) INTO v_asc_tier
    FROM public.profiles WHERE user_id = _user_id;
    v_asc_tier := COALESCE(v_asc_tier, 0);
    IF v_asc_tier > 0 THEN
      -- +1% / tier, floor; chỉ cộng phần thêm
      v_asc_bonus := (_amount * v_asc_tier) / 100;
      IF v_asc_bonus > 0 THEN
        _amount := _amount + v_asc_bonus;
        v_meta := v_meta || jsonb_build_object(
          'ascension_tier', v_asc_tier,
          'ascension_bonus', v_asc_bonus,
          'base_amount', v_original
        );
      END IF;
    END IF;
  END IF;

  IF v_counts THEN
    v_today := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

    SELECT COALESCE((value)::text::bigint, 250000) INTO v_cap
    FROM public.pplp_parameter_config WHERE key = 'daily_camly_cap';
    IF v_cap IS NULL THEN v_cap := 250000; END IF;

    INSERT INTO public.daily_camly_cap_ledger (user_id, cap_date, earned_total)
    VALUES (_user_id, v_today, 0)
    ON CONFLICT (user_id, cap_date) DO NOTHING;

    SELECT earned_total INTO v_earned
    FROM public.daily_camly_cap_ledger
    WHERE user_id = _user_id AND cap_date = v_today
    FOR UPDATE;

    v_remaining := v_cap - COALESCE(v_earned, 0);

    IF v_remaining <= 0 THEN
      v_clipped := _amount;
      _amount := 0;
    ELSIF _amount > v_remaining THEN
      v_clipped := _amount - v_remaining;
      _amount := v_remaining;
    END IF;

    IF v_clipped > 0 THEN
      v_meta := v_meta || jsonb_build_object(
        'capped', true,
        'clipped_amount', v_clipped,
        'original_amount', v_original,
        'daily_cap', v_cap
      );
    END IF;

    UPDATE public.daily_camly_cap_ledger
    SET earned_total = earned_total + _amount,
        clipped_total = clipped_total + v_clipped,
        hit_cap_at = CASE WHEN v_clipped > 0 AND hit_cap_at IS NULL THEN now() ELSE hit_cap_at END,
        updated_at = now()
    WHERE user_id = _user_id AND cap_date = v_today;
  END IF;

  IF _amount > 0 THEN
    INSERT INTO public.camly_coin_balances (user_id, balance, lifetime_earned)
    VALUES (_user_id, _amount, _amount)
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance = camly_coin_balances.balance + _amount,
      lifetime_earned = camly_coin_balances.lifetime_earned + _amount,
      updated_at = now()
    RETURNING balance INTO new_balance;
  ELSIF _amount < 0 THEN
    -- Trừ Camly (forge_burn, spending…)
    INSERT INTO public.camly_coin_balances (user_id, balance, lifetime_earned)
    VALUES (_user_id, _amount, 0)
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance = camly_coin_balances.balance + _amount,
      updated_at = now()
    RETURNING balance INTO new_balance;
  ELSE
    SELECT COALESCE(balance, 0) INTO new_balance
    FROM public.camly_coin_balances WHERE user_id = _user_id;
    new_balance := COALESCE(new_balance, 0);
  END IF;

  INSERT INTO public.camly_coin_transactions (
    user_id, amount, transaction_type, description, purity_score, metadata
  ) VALUES (
    _user_id, _amount, _transaction_type, _description, _purity_score, v_meta
  );

  RETURN new_balance;
END;
$function$;
