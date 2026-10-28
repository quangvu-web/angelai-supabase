-- ============================================
-- PHASE 2: Backlog Audit & Pending Claim Banner
-- ============================================

-- 1. Backlog audit table
CREATE TABLE IF NOT EXISTS public.pplp_backlog_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  audit_group TEXT NOT NULL CHECK (audit_group IN ('Aa','Ab','Ac')),
  pending_fun BIGINT NOT NULL DEFAULT 0,
  allocation_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  audit_run_id UUID NOT NULL DEFAULT gen_random_uuid()
);

CREATE INDEX IF NOT EXISTS idx_backlog_audit_user ON public.pplp_backlog_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_backlog_audit_group ON public.pplp_backlog_audit(audit_group);
CREATE INDEX IF NOT EXISTS idx_backlog_audit_run ON public.pplp_backlog_audit(audit_run_id);
CREATE INDEX IF NOT EXISTS idx_backlog_audit_audited_at ON public.pplp_backlog_audit(audited_at DESC);

-- Unique latest row per user (we'll upsert by user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_backlog_audit_user_unique ON public.pplp_backlog_audit(user_id);

ALTER TABLE public.pplp_backlog_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage backlog audit" ON public.pplp_backlog_audit;
CREATE POLICY "Admins can manage backlog audit"
  ON public.pplp_backlog_audit FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users can read own backlog audit" ON public.pplp_backlog_audit;
CREATE POLICY "Users can read own backlog audit"
  ON public.pplp_backlog_audit FOR SELECT
  USING (auth.uid() = user_id);

-- 2. RPC: get_my_pending_claim — for the banner (any authenticated user)
CREATE OR REPLACE FUNCTION public.get_my_pending_claim()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_total_fun BIGINT := 0;
  v_alloc_count INT := 0;
  v_oldest TIMESTAMPTZ;
  v_audit RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('total_fun', 0, 'allocation_count', 0);
  END IF;

  SELECT
    COALESCE(SUM(fun_allocated), 0),
    COUNT(*),
    MIN(created_at)
  INTO v_total_fun, v_alloc_count, v_oldest
  FROM public.pplp_mint_allocations
  WHERE user_id = v_uid
    AND status = 'pending'
    AND fun_allocated > 0;

  SELECT audit_group, notes INTO v_audit
  FROM public.pplp_backlog_audit
  WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'total_fun', v_total_fun,
    'allocation_count', v_alloc_count,
    'oldest_allocation_at', v_oldest,
    'audit_group', COALESCE(v_audit.audit_group, NULL),
    'notes', v_audit.notes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_claim() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pending_claim() TO authenticated;

-- 3. RPC: get_backlog_audit_summary — admin overview
CREATE OR REPLACE FUNCTION public.get_backlog_audit_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_summary JSONB;
  v_last_audit TIMESTAMPTZ;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT MAX(audited_at) INTO v_last_audit FROM public.pplp_backlog_audit;

  SELECT jsonb_build_object(
    'last_audit_at', v_last_audit,
    'groups', COALESCE(jsonb_object_agg(audit_group, group_data), '{}'::jsonb),
    'total_users', COALESCE(SUM((group_data->>'user_count')::int), 0),
    'total_pending_fun', COALESCE(SUM((group_data->>'total_fun')::bigint), 0)
  )
  INTO v_summary
  FROM (
    SELECT
      audit_group,
      jsonb_build_object(
        'user_count', COUNT(*),
        'total_fun', COALESCE(SUM(pending_fun), 0),
        'total_allocations', COALESCE(SUM(allocation_count), 0)
      ) AS group_data
    FROM public.pplp_backlog_audit
    GROUP BY audit_group
  ) sub;

  RETURN COALESCE(v_summary, jsonb_build_object('groups', '{}'::jsonb, 'total_users', 0));
END;
$$;

REVOKE ALL ON FUNCTION public.get_backlog_audit_summary() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_backlog_audit_summary() TO authenticated;