
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
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    -- allow admins via has_role if exists; fallback restrict to self
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

  RETURN jsonb_build_object(
    'ok', true,
    'total_bonus', v_total_bonus,
    'total_base', v_total_base,
    'total_received', v_total_received,
    'tx_count', v_tx_count,
    'per_tier', v_per_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ascension_bonus_stats(uuid) TO authenticated;
