
-- ===== Pha D.1: Embed clients whitelist =====
CREATE TABLE public.assistant_embed_clients (
  client_id text PRIMARY KEY,
  name text NOT NULL,
  allowed_origins text[] NOT NULL DEFAULT '{}',
  scopes text[] NOT NULL DEFAULT ARRAY['chat:read'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_embed_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage embed clients" ON public.assistant_embed_clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.assistant_embed_token_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  origin text,
  ip text,
  user_agent text,
  status text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_embed_token_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read token audit" ON public.assistant_embed_token_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_embed_audit_created ON public.assistant_embed_token_audit(created_at DESC);

INSERT INTO public.assistant_embed_clients (client_id, name, allowed_origins, scopes)
VALUES
  ('fun-rich', 'Fun.Rich main platform', ARRAY['https://fun.rich', 'https://www.fun.rich'], ARRAY['chat:read']),
  ('demo', 'Local demo / preview', ARRAY['http://localhost:5173', 'https://angel-funrich.lovable.app'], ARRAY['chat:read']);

-- ===== Pha E.1: AI routing =====
CREATE TABLE public.ai_routing_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent text UNIQUE NOT NULL,
  model text NOT NULL,
  fallback_model text,
  priority int NOT NULL DEFAULT 100,
  description text,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_routing_policy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage routing policy" ON public.ai_routing_policy
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "anyone read active policy" ON public.ai_routing_policy
  FOR SELECT TO authenticated USING (active = true);

INSERT INTO public.ai_routing_policy (intent, model, fallback_model, priority, description) VALUES
  ('spiritual', 'google/gemini-3.1-pro-preview', 'google/gemini-2.5-pro', 10, 'Câu hỏi tâm linh, triết học, ý nghĩa sống'),
  ('code', 'openai/gpt-5.2', 'openai/gpt-5-mini', 20, 'Viết/giải thích/debug code'),
  ('image', 'google/gemini-3.1-flash-image-preview', 'google/gemini-2.5-flash-image', 30, 'Sinh/sửa ảnh'),
  ('default', 'google/gemini-3-flash-preview', 'google/gemini-2.5-flash-lite', 100, 'Trò chuyện chung, tóm tắt, phân loại');

CREATE TABLE public.ai_routing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  client_id text,
  intent text NOT NULL,
  model_used text NOT NULL,
  latency_ms int,
  tokens_in int,
  tokens_out int,
  status text NOT NULL DEFAULT 'ok',
  fallback_triggered boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_routing_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read routing log" ON public.ai_routing_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_routing_log_created ON public.ai_routing_log(created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_routing_log;
ALTER TABLE public.ai_routing_log REPLICA IDENTITY FULL;

-- ===== Pha E.4: Prompt templates + versions =====
CREATE TABLE public.ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  scope text NOT NULL,
  body text NOT NULL,
  version int NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage prompts" ON public.ai_prompt_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.ai_prompt_templates(id) ON DELETE CASCADE,
  version int NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read prompt versions" ON public.ai_prompt_versions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- BEFORE UPDATE: bump version when body changes
CREATE OR REPLACE FUNCTION public.tg_prompt_template_bump()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_prompt_template_bump
  BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_prompt_template_bump();

-- AFTER INSERT OR UPDATE: snapshot to versions table (row already exists)
CREATE OR REPLACE FUNCTION public.tg_prompt_template_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.body IS DISTINCT FROM OLD.body) THEN
    INSERT INTO public.ai_prompt_versions (template_id, version, body, created_by)
    VALUES (NEW.id, NEW.version, NEW.body, NEW.created_by)
    ON CONFLICT (template_id, version) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_prompt_template_snapshot
  AFTER INSERT OR UPDATE ON public.ai_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_prompt_template_snapshot();

INSERT INTO public.ai_prompt_templates (name, scope, body) VALUES
  ('Brand Protocol V3', 'persona', 'Persona: peer-to-peer. VI: mình - bạn. EN: I - you. Never use "Ta - con". Response formula: empathy + truth + actionable next step.'),
  ('AI Role Limitation', 'governance', 'AI does NOT decide morality. AI only scores PPLP pillars (Purpose, Practice, Love, Path). Final moral judgment belongs to community + multisig governance.'),
  ('Angel Chat System Prompt', 'chat', 'You are Angel A.I., the universal assistant for FUN Ecosystem. 5D Light Economy context. Embed mode: keep responses under 200 tokens unless asked.'),
  ('Content Moderation VN', 'safety', 'Regex word boundary for Vietnamese profanity. Whitelist common phrases. Block scam/impersonation patterns. Max 5000 chars per message.'),
  ('PPLP Scoring Prompt', 'scoring', 'Score with VVU = B×Q×TC×IIS×IM×AAF×ERP×R_t. ERP (Ego Risk Penalty) 0.5–1.0. TC trust 5 levels. Calibrate against user history.'),
  ('Watermarking & Branding', 'output', 'Append signature "— Angel A.I. · FUN Ecosystem" to long-form output. Watermark generated images with subtle Gold-11 ribbon corner.');
