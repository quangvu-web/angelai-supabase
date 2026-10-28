CREATE TABLE IF NOT EXISTS public.sync_state (
  key text PRIMARY KEY,
  value_num bigint DEFAULT 0,
  value_text text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access" ON public.sync_state
  FOR ALL USING (false);