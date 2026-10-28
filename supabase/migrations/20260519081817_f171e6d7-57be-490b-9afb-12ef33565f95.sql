
CREATE OR REPLACE FUNCTION public.get_ascension_bonus_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bonus numeric := 0;
  v_total_base numeric := 0;
  v_total_received numeric := 0;
  v_tx_count integer := 0;
  v_per_tier jsonb;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_cap bigint;
  v_earned bigint := 0;
  v_clipped bigint := 0;
  v_hit_cap_at timestamptz;
  v_today_capped_tx integer := 0;
  v_today_clipped_bonus numeric := 0;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
    END IF;
  END IF;

  SELECT
    COALESCE(SUM((metadata->>'ascension_bonus')::numeric), 0),
    COALESCE(SUM((metadata->>'base_amount')::numeric), 0),
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO v_total_bonus, v_total_base, v_total_received, v_tx_count
  FROM public.camly_coin_transactions
  WHERE user_id = p_user_id
    AND amount > 0
    AND (metadata->>'ascension_bonus') IS NOT NULL
    AND (metadata->>'ascension_bonus')::numeric > 0;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY (t.tier)::int), '[]'::jsonb)
  INTO v_per_tier
  FROM (
    SELECT
      COALESCE(metadata->>'ascension_tier', '0') AS tier,
      SUM((metadata->>'ascension_bonus')::numeric)::bigint AS bonus,
      SUM(amount)::bigint AS received,
      COUNT(*)::int AS tx_count
    FROM public.camly_coin_transactions
    WHERE user_id = p_user_id
      AND amount > 0
      AND (metadata->>'ascension_bonus') IS NOT NULL
      AND (metadata->>'ascension_bonus')::numeric > 0
    GROUP BY metadata->>'ascension_tier'
  ) t;

  -- Today's cap status
  SELECT COALESCE((value)::text::bigint, 300000) INTO v_cap
  FROM public.pplp_parameter_config WHERE key = 'daily_camly_cap';
  IF v_cap IS NULL THEN v_cap := 300000; END IF;

  SELECT earned_total, clipped_total, hit_cap_at
  INTO v_earned, v_clipped, v_hit_cap_at
  FROM public.daily_camly_cap_ledger
  WHERE user_id = p_user_id AND cap_date = v_today;

  -- Today's capped transactions count + clipped bonus portion
  SELECT
    COUNT(*) FILTER (WHERE (metadata->>'capped')::boolean = true),
    COALESCE(SUM(
      CASE
        WHEN (metadata->>'capped')::boolean = true
         AND (metadata->>'ascension_bonus') IS NOT NULL
         AND (metadata->>'ascension_bonus')::numeric > 0
        THEN LEAST((metadata->>'clipped_amount')::numeric, (metadata->>'ascension_bonus')::numeric)
        ELSE 0
      END
    ), 0)
  INTO v_today_capped_tx, v_today_clipped_bonus
  FROM public.camly_coin_transactions
  WHERE user_id = p_user_id
    AND created_at >= (v_today::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh');

  RETURN jsonb_build_object(
    'ok', true,
    'total_bonus', v_total_bonus,
    'total_base', v_total_base,
    'total_received', v_total_received,
    'tx_count', v_tx_count,
    'per_tier', v_per_tier,
    'today', jsonb_build_object(
      'cap', v_cap,
      'earned', COALESCE(v_earned, 0),
      'clipped', COALESCE(v_clipped, 0),
      'remaining', GREATEST(v_cap - COALESCE(v_earned, 0), 0),
      'hit_cap_at', v_hit_cap_at,
      'capped_tx_count', v_today_capped_tx,
      'clipped_bonus_estimate', v_today_clipped_bonus
    )
  );
END;
$$;
