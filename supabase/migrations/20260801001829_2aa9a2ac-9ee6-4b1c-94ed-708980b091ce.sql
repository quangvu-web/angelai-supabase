ALTER TABLE public.ai_routing_log
  ADD COLUMN IF NOT EXISTS finish_reason text,
  ADD COLUMN IF NOT EXISTS truncated_hint boolean DEFAULT false;