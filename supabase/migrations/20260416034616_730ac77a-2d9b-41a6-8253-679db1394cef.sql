
-- =============================================
-- PHASE 1A: Adaptive Mint Engine - DB Tables
-- =============================================

-- 1. Epoch Config - stores monetary policy parameters
CREATE TABLE public.epoch_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.epoch_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view epoch_config"
  ON public.epoch_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage epoch_config"
  ON public.epoch_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Epoch Metrics - stores per-epoch measurement data
CREATE TABLE public.epoch_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epoch_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_epoch_metrics_epoch ON public.epoch_metrics(epoch_id);
CREATE INDEX idx_epoch_metrics_type ON public.epoch_metrics(metric_type);

ALTER TABLE public.epoch_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view epoch_metrics"
  ON public.epoch_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert epoch_metrics"
  ON public.epoch_metrics FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Seed initial v1 config parameters
INSERT INTO public.epoch_config (config_key, config_value, description) VALUES
  ('system_stage', '{"stage": 1, "label": "bootstrap"}', 'System maturity stage: 1=bootstrap, 2=growth, 3=mature'),
  ('base_expansion', '{"base_rate": 500000, "epoch_length_factor": 1.0, "stage_factors": {"1": 1.2, "2": 1.0, "3": 0.7}}', 'Base expansion parameters per epoch'),
  ('contribution_weights', '{"alpha": 0.5, "beta": 0.3, "gamma": 0.2}', 'Weights for ContributionExpansion: alpha×log(LS) + beta×sqrt(CV) + gamma×SIS'),
  ('ecosystem_weights', '{"delta": 0.4, "epsilon": 0.35, "zeta": 0.25}', 'Weights for EcosystemExpansion: delta×Usage + epsilon×QualityUsers + zeta×UtilityDiversity'),
  ('discipline_modulator', '{"min": 0.80, "max": 1.15, "weights": {"liquidity": 0.3, "fraud_pressure": 0.3, "claim_efficiency": 0.2, "utility_retention": 0.2}}', 'DisciplineModulator range and component weights'),
  ('mint_guardrails', '{"min_epoch_mint": 100000, "max_epoch_mint": 50000000, "per_user_max_ratio": 0.03}', 'Soft issuance ceiling and floor per epoch'),
  ('allocation_buckets', '{"user_reward": 0.70, "ecosystem": 0.12, "treasury": 0.10, "strategic_growth": 0.05, "resilience_reserve": 0.03}', 'FinalMint allocation split'),
  ('vesting_params', '{"instant_portion": 0.15, "locked_portion": 0.85, "base_vesting_days": 28, "unlock_check_interval_days": 7}', 'Lock/unlock parameters for user rewards'),
  ('per_user_risk_bands', '{"bands": [{"level": 1, "label": "new", "max_emission_factor": 0.5, "lock_ratio": 0.95}, {"level": 2, "label": "standard", "max_emission_factor": 1.0, "lock_ratio": 0.85}, {"level": 3, "label": "trusted", "max_emission_factor": 1.2, "lock_ratio": 0.75}, {"level": 4, "label": "veteran", "max_emission_factor": 1.5, "lock_ratio": 0.65}]}', 'Per-user emission guard bands based on trust level'),
  ('normalization', '{"light_score": "log", "contribution_value": "sqrt", "scale_factor": 1000}', 'Nonlinear normalization methods to prevent whale dominance');
