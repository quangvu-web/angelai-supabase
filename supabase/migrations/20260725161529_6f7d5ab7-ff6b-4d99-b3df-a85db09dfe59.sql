DO $$
DECLARE jid INT;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'telegram-notify-21h-ict';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
    RAISE NOTICE 'Unscheduled telegram-notify-21h-ict (job %)', jid;
  END IF;
END $$;