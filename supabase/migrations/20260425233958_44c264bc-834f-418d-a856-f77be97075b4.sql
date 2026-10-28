CREATE TABLE IF NOT EXISTS public.system_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'success',
  processed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view system job runs" ON public.system_job_runs;
CREATE POLICY "Admins can view system job runs"
ON public.system_job_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_system_job_runs_job_started
ON public.system_job_runs (job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_job_runs_status_started
ON public.system_job_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_questions_created_at
ON public.chat_questions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_questions_user_hash_created
ON public.chat_questions (user_id, question_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_gifts_created_type
ON public.coin_gifts (created_at DESC, gift_type);

CREATE INDEX IF NOT EXISTS idx_coin_gifts_tx_hash
ON public.coin_gifts (tx_hash)
WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_feed_created
ON public.community_posts (created_at DESC, post_type);

CREATE INDEX IF NOT EXISTS idx_project_donations_created
ON public.project_donations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_donations_status_created
ON public.project_donations (status, created_at DESC)
WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_suspensions_user_until
ON public.user_suspensions (user_id, suspended_until DESC);

CREATE INDEX IF NOT EXISTS idx_user_suspensions_active_window
ON public.user_suspensions (user_id, suspended_at DESC)
WHERE lifted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_features_user_day_date_score
ON public.features_user_day (date, daily_light_score, user_id);

CREATE INDEX IF NOT EXISTS idx_features_user_day_user_date
ON public.features_user_day (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_pplp_actions_status_created_actor
ON public.pplp_actions (status, created_at, actor_id);

CREATE INDEX IF NOT EXISTS idx_pplp_actions_actor_created
ON public.pplp_actions (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pplp_scores_action_id
ON public.pplp_scores (action_id);

CREATE INDEX IF NOT EXISTS idx_pplp_mint_requests_status_created
ON public.pplp_mint_requests (status, created_at DESC)
WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sbt_onchain_queue_pending_network
ON public.sbt_onchain_queue (network, created_at)
WHERE status = 'pending';

DO $$
DECLARE
  realtime_table text;
BEGIN
  FOREACH realtime_table IN ARRAY ARRAY[
    'project_donations',
    'light_score_snapshots',
    'features_user_day',
    'pplp_mint_allocations',
    'pplp_mint_cycles',
    'user_suspensions',
    'attestation_log',
    'pending_rewards'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = realtime_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', realtime_table);
    END IF;
  END LOOP;
END $$;