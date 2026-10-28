
-- 1) telegram_links
CREATE TABLE public.telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  language_code TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tg_links_select_own" ON public.telegram_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tg_links_delete_own" ON public.telegram_links FOR DELETE USING (auth.uid() = user_id);

-- 2) telegram_link_codes
CREATE TABLE public.telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes'),
  consumed_at TIMESTAMPTZ
);
CREATE INDEX idx_tg_link_codes_user ON public.telegram_link_codes(user_id);
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tg_link_codes_select_own" ON public.telegram_link_codes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tg_link_codes_insert_own" ON public.telegram_link_codes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3) telegram_bot_audit
CREATE TABLE public.telegram_bot_audit (
  update_id BIGINT PRIMARY KEY,
  chat_id BIGINT,
  telegram_user_id BIGINT,
  command TEXT,
  payload JSONB,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tg_audit_chat ON public.telegram_bot_audit(chat_id);
CREATE INDEX idx_tg_audit_created ON public.telegram_bot_audit(created_at DESC);
ALTER TABLE public.telegram_bot_audit ENABLE ROW LEVEL SECURITY;
-- service role only (no policies)

-- 4) telegram_bot_config (singleton)
CREATE TABLE public.telegram_bot_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bot_username TEXT,
  bot_id BIGINT,
  webhook_url TEXT,
  webhook_secret TEXT,
  last_setup_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.telegram_bot_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tg_bot_config_read_public" ON public.telegram_bot_config FOR SELECT USING (true);
-- writes restricted to service role

-- 5) telegram_notify_queue
CREATE TABLE public.telegram_notify_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tg_notify_pending ON public.telegram_notify_queue(scheduled_at) WHERE sent_at IS NULL;
ALTER TABLE public.telegram_notify_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tg_notify_select_own" ON public.telegram_notify_queue FOR SELECT USING (auth.uid() = user_id);

-- 6) RPC: tạo mã link một lần (gọi từ frontend, dùng auth.uid())
CREATE OR REPLACE FUNCTION public.create_telegram_link_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  -- 8 hex chars
  v_code := lower(encode(gen_random_bytes(4), 'hex'));

  INSERT INTO public.telegram_link_codes (code, user_id)
  VALUES (v_code, v_uid);

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_telegram_link_code() TO authenticated;

-- 7) RPC: tiêu thụ mã link (gọi từ webhook bằng service role qua wrapper)
CREATE OR REPLACE FUNCTION public.consume_telegram_link_code(
  p_code TEXT,
  p_telegram_user_id BIGINT,
  p_telegram_username TEXT DEFAULT NULL,
  p_language_code TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  SELECT user_id INTO v_uid
  FROM public.telegram_link_codes
  WHERE code = p_code
    AND consumed_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.telegram_link_codes
  SET consumed_at = now()
  WHERE code = p_code;

  INSERT INTO public.telegram_links (user_id, telegram_user_id, telegram_username, language_code)
  VALUES (v_uid, p_telegram_user_id, p_telegram_username, p_language_code)
  ON CONFLICT (user_id) DO UPDATE
    SET telegram_user_id = EXCLUDED.telegram_user_id,
        telegram_username = EXCLUDED.telegram_username,
        language_code = EXCLUDED.language_code,
        linked_at = now();

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_telegram_link_code(TEXT,BIGINT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_telegram_link_code(TEXT,BIGINT,TEXT,TEXT) TO service_role;
