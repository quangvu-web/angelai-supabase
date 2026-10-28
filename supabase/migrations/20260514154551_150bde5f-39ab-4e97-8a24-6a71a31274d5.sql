
-- Phần 1: Bảng ledger trần ngày + sửa add_camly_coins với clip mềm

CREATE TABLE IF NOT EXISTS public.daily_camly_cap_ledger (
  user_id uuid NOT NULL,
  cap_date date NOT NULL,
  earned_total bigint NOT NULL DEFAULT 0,
  clipped_total bigint NOT NULL DEFAULT 0,
  hit_cap_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cap_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_camly_cap_date ON public.daily_camly_cap_ledger(cap_date);

ALTER TABLE public.daily_camly_cap_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own cap ledger"
  ON public.daily_camly_cap_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins view all cap ledger"
  ON public.daily_camly_cap_ledger FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Sửa add_camly_coins: thêm hard cap 250K Camly/ngày (giờ VN)
CREATE OR REPLACE FUNCTION public.add_camly_coins(
  _user_id uuid,
  _amount bigint,
  _transaction_type coin_transaction_type,
  _description text DEFAULT NULL::text,
  _purity_score numeric DEFAULT NULL::numeric,
  _metadata jsonb DEFAULT '{}'::jsonb
)
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
BEGIN
  -- Có tính vào trần ngày không? (loại trừ di chuyển nội bộ)
  v_counts := _amount > 0 AND _transaction_type IN (
    'chat_reward','gratitude_reward','journal_reward','engagement_reward',
    'referral_bonus','challenge_reward','daily_login','bounty_reward',
    'build_idea','content_share','knowledge_upload','feedback_reward',
    'vision_reward','community_support','project_reward','pplp_reward',
    'lixi_claim','quest_reward','box_reveal'
  );

  IF v_counts THEN
    v_today := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

    -- Đọc cap từ config (default 250000)
    SELECT COALESCE((value)::text::bigint, 250000) INTO v_cap
    FROM public.pplp_parameter_config WHERE key = 'daily_camly_cap';
    IF v_cap IS NULL THEN v_cap := 250000; END IF;

    -- Lock & lấy earned hiện tại
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

    -- Cập nhật ledger
    UPDATE public.daily_camly_cap_ledger
    SET earned_total = earned_total + _amount,
        clipped_total = clipped_total + v_clipped,
        hit_cap_at = CASE WHEN v_clipped > 0 AND hit_cap_at IS NULL THEN now() ELSE hit_cap_at END,
        updated_at = now()
    WHERE user_id = _user_id AND cap_date = v_today;
  END IF;

  -- Insert/update balance (skip nếu amount=0 sau clip)
  IF _amount > 0 THEN
    INSERT INTO public.camly_coin_balances (user_id, balance, lifetime_earned)
    VALUES (_user_id, _amount, _amount)
    ON CONFLICT (user_id)
    DO UPDATE SET
      balance = camly_coin_balances.balance + _amount,
      lifetime_earned = camly_coin_balances.lifetime_earned + _amount,
      updated_at = now()
    RETURNING balance INTO new_balance;
  ELSE
    SELECT COALESCE(balance, 0) INTO new_balance
    FROM public.camly_coin_balances WHERE user_id = _user_id;
    new_balance := COALESCE(new_balance, 0);
  END IF;

  -- Luôn ghi transaction (kể cả amount=0 để FE biết bị cap)
  INSERT INTO public.camly_coin_transactions (
    user_id, amount, transaction_type, description, purity_score, metadata
  ) VALUES (
    _user_id, _amount, _transaction_type, _description, _purity_score, v_meta
  );

  RETURN new_balance;
END;
$function$;
