CREATE TABLE IF NOT EXISTS public.pplp_mint_cycle_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL,
  cycle_number integer NOT NULL,
  cycle_type text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  total_mint_pool numeric NOT NULL,
  total_light_contribution numeric NOT NULL,
  max_share_per_user numeric NOT NULL,
  users_total integer NOT NULL,
  users_eligible integer NOT NULL,
  users_capped integer NOT NULL,
  total_fun_distributed numeric NOT NULL,
  max_fun_per_user numeric NOT NULL,
  min_fun_per_user numeric NOT NULL,
  allocations jsonb NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mint_snapshots_cycle ON public.pplp_mint_cycle_snapshots(cycle_number);

ALTER TABLE public.pplp_mint_cycle_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view snapshots"
ON public.pplp_mint_cycle_snapshots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create snapshots"
ON public.pplp_mint_cycle_snapshots FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));