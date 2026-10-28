CREATE OR REPLACE FUNCTION public.try_complete_referral()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_ref RECORD;
  v_amt INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_ref FROM public.viral_referrals WHERE invitee_id = v_user FOR UPDATE;
  IF v_ref IS NULL THEN RETURN jsonb_build_object('skipped','no_referral'); END IF;
  IF v_ref.completed_at IS NOT NULL THEN RETURN jsonb_build_object('skipped','already'); END IF;
  IF now() - v_ref.created_at > interval '24 hours' THEN
    RETURN jsonb_build_object('skipped','expired');
  END IF;
  v_amt := v_ref.reward_camly_each;

  INSERT INTO public.camly_coin_balances(user_id, balance, lifetime_earned) VALUES
    (v_ref.referrer_id, v_amt, v_amt),
    (v_ref.invitee_id,  v_amt, v_amt)
  ON CONFLICT (user_id) DO UPDATE SET
    balance = camly_coin_balances.balance + EXCLUDED.balance,
    lifetime_earned = camly_coin_balances.lifetime_earned + EXCLUDED.lifetime_earned,
    updated_at = now();

  INSERT INTO public.camly_coin_transactions(user_id, amount, transaction_type, description) VALUES
    (v_ref.referrer_id, v_amt, 'referral_reward', 'Bạn bè hoàn thành quest đầu tiên'),
    (v_ref.invitee_id,  v_amt, 'referral_reward', 'Cảm ơn đã được mời đến FUN');

  UPDATE public.viral_referrals SET completed_at = now() WHERE id = v_ref.id;
  RETURN jsonb_build_object('ok', true, 'reward_each', v_amt);
END;
$$;