
-- =============================================
-- PHASE 2: Vesting + Treasury Vaults
-- =============================================

-- 1. Treasury Vaults
CREATE TABLE public.treasury_vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_name TEXT UNIQUE NOT NULL,
  vault_label TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  wallet_address TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.treasury_vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view treasury_vaults"
  ON public.treasury_vaults FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage treasury_vaults"
  ON public.treasury_vaults FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Treasury Flows (audit trail)
CREATE TABLE public.treasury_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_vault TEXT,
  destination_vault TEXT,
  amount NUMERIC NOT NULL,
  reason TEXT,
  epoch_id TEXT,
  triggered_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_treasury_flows_epoch ON public.treasury_flows(epoch_id);
CREATE INDEX idx_treasury_flows_vaults ON public.treasury_flows(source_vault, destination_vault);

ALTER TABLE public.treasury_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view treasury_flows"
  ON public.treasury_flows FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert treasury_flows"
  ON public.treasury_flows FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Reward Vesting Schedules
CREATE TABLE public.reward_vesting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  epoch_id TEXT NOT NULL,
  cycle_id UUID,
  total_amount NUMERIC NOT NULL,
  instant_amount NUMERIC NOT NULL,
  locked_amount NUMERIC NOT NULL,
  unlocked_so_far NUMERIC NOT NULL DEFAULT 0,
  claimable_amount NUMERIC NOT NULL DEFAULT 0,
  claimed_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  unlock_method TEXT NOT NULL DEFAULT 'time_and_contribution',
  base_vesting_days INTEGER NOT NULL DEFAULT 28,
  unlock_check_interval_days INTEGER NOT NULL DEFAULT 7,
  last_unlock_check_at TIMESTAMPTZ,
  next_unlock_at TIMESTAMPTZ,
  fully_unlocked_at TIMESTAMPTZ,
  dormant_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, epoch_id)
);

CREATE INDEX idx_vesting_user ON public.reward_vesting_schedules(user_id);
CREATE INDEX idx_vesting_status ON public.reward_vesting_schedules(status);
CREATE INDEX idx_vesting_next_unlock ON public.reward_vesting_schedules(next_unlock_at);

ALTER TABLE public.reward_vesting_schedules ENABLE ROW LEVEL SECURITY;

-- Users can view their own vesting schedules
CREATE POLICY "Users can view own vesting"
  ON public.reward_vesting_schedules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all vesting"
  ON public.reward_vesting_schedules FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage
CREATE POLICY "Admins can manage vesting"
  ON public.reward_vesting_schedules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Seed treasury vaults
INSERT INTO public.treasury_vaults (vault_name, vault_label, description) VALUES
  ('reward_reserve', 'Reward Reserve Vault', 'Bổ sung cho reward pool các epoch tương lai'),
  ('infrastructure', 'Infrastructure Vault', 'Nuôi backend, A.I., cloud, moderation, data infra'),
  ('community_growth', 'Community Growth Vault', 'Hỗ trợ community, contributor programs, training'),
  ('stability', 'Stability Vault', 'Đệm ổn định khi hệ có biến động hành vi'),
  ('strategic', 'Strategic Expansion Vault', 'Dùng cho platform mới, đối tác mới, growth campaigns');

-- 5. Updated_at trigger for vesting
CREATE TRIGGER update_vesting_updated_at
  BEFORE UPDATE ON public.reward_vesting_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_treasury_vaults_updated_at
  BEFORE UPDATE ON public.treasury_vaults
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
