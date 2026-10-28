
-- 1. Backfill pplp_accepted_at for users with successful mints
UPDATE public.profiles p
SET pplp_accepted_at = COALESCE(p.pplp_accepted_at, NOW()),
    pplp_version = COALESCE(p.pplp_version, '1.0')
WHERE p.pplp_accepted_at IS NULL
  AND p.user_id IN (
    SELECT DISTINCT actor_id FROM public.pplp_mint_requests
    WHERE status IN ('signed','minted')
  );

-- 2. Seed treasury vault wallet addresses (deterministic internal IDs)
UPDATE public.treasury_vaults SET wallet_address = 'angel-vault://reward_reserve' WHERE vault_name='reward_reserve' AND wallet_address IS NULL;
UPDATE public.treasury_vaults SET wallet_address = 'angel-vault://infrastructure' WHERE vault_name='infrastructure' AND wallet_address IS NULL;
UPDATE public.treasury_vaults SET wallet_address = 'angel-vault://community_growth' WHERE vault_name='community_growth' AND wallet_address IS NULL;
UPDATE public.treasury_vaults SET wallet_address = 'angel-vault://stability' WHERE vault_name='stability' AND wallet_address IS NULL;
UPDATE public.treasury_vaults SET wallet_address = 'angel-vault://strategic' WHERE vault_name='strategic' AND wallet_address IS NULL;

-- 3. Composite index on fun_distribution_logs(status, created_at)
CREATE INDEX IF NOT EXISTS idx_fun_dist_logs_status_created
  ON public.fun_distribution_logs (fund_processing_status, created_at);

-- 4. Helper RPC to get treasury overview
CREATE OR REPLACE FUNCTION public.get_treasury_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vaults jsonb;
  pending_stats jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'vault_name', vault_name,
    'vault_label', vault_label,
    'balance', balance,
    'wallet_address', wallet_address,
    'updated_at', updated_at
  ) ORDER BY vault_name)
  INTO vaults
  FROM public.treasury_vaults;

  SELECT jsonb_build_object(
    'pending_count', COUNT(*),
    'pending_user_amount', COALESCE(SUM(user_amount),0),
    'pending_total_reward', COALESCE(SUM(total_reward),0),
    'pending_genesis', COALESCE(SUM(genesis_amount),0),
    'pending_platform', COALESCE(SUM(platform_amount),0),
    'pending_partners', COALESCE(SUM(partners_amount),0)
  )
  INTO pending_stats
  FROM public.fun_distribution_logs
  WHERE fund_processing_status='pending';

  RETURN jsonb_build_object(
    'vaults', COALESCE(vaults, '[]'::jsonb),
    'pending_distributions', pending_stats,
    'generated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_treasury_status() TO authenticated, anon, service_role;
