DO $$
DECLARE
  v_action_ids uuid[];
  v_batch uuid[];
  v_total int;
  v_offset int := 0;
  v_batch_size int := 100;
  v_url text;
  v_auth text;
BEGIN
  v_url := 'https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/pplp-batch-processor';
  v_auth := 'Bearer ' || current_setting('app.settings.service_role_key', true);

  -- Collect April 2026 v1.0.0 actions with NO mint request
  SELECT array_agg(a.id ORDER BY a.created_at)
  INTO v_action_ids
  FROM pplp_actions a
  WHERE a.created_at >= '2026-04-01'
    AND a.created_at < '2026-05-01'
    AND a.policy_version = '1.0.0'
    AND NOT EXISTS (
      SELECT 1 FROM pplp_mint_requests mr WHERE mr.action_id = a.id
    );

  v_total := COALESCE(array_length(v_action_ids, 1), 0);
  RAISE NOTICE 'Total April actions to rescore: %', v_total;

  WHILE v_offset < v_total LOOP
    v_batch := v_action_ids[v_offset+1 : LEAST(v_offset + v_batch_size, v_total)];
    
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
      ),
      body := jsonb_build_object(
        'action_ids', to_jsonb(v_batch),
        'force_rescore', true,
        'skip_side_effects', true,
        'batch_size', v_batch_size
      ),
      timeout_milliseconds := 300000
    );
    
    v_offset := v_offset + v_batch_size;
  END LOOP;

  RAISE NOTICE 'Dispatched % batches', CEIL(v_total::numeric / v_batch_size);
END $$;