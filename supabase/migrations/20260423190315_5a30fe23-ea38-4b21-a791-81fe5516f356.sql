DO $$
DECLARE
  v_rec record;
  v_url text := 'https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/pplp-score-action';
  v_auth text;
  v_count int := 0;
BEGIN
  v_auth := 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1);

  FOR v_rec IN
    SELECT a.id
    FROM pplp_actions a
    WHERE a.created_at >= '2026-04-01'
      AND a.created_at < '2026-05-01'
      AND a.policy_version = '1.0.0'
      AND NOT EXISTS (SELECT 1 FROM pplp_mint_requests mr WHERE mr.action_id = a.id)
    ORDER BY a.created_at
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', v_auth
      ),
      body := jsonb_build_object(
        'action_id', v_rec.id,
        'force_rescore', true,
        'skip_side_effects', true
      ),
      timeout_milliseconds := 60000
    );
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Dispatched % rescore requests', v_count;
END $$;