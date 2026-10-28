ALTER TABLE public.ai_routing_log ADD COLUMN IF NOT EXISTS provider text;
CREATE INDEX IF NOT EXISTS idx_ai_routing_log_provider_created ON public.ai_routing_log (created_at DESC, provider);