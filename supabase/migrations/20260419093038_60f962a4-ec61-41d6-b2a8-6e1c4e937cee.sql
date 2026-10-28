CREATE OR REPLACE FUNCTION public.get_operational_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actions_24h int;
  v_scored_24h int;
  v_rejected_24h int;
  v_pending_actions int;
  v_pending_logs int;
  v_settled_logs int;
  v_settled_fun numeric;
  v_pending_audits int;
  v_resolved_audits int;
  v_treasury jsonb;
  v_treasury_total numeric;
  v_last_settler timestamptz;
  v_last_audit timestamptz;
BEGIN
  SELECT COUNT(*) INTO v_actions_24h FROM pplp_actions WHERE created_at > now() - interval '24 hours';
  SELECT COUNT(*) INTO v_scored_24h FROM pplp_actions WHERE created_at > now() - interval '24 hours' AND status = 'scored';
  SELECT COUNT(*) INTO v_rejected_24h FROM pplp_actions WHERE created_at > now() - interval '24 hours' AND status = 'rejected';
  SELECT COUNT(*) INTO v_pending_actions FROM pplp_actions WHERE status = 'pending';

  SELECT COUNT(*) INTO v_pending_logs FROM fun_distribution_logs WHERE fund_processing_status = 'pending';
  SELECT COUNT(*), COALESCE(SUM(total_reward),0) INTO v_settled_logs, v_settled_fun
  FROM fun_distribution_logs WHERE fund_processing_status = 'settled';

  SELECT COUNT(*) INTO v_pending_audits FROM pplp_audits WHERE audit_status = 'pending';
  SELECT COUNT(*) INTO v_resolved_audits FROM pplp_audits WHERE audit_status <> 'pending';

  SELECT jsonb_agg(jsonb_build_object('vault_name', vault_name, 'balance', balance) ORDER BY balance DESC),
         COALESCE(SUM(balance),0)
  INTO v_treasury, v_treasury_total
  FROM treasury_vaults;

  SELECT MAX(fund_processed_at) INTO v_last_settler FROM fun_distribution_logs WHERE fund_processing_status = 'settled';
  SELECT MAX(completed_at) INTO v_last_audit FROM pplp_audits WHERE audit_status <> 'pending';

  RETURN jsonb_build_object(
    'actions_24h', v_actions_24h,
    'scored_24h', v_scored_24h,
    'rejected_24h', v_rejected_24h,
    'pending_actions', v_pending_actions,
    'success_rate', CASE WHEN v_actions_24h > 0 THEN round((v_scored_24h::numeric / v_actions_24h) * 100, 1) ELSE 0 END,
    'pending_distributions', v_pending_logs,
    'settled_distributions', v_settled_logs,
    'total_settled_fun', v_settled_fun,
    'pending_audits', v_pending_audits,
    'resolved_audits', v_resolved_audits,
    'treasury_vaults', COALESCE(v_treasury, '[]'::jsonb),
    'treasury_total', v_treasury_total,
    'last_settler_run', v_last_settler,
    'last_audit_run', v_last_audit,
    'computed_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operational_health() TO authenticated, service_role;