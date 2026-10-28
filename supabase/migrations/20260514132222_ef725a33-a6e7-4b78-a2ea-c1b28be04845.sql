CREATE TABLE public.viral_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  invitee_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  reward_camly_each INT NOT NULL DEFAULT 100,
  CHECK (referrer_id <> invitee_id)
);
CREATE INDEX idx_viral_referrer ON public.viral_referrals(referrer_id);

ALTER TABLE public.viral_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own referrals" ON public.viral_referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = invitee_id);

-- Register referral (called by invitee right after signup)
CREATE OR REPLACE FUNCTION public.register_referral(p_referrer UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_user_created TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF v_user = p_referrer THEN RETURN jsonb_build_object('skipped','self'); END IF;

  SELECT created_at INTO v_user_created FROM auth.users WHERE id = v_user;
  IF v_user_created IS NULL OR now() - v_user_created > interval '24 hours' THEN
    RETURN jsonb_build_object('skipped','too_late');
  END IF;

  IF EXISTS (SELECT 1 FROM public.viral_referrals WHERE invitee_id = v_user) THEN
    RETURN jsonb_build_object('skipped','exists');
  END IF;

  INSERT INTO public.viral_referrals(referrer_id, invitee_id) VALUES (p_referrer, v_user);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Try to complete referral (called when invitee finishes their first quest)
CREATE OR REPLACE FUNCTION public.try_complete_referral()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_ref RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_ref FROM public.viral_referrals WHERE invitee_id = v_user FOR UPDATE;
  IF v_ref IS NULL THEN RETURN jsonb_build_object('skipped','no_referral'); END IF;
  IF v_ref.completed_at IS NOT NULL THEN RETURN jsonb_build_object('skipped','already'); END IF;
  IF now() - v_ref.created_at > interval '24 hours' THEN
    RETURN jsonb_build_object('skipped','expired');
  END IF;

  -- Reward both sides via user_camly_coin upsert
  INSERT INTO public.user_camly_coin(user_id, balance) VALUES
    (v_ref.referrer_id, v_ref.reward_camly_each),
    (v_ref.invitee_id,  v_ref.reward_camly_each)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_camly_coin.balance + EXCLUDED.balance;

  UPDATE public.viral_referrals SET completed_at = now() WHERE id = v_ref.id;
  RETURN jsonb_build_object('ok', true, 'reward_each', v_ref.reward_camly_each);
END;
$$;