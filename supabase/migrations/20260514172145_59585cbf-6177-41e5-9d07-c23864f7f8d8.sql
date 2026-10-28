CREATE OR REPLACE FUNCTION public.unlock_season_premium()
RETURNS jsonb
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

  INSERT INTO public.user_season_pass(user_id, season_id) VALUES (v_user, v_season.id)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  SELECT * INTO v_pass FROM public.user_season_pass
  WHERE user_id = v_user AND season_id = v_season.id;

  IF v_pass.is_premium THEN
    RETURN jsonb_build_object('already_premium', true);
  END IF;

  SELECT balance INTO v_balance FROM public.camly_coin_balances WHERE user_id = v_user;
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