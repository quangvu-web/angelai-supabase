
-- 1. Atomic transfer function for Camly Coin
CREATE OR REPLACE FUNCTION public.transfer_camly_coin(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_amount BIGINT,
  p_description_sender TEXT DEFAULT NULL,
  p_description_receiver TEXT DEFAULT NULL,
  p_metadata_sender JSONB DEFAULT '{}',
  p_metadata_receiver JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_balance BIGINT;
  v_sender_lifetime_spent BIGINT;
  v_receiver_balance BIGINT;
  v_receiver_lifetime_earned BIGINT;
  v_receiver_exists BOOLEAN;
BEGIN
  -- Validate amount
  IF p_amount < 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số lượng tối thiểu là 100');
  END IF;
  
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không thể tặng cho chính mình');
  END IF;

  -- Lock sender row FOR UPDATE to prevent race conditions
  SELECT balance, lifetime_spent INTO v_sender_balance, v_sender_lifetime_spent
  FROM camly_coin_balances
  WHERE user_id = p_sender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Không tìm thấy số dư người gửi');
  END IF;

  IF v_sender_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Số dư không đủ. Hiện có: ' || v_sender_balance);
  END IF;

  -- Deduct from sender
  UPDATE camly_coin_balances
  SET balance = balance - p_amount,
      lifetime_spent = lifetime_spent + p_amount,
      updated_at = now()
  WHERE user_id = p_sender_id;

  -- Add to receiver (upsert)
  INSERT INTO camly_coin_balances (user_id, balance, lifetime_earned)
  VALUES (p_receiver_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET
    balance = camly_coin_balances.balance + p_amount,
    lifetime_earned = camly_coin_balances.lifetime_earned + p_amount,
    updated_at = now();

  -- Record transactions
  INSERT INTO camly_coin_transactions (user_id, amount, transaction_type, description, metadata)
  VALUES
    (p_sender_id, -p_amount, 'gift_sent', p_description_sender, p_metadata_sender),
    (p_receiver_id, p_amount, 'gift_received', p_description_receiver, p_metadata_receiver);

  RETURN jsonb_build_object(
    'success', true,
    'sender_new_balance', v_sender_balance - p_amount
  );
END;
$$;

-- 2. Function to increment pplp_user_tiers atomically  
CREATE OR REPLACE FUNCTION public.increment_user_tier_stats(
  p_user_id UUID,
  p_is_pass BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO pplp_user_tiers (user_id, total_actions_scored, passed_actions, failed_actions, updated_at)
  VALUES (
    p_user_id,
    1,
    CASE WHEN p_is_pass THEN 1 ELSE 0 END,
    CASE WHEN p_is_pass THEN 0 ELSE 1 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_actions_scored = pplp_user_tiers.total_actions_scored + 1,
    passed_actions = pplp_user_tiers.passed_actions + CASE WHEN p_is_pass THEN 1 ELSE 0 END,
    failed_actions = pplp_user_tiers.failed_actions + CASE WHEN p_is_pass THEN 0 ELSE 1 END,
    updated_at = now();
END;
$$;

-- 3. Add source_ref column for duplicate checking in distribute-fun-camly
ALTER TABLE public.camly_coin_transactions ADD COLUMN IF NOT EXISTS source_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_camly_tx_source_ref ON public.camly_coin_transactions (source_ref) WHERE source_ref IS NOT NULL;
