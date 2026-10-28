-- Live telemetry RPC: returns aggregated metrics for last 24h, hourly buckets
CREATE OR REPLACE FUNCTION public.get_trust_live_telemetry()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_result jsonb;
  v_dids_24h int;
  v_atts_24h int;
  v_tier_ups_24h int;
  v_mint_blocked_24h int;
  v_active_t1plus int;
  v_total_dids int;
  v_hourly_dids jsonb;
  v_hourly_atts jsonb;
  v_top_reasons jsonb;
  v_recent_events jsonb;
BEGIN
  -- Admin gate
  SELECT public.has_role(auth.uid(), 'admin') INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('error', 'forbidden: admin only');
  END IF;

  -- 24h counters
  SELECT count(*) INTO v_dids_24h
    FROM public.user_dids WHERE created_at >= now() - interval '24 hours';

  SELECT count(*) INTO v_atts_24h
    FROM public.attestation_log WHERE created_at >= now() - interval '24 hours';

  SELECT count(*) INTO v_tier_ups_24h
    FROM public.did_events
    WHERE created_at >= now() - interval '24 hours'
      AND event_type IN ('tier_up','tier_change','trust_tier_up');

  SELECT count(*) INTO v_mint_blocked_24h
    FROM public.pplp_mint_requests
    WHERE created_at >= now() - interval '24 hours'
      AND status IN ('blocked','rejected','denied');

  SELECT count(*) INTO v_active_t1plus
    FROM public.trust_profile WHERE trust_tier IN ('T1','T2','T3','T4');

  SELECT count(*) INTO v_total_dids FROM public.user_dids;

  -- Hourly buckets (last 24h) for DIDs
  SELECT jsonb_agg(jsonb_build_object('hour', h, 'count', COALESCE(c, 0)) ORDER BY h)
  INTO v_hourly_dids
  FROM (
    SELECT generate_series(
      date_trunc('hour', now() - interval '23 hours'),
      date_trunc('hour', now()),
      interval '1 hour'
    ) AS h
  ) hours
  LEFT JOIN (
    SELECT date_trunc('hour', created_at) AS hr, count(*)::int AS c
      FROM public.user_dids
      WHERE created_at >= now() - interval '24 hours'
      GROUP BY 1
  ) d ON d.hr = hours.h;

  -- Hourly buckets for attestations
  SELECT jsonb_agg(jsonb_build_object('hour', h, 'count', COALESCE(c, 0)) ORDER BY h)
  INTO v_hourly_atts
  FROM (
    SELECT generate_series(
      date_trunc('hour', now() - interval '23 hours'),
      date_trunc('hour', now()),
      interval '1 hour'
    ) AS h
  ) hours
  LEFT JOIN (
    SELECT date_trunc('hour', created_at) AS hr, count(*)::int AS c
      FROM public.attestation_log
      WHERE created_at >= now() - interval '24 hours'
      GROUP BY 1
  ) a ON a.hr = hours.h;

  -- Top mint-block reasons (last 7 days)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', reason, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_top_reasons
  FROM (
    SELECT COALESCE(NULLIF(on_chain_error, ''), status) AS reason, count(*)::int AS cnt
      FROM public.pplp_mint_requests
      WHERE created_at >= now() - interval '7 days'
        AND status IN ('blocked','rejected','denied','failed')
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 5
  ) t;

  -- Last 10 trust events feed
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'event_type', event_type,
    'created_at', created_at,
    'did_id', did_id,
    'event_data', event_data
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_recent_events
  FROM (
    SELECT event_type, created_at, did_id, event_data
      FROM public.did_events
      ORDER BY created_at DESC
      LIMIT 10
  ) r;

  v_result := jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object(
      'dids_24h', v_dids_24h,
      'attestations_24h', v_atts_24h,
      'tier_ups_24h', v_tier_ups_24h,
      'mint_blocked_24h', v_mint_blocked_24h,
      'active_t1plus', v_active_t1plus,
      'total_dids', v_total_dids,
      'tier_up_rate', CASE WHEN v_total_dids > 0 
        THEN round((v_active_t1plus::numeric / v_total_dids::numeric) * 100, 2) 
        ELSE 0 END
    ),
    'hourly_dids', COALESCE(v_hourly_dids, '[]'::jsonb),
    'hourly_attestations', COALESCE(v_hourly_atts, '[]'::jsonb),
    'top_block_reasons', v_top_reasons,
    'recent_events', v_recent_events
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trust_live_telemetry() TO authenticated;