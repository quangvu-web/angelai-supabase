CREATE OR REPLACE FUNCTION public.run_cross_account_scan()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_content_results RECORD;
  v_timing_results RECORD;
  v_wallet_results RECORD;
  v_content_count INTEGER := 0;
  v_timing_count INTEGER := 0;
  v_wallet_count INTEGER := 0;
  v_user_id UUID;
BEGIN
  -- 1. Cross-account content similarity
  FOR v_content_results IN SELECT * FROM detect_cross_account_content_similarity() LOOP
    FOREACH v_user_id IN ARRAY v_content_results.user_ids LOOP
      -- Skip whitelisted users
      IF EXISTS (SELECT 1 FROM fraud_whitelist WHERE user_id = v_user_id) THEN
        CONTINUE;
      END IF;
      
      INSERT INTO pplp_fraud_signals (actor_id, signal_type, severity, details, source)
      VALUES (
        v_user_id,
        'cross_account',
        CASE WHEN v_content_results.user_count >= 5 THEN 4 ELSE 3 END,
        jsonb_build_object(
          'reason', 'Cross-account content similarity detected',
          'content_hash', v_content_results.content_hash,
          'user_count', v_content_results.user_count,
          'sample', left(v_content_results.sample_content, 100)
        ),
        'SYSTEM'
      )
      ON CONFLICT DO NOTHING;
      v_content_count := v_content_count + 1;
    END LOOP;
  END LOOP;

  -- 2. Coordinated timing detection
  FOR v_timing_results IN SELECT * FROM detect_coordinated_timing() LOOP
    FOREACH v_user_id IN ARRAY v_timing_results.user_ids LOOP
      -- Skip whitelisted users
      IF EXISTS (SELECT 1 FROM fraud_whitelist WHERE user_id = v_user_id) THEN
        CONTINUE;
      END IF;
      
      INSERT INTO pplp_fraud_signals (actor_id, signal_type, severity, details, source)
      VALUES (
        v_user_id,
        'coordinated_timing',
        CASE WHEN v_timing_results.pattern_days >= 5 THEN 4 ELSE 3 END,
        jsonb_build_object(
          'reason', 'Coordinated timing pattern detected',
          'user_count', v_timing_results.user_count,
          'pattern_days', v_timing_results.pattern_days,
          'time_window', v_timing_results.time_window
        ),
        'SYSTEM'
      )
      ON CONFLICT DO NOTHING;
      v_timing_count := v_timing_count + 1;
    END LOOP;
  END LOOP;

  -- 3. Wallet cluster detection
  FOR v_wallet_results IN SELECT * FROM detect_wallet_clusters() LOOP
    FOREACH v_user_id IN ARRAY v_wallet_results.sender_user_ids LOOP
      -- Skip whitelisted users
      IF EXISTS (SELECT 1 FROM fraud_whitelist WHERE user_id = v_user_id) THEN
        CONTINUE;
      END IF;
      
      INSERT INTO pplp_fraud_signals (actor_id, signal_type, severity, details, source)
      VALUES (
        v_user_id,
        'wallet_cluster',
        CASE WHEN v_wallet_results.sender_count >= 5 THEN 4 ELSE 3 END,
        jsonb_build_object(
          'reason', 'Wallet cluster detected',
          'collector_wallet', v_wallet_results.collector_wallet,
          'sender_count', v_wallet_results.sender_count,
          'total_amount', v_wallet_results.total_amount
        ),
        'SYSTEM'
      )
      ON CONFLICT DO NOTHING;
      v_wallet_count := v_wallet_count + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'content_signals', v_content_count,
    'timing_signals', v_timing_count,
    'wallet_signals', v_wallet_count,
    'total_signals', v_content_count + v_timing_count + v_wallet_count,
    'scanned_at', now()
  );
END;
$function$;