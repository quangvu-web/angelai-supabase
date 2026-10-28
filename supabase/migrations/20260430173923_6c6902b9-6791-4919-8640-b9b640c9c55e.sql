CREATE TABLE public.connector_token_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id integer NOT NULL DEFAULT 97,
  token_address text NOT NULL,
  symbol text NOT NULL,
  decimals integer NOT NULL DEFAULT 18,
  min_value_raw numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chain_id, token_address)
);

ALTER TABLE public.connector_token_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active whitelist"
  ON public.connector_token_whitelist FOR SELECT
  USING (active = true);

CREATE POLICY "Admins manage whitelist"
  ON public.connector_token_whitelist FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_connector_token_whitelist_updated_at
  BEFORE UPDATE ON public.connector_token_whitelist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.connector_token_whitelist (chain_id, token_address, symbol, decimals, min_value_raw, notes) VALUES
  (97, 'native', 'tBNB', 18, 1000000000000000, 'BSC Testnet native, min 0.001 BNB'),
  (97, '0x0000000000000000000000000000000000000000', 'CAMLY_PLACEHOLDER', 3, 1000, 'Replace with real CAMLY testnet address');

CREATE TABLE public.connector_rewards_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES public.connectors(id) ON DELETE CASCADE,
  connector_user_id uuid NOT NULL,
  newcomer_user_id uuid NOT NULL,
  score_added numeric NOT NULL DEFAULT 0,
  pillar text NOT NULL DEFAULT 'network',
  sbt_queued boolean NOT NULL DEFAULT false,
  sbt_token_id text,
  pplp_action_id uuid,
  reverted boolean NOT NULL DEFAULT false,
  reverted_at timestamptz,
  reverted_reason text,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_connector_rewards_user ON public.connector_rewards_log(connector_user_id);
CREATE INDEX idx_connector_rewards_connector ON public.connector_rewards_log(connector_id);

ALTER TABLE public.connector_rewards_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own connector rewards"
  ON public.connector_rewards_log FOR SELECT
  USING (auth.uid() = connector_user_id OR auth.uid() = newcomer_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages connector rewards"
  ON public.connector_rewards_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.pplp_parameter_config (key, value, phase, description) VALUES
  ('connector_window_hours', '48'::jsonb, 'connector', 'Hours after signup that a Connector can claim by first on-chain gift'),
  ('connector_max_per_wallet_per_day', '5'::jsonb, 'connector', 'Max times a single wallet can be Connector per day (anti-burst)'),
  ('connector_dispute_window_days', '7'::jsonb, 'connector', 'Days during which a Connector claim can be disputed'),
  ('connector_confirmations', '12'::jsonb, 'connector', 'Required block confirmations before accepting a transfer'),
  ('connector_reward_pls', '5'::jsonb, 'connector', 'Public Light Score added to Connector network pillar')
ON CONFLICT (key) DO NOTHING;