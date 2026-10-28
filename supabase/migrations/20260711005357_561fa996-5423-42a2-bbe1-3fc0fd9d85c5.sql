
CREATE TABLE public.edge_function_feature_map (
  function_name text PRIMARY KEY,
  feature text NOT NULL DEFAULT 'Uncategorized',
  category text NOT NULL DEFAULT 'other',
  cost_weight numeric NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.edge_function_feature_map TO authenticated;
GRANT ALL ON public.edge_function_feature_map TO service_role;

ALTER TABLE public.edge_function_feature_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage feature map"
ON public.edge_function_feature_map FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read feature map"
ON public.edge_function_feature_map FOR SELECT TO authenticated
USING (true);

CREATE TABLE public.cloud_usage_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_start timestamptz NOT NULL,
  granularity text NOT NULL DEFAULT 'hour',
  function_name text NOT NULL,
  invocations bigint NOT NULL DEFAULT 0,
  total_ms bigint NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  avg_ms numeric,
  estimated_cost_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_start, granularity, function_name)
);

CREATE INDEX idx_cloud_usage_bucket ON public.cloud_usage_snapshots (bucket_start DESC);
CREATE INDEX idx_cloud_usage_func ON public.cloud_usage_snapshots (function_name, bucket_start DESC);

GRANT SELECT ON public.cloud_usage_snapshots TO authenticated;
GRANT ALL ON public.cloud_usage_snapshots TO service_role;

ALTER TABLE public.cloud_usage_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read cloud usage"
ON public.cloud_usage_snapshots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role writes cloud usage"
ON public.cloud_usage_snapshots FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_edge_function_feature_map_updated_at
BEFORE UPDATE ON public.edge_function_feature_map
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.edge_function_feature_map (function_name, feature, category, notes) VALUES
  ('angel-chat', 'Chat AI', 'ai', 'Main Angel AI chat pipeline'),
  ('knowledge-ingest', 'RAG Ingest', 'ai', 'Embedding + chunking pipeline'),
  ('knowledge-search', 'RAG Search', 'ai', 'Vector + hybrid search'),
  ('knowledge-query-rewrite', 'RAG Search', 'ai', 'Query rewrite for RAG'),
  ('knowledge-external-ingest', 'RAG Ingest', 'ai', 'Telegram/external ingestion'),
  ('web-search-knowledge', 'RAG Search', 'ai', 'Web search assist'),
  ('youtube-search-camly', 'RAG Search', 'ai', 'YouTube lookup'),
  ('connector-indexer', 'Connector Layer', 'web3', 'On-chain scan for connector'),
  ('analyze-reward-question', 'PLP Scoring', 'plp', 'Question reward analyzer'),
  ('pplp-score-action', 'PLP Scoring', 'plp', 'Action scoring'),
  ('process-community-post', 'Community Moderation', 'moderation', 'Video/post moderation'),
  ('pet-chat', 'Mini Games', 'games', 'Companion pet chat'),
  ('quest-rotate', 'Mini Games', 'games', 'Daily quest rotator (cron)'),
  ('quest-claim', 'Mini Games', 'games', 'Quest reward claim'),
  ('quest-streak-tick', 'Mini Games', 'games', 'Streak cron'),
  ('lantern-submit', 'Mini Games', 'games', 'Lantern path submit'),
  ('telegram-webhook', 'Telegram Bot', 'telegram', 'Bot webhook'),
  ('telegram-setup', 'Telegram Bot', 'telegram', 'Bot setup'),
  ('telegram-notify', 'Telegram Bot', 'telegram', 'Broadcast notify'),
  ('telegram-webapp-verify', 'Telegram Bot', 'telegram', 'Mini app initData verify'),
  ('sbt-auto-mint', 'Web3 SBT', 'web3', 'SBT on-chain mint queue'),
  ('fetch-wallet-transactions', 'Web3 Wallet', 'web3', 'BSC wallet tx fetch'),
  ('verify-anti-whale-cap', 'Governance', 'admin', 'Anti-whale cap check'),
  ('process-mint-cycle', 'Governance', 'admin', 'Mint cycle processor'),
  ('sync-mint-requests-from-allocations', 'Governance', 'admin', 'Mint sync'),
  ('platforms-health', 'System Health', 'admin', 'Ecosystem pinger'),
  ('cloud-usage-collect', 'System Health', 'admin', 'Cloud usage collector'),
  ('cloud-usage-query', 'System Health', 'admin', 'Cloud usage query')
ON CONFLICT (function_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_cloud_usage_series(
  _from timestamptz,
  _to timestamptz,
  _granularity text DEFAULT 'hour',
  _group_by text DEFAULT 'function'
)
RETURNS TABLE (
  bucket timestamptz,
  grp_key text,
  invocations bigint,
  total_ms bigint,
  error_count bigint,
  estimated_cost_usd numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH bucketed AS (
    SELECT
      CASE _granularity
        WHEN 'hour'  THEN date_trunc('hour',  s.bucket_start)
        WHEN 'day'   THEN date_trunc('day',   s.bucket_start)
        WHEN 'month' THEN date_trunc('month', s.bucket_start)
        ELSE date_trunc('hour', s.bucket_start)
      END AS bkt,
      COALESCE(
        CASE _group_by
          WHEN 'function' THEN s.function_name
          WHEN 'feature'  THEN m.feature
          WHEN 'category' THEN m.category
          ELSE s.function_name
        END,
        'Uncategorized'
      ) AS grp,
      s.invocations, s.total_ms, s.error_count, s.estimated_cost_usd
    FROM public.cloud_usage_snapshots s
    LEFT JOIN public.edge_function_feature_map m ON m.function_name = s.function_name
    WHERE s.bucket_start >= _from AND s.bucket_start < _to
  )
  SELECT bkt, grp,
    SUM(invocations)::bigint,
    SUM(total_ms)::bigint,
    SUM(error_count)::bigint,
    SUM(estimated_cost_usd)::numeric
  FROM bucketed
  GROUP BY bkt, grp
  ORDER BY bkt, grp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cloud_usage_series(timestamptz, timestamptz, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_cloud_usage_top_functions(
  _from timestamptz,
  _to timestamptz,
  _limit int DEFAULT 30
)
RETURNS TABLE (
  function_name text,
  feature text,
  category text,
  invocations bigint,
  total_ms bigint,
  avg_ms numeric,
  error_count bigint,
  estimated_cost_usd numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  SELECT
    s.function_name,
    COALESCE(m.feature, 'Uncategorized'),
    COALESCE(m.category, 'other'),
    SUM(s.invocations)::bigint,
    SUM(s.total_ms)::bigint,
    CASE WHEN SUM(s.invocations) > 0 THEN SUM(s.total_ms)::numeric / SUM(s.invocations) ELSE 0 END,
    SUM(s.error_count)::bigint,
    SUM(s.estimated_cost_usd)::numeric
  FROM public.cloud_usage_snapshots s
  LEFT JOIN public.edge_function_feature_map m ON m.function_name = s.function_name
  WHERE s.bucket_start >= _from AND s.bucket_start < _to
  GROUP BY s.function_name, m.feature, m.category
  ORDER BY SUM(s.estimated_cost_usd) DESC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cloud_usage_top_functions(timestamptz, timestamptz, int) TO authenticated;
