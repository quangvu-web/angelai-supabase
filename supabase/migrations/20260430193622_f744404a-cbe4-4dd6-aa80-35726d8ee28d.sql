-- Enable extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Reports table to store verification history
CREATE TABLE IF NOT EXISTS public.anti_whale_cap_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID,
  cycle_number INTEGER,
  period TEXT,
  status TEXT,
  total_pool NUMERIC NOT NULL,
  user_reward_pool NUMERIC NOT NULL,
  configured_ratio NUMERIC NOT NULL,
  expected_ratio NUMERIC NOT NULL DEFAULT 0.03,
  max_fun_per_user NUMERIC NOT NULL,
  pct_of_total_pool NUMERIC,
  ratio_match BOOLEAN NOT NULL,
  verification TEXT NOT NULL,
  raw_report JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_awcr_cycle_id ON public.anti_whale_cap_reports(cycle_id);
CREATE INDEX IF NOT EXISTS idx_awcr_generated_at ON public.anti_whale_cap_reports(generated_at DESC);

ALTER TABLE public.anti_whale_cap_reports ENABLE ROW LEVEL SECURITY;

-- Admins only can read
DROP POLICY IF EXISTS "Admins can view anti whale cap reports" ON public.anti_whale_cap_reports;
CREATE POLICY "Admins can view anti whale cap reports"
ON public.anti_whale_cap_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Service role inserts via edge function (no policy needed; service role bypasses RLS)
