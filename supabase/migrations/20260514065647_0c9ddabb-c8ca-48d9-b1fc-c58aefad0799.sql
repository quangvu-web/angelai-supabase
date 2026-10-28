CREATE TABLE IF NOT EXISTS public.quest_rotate_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  mode text NOT NULL CHECK (mode IN ('single','cron')),
  assigned_count int NOT NULL DEFAULT 0,
  users_count int NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quest_rotate_runs_user_created
  ON public.quest_rotate_runs (user_id, created_at DESC);

ALTER TABLE public.quest_rotate_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rotate runs"
  ON public.quest_rotate_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view cron runs (no user)"
  ON public.quest_rotate_runs FOR SELECT
  TO authenticated
  USING (user_id IS NULL);
