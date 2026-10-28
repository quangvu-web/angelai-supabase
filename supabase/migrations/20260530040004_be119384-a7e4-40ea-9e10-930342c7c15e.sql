-- Phase 0: Angel Evolution Log (audit + rate limit source of truth)
CREATE TABLE public.angel_evolution_log (
  id uuid primary key default gen_random_uuid(),
  coordinator_id uuid not null,
  phase text not null default 'phase-1-single-file',
  tool_call jsonb not null,
  status text not null,
    -- 'rejected'|'rate_limited'|'dispatched'|'pr_opened'
    -- |'build_failed'|'merged'|'reverted'
  reject_reason text,
  pr_branch text,
  pr_url text,
  github_status int,
  build_passed boolean,
  reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX idx_evo_log_coord_created
  ON public.angel_evolution_log(coordinator_id, created_at DESC);

CREATE INDEX idx_evo_log_status_created
  ON public.angel_evolution_log(status, created_at DESC);

GRANT SELECT ON public.angel_evolution_log TO authenticated;
GRANT ALL    ON public.angel_evolution_log TO service_role;

ALTER TABLE public.angel_evolution_log ENABLE ROW LEVEL SECURITY;

-- Coordinator + Admin xem được mọi log (audit transparency).
-- KHÔNG có INSERT/UPDATE policy cho authenticated → chỉ service_role
-- (edge functions) được ghi. Defense-in-depth: client không thể tự fake log.
CREATE POLICY "coord_admin_read_log"
  ON public.angel_evolution_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinator')
    OR public.has_role(auth.uid(), 'admin')
  );

-- Trigger auto-update updated_at (dùng function đã có sẵn trong project)
CREATE TRIGGER trg_evo_log_updated_at
  BEFORE UPDATE ON public.angel_evolution_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Bật realtime để EvolutionLogPanel cập nhật live + EvolveCard poll status
ALTER PUBLICATION supabase_realtime ADD TABLE public.angel_evolution_log;
ALTER TABLE public.angel_evolution_log REPLICA IDENTITY FULL;