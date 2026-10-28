-- Audit log table cho threshold changes
CREATE TABLE IF NOT EXISTS public.pplp_threshold_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  platform_id TEXT NOT NULL DEFAULT 'ALL',
  environment TEXT NOT NULL DEFAULT 'production',
  old_thresholds JSONB,
  new_thresholds JSONB NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_threshold_audit_changed_at ON public.pplp_threshold_audit(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_threshold_audit_action ON public.pplp_threshold_audit(action_type, platform_id);

ALTER TABLE public.pplp_threshold_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view threshold audit"
  ON public.pplp_threshold_audit FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can insert threshold audit"
  ON public.pplp_threshold_audit FOR INSERT
  WITH CHECK (is_admin());

-- RPC: cập nhật threshold + ghi audit
CREATE OR REPLACE FUNCTION public.admin_update_action_thresholds(
  _action_type TEXT,
  _platform_id TEXT,
  _new_thresholds JSONB,
  _reason TEXT DEFAULT NULL,
  _environment TEXT DEFAULT 'production'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
  v_audit_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  SELECT thresholds INTO v_old
  FROM public.pplp_action_caps
  WHERE action_type = _action_type AND platform_id = _platform_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Action % / platform % not found', _action_type, _platform_id;
  END IF;

  UPDATE public.pplp_action_caps
  SET thresholds = _new_thresholds,
      updated_at = now()
  WHERE action_type = _action_type AND platform_id = _platform_id;

  INSERT INTO public.pplp_threshold_audit
    (action_type, platform_id, environment, old_thresholds, new_thresholds, reason, changed_by)
  VALUES
    (_action_type, _platform_id, _environment, v_old, _new_thresholds, _reason, auth.uid())
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'success', true,
    'audit_id', v_audit_id,
    'old_thresholds', v_old,
    'new_thresholds', _new_thresholds
  );
END;
$$;

-- RPC: list audit log
CREATE OR REPLACE FUNCTION public.admin_list_threshold_audit(
  _limit INT DEFAULT 200
) RETURNS TABLE (
  id UUID,
  action_type TEXT,
  platform_id TEXT,
  environment TEXT,
  old_thresholds JSONB,
  new_thresholds JSONB,
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  RETURN QUERY
  SELECT a.id, a.action_type, a.platform_id, a.environment,
         a.old_thresholds, a.new_thresholds, a.reason,
         a.changed_by, a.changed_at
  FROM public.pplp_threshold_audit a
  ORDER BY a.changed_at DESC
  LIMIT _limit;
END;
$$;