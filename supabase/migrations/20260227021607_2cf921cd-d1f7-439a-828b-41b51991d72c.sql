
-- ========== SCORING RULE VERSIONING + TRANSPARENCY ==========

-- 1. scoring_rules table
CREATE TABLE IF NOT EXISTS public.scoring_rules (
  rule_version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  formula_json JSONB NOT NULL DEFAULT '{}',
  weight_config_json JSONB NOT NULL DEFAULT '{}',
  multiplier_config_json JSONB NOT NULL DEFAULT '{}',
  penalty_config_json JSONB NOT NULL DEFAULT '{}',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoring_rules_public_read" ON public.scoring_rules
  FOR SELECT USING (true);

-- 2. Add columns to light_score_ledger
ALTER TABLE public.light_score_ledger
  ADD COLUMN IF NOT EXISTS rule_version TEXT,
  ADD COLUMN IF NOT EXISTS reason_codes TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trend TEXT DEFAULT 'stable' CHECK (trend IN ('stable', 'growing', 'reflecting', 'rebalancing'));

-- 3. transparency_snapshots table
CREATE TABLE IF NOT EXISTS public.transparency_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  epoch_id TEXT NOT NULL,
  total_light_system NUMERIC NOT NULL DEFAULT 0,
  total_fun_minted NUMERIC NOT NULL DEFAULT 0,
  allocation_by_level JSONB NOT NULL DEFAULT '{}',
  mentor_chains_completed INT NOT NULL DEFAULT 0,
  value_loops_completed INT NOT NULL DEFAULT 0,
  active_users INT NOT NULL DEFAULT 0,
  rule_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transparency_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transparency_snapshots_public_read" ON public.transparency_snapshots
  FOR SELECT USING (true);

-- 4. Add anti-whale cap to pplp_mint_cycles
ALTER TABLE public.pplp_mint_cycles
  ADD COLUMN IF NOT EXISTS max_share_per_user NUMERIC NOT NULL DEFAULT 0.03;

-- 5. Seed V1.0 scoring rule
INSERT INTO public.scoring_rules (rule_version, name, description, formula_json, weight_config_json, multiplier_config_json, penalty_config_json, effective_from, status)
VALUES (
  'V1.0',
  'PPLP Light Score V1',
  'Initial scoring formula with 5 pillars, reputation, consistency, sequence, and integrity',
  '{"base": "sum(pillars_weighted)", "pillar_weights": {"S": 0.25, "T": 0.20, "H": 0.20, "C": 0.20, "U": 0.15}, "min_light_score": 50}',
  '{"reputation_weight": {"min": 0.5, "max": 1.5, "factors": ["contribution_days", "pass_rate", "completion_streaks", "trust_score"]}}',
  '{"consistency": {"thresholds": [{"days": 20, "period": 30, "multiplier": 1.3}, {"days": 60, "period": 90, "multiplier": 1.6}]}, "sequence": {"min": 1.0, "max": 3.0}}',
  '{"types": ["spam", "cross_account", "fake_engagement", "emotional_abuse"], "max_total": 50}',
  now(),
  'active'
)
ON CONFLICT (rule_version) DO NOTHING;
