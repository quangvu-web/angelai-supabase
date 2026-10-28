
-- Phase 8: Light Circle (Vòng Sáng) — co-op nhóm 2-20 người, không cạnh tranh

-- ============ ENUM ============
DO $$ BEGIN
  CREATE TYPE public.light_circle_role AS ENUM ('founder','steward','member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.light_circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  motto text CHECK (motto IS NULL OR char_length(motto) <= 140),
  avatar_emoji text NOT NULL DEFAULT '✨' CHECK (char_length(avatar_emoji) <= 8),
  created_by uuid NOT NULL,
  member_count int NOT NULL DEFAULT 1 CHECK (member_count >= 0 AND member_count <= 20),
  max_members int NOT NULL DEFAULT 20 CHECK (max_members BETWEEN 2 AND 20),
  light_pool bigint NOT NULL DEFAULT 0,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_light_circles_open ON public.light_circles(is_open, created_at DESC);

CREATE TABLE IF NOT EXISTS public.light_circle_members (
  circle_id uuid NOT NULL REFERENCES public.light_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.light_circle_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  contributed_light bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (circle_id, user_id),
  UNIQUE (user_id) -- 1 user = 1 vòng
);
CREATE INDEX IF NOT EXISTS idx_lcm_circle ON public.light_circle_members(circle_id, joined_at);

CREATE TABLE IF NOT EXISTS public.light_circle_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.light_circles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  uses_left int NOT NULL DEFAULT 5 CHECK (uses_left >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.light_circle_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.light_circles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lcc_circle_time ON public.light_circle_chat_messages(circle_id, created_at DESC);

-- ============ RLS ============
ALTER TABLE public.light_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.light_circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.light_circle_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.light_circle_chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper SECURITY DEFINER (tránh recursion)
CREATE OR REPLACE FUNCTION public.is_light_circle_member(_circle uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.light_circle_members WHERE circle_id=_circle AND user_id=_user);
$$;

CREATE OR REPLACE FUNCTION public.is_light_circle_officer(_circle uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.light_circle_members
    WHERE circle_id=_circle AND user_id=_user AND role IN ('founder','steward')
  );
$$;

-- light_circles: ai cũng đọc được (public discovery), update chỉ officer
CREATE POLICY "lc_select_all" ON public.light_circles FOR SELECT USING (true);
CREATE POLICY "lc_update_officer" ON public.light_circles FOR UPDATE
  USING (public.is_light_circle_officer(id, auth.uid()));

-- members: đọc các vòng mình ở; insert/delete qua RPC
CREATE POLICY "lcm_select_self_or_circle" ON public.light_circle_members FOR SELECT
  USING (user_id = auth.uid() OR public.is_light_circle_member(circle_id, auth.uid()));

-- invites: chỉ member của vòng đọc được
CREATE POLICY "lci_select_member" ON public.light_circle_invites FOR SELECT
  USING (public.is_light_circle_member(circle_id, auth.uid()));

-- chat: chỉ member đọc/insert; insert qua RPC nhưng cũng cho direct (rate-limit ở RPC mới enforce)
CREATE POLICY "lcc_select_member" ON public.light_circle_chat_messages FOR SELECT
  USING (public.is_light_circle_member(circle_id, auth.uid()));

-- ============ RPCs ============

-- Tạo vòng
CREATE OR REPLACE FUNCTION public.create_light_circle(
  p_name text, p_motto text, p_emoji text, p_is_open boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS(SELECT 1 FROM light_circle_members WHERE user_id=v_uid) THEN
    RAISE EXCEPTION 'already_in_circle';
  END IF;
  v_code := upper(substr(md5(gen_random_uuid()::text),1,6));
  INSERT INTO light_circles(code,name,motto,avatar_emoji,created_by,is_open,member_count)
    VALUES (v_code, p_name, NULLIF(p_motto,''), COALESCE(NULLIF(p_emoji,''),'✨'), v_uid, COALESCE(p_is_open,true), 1)
    RETURNING id INTO v_id;
  INSERT INTO light_circle_members(circle_id,user_id,role) VALUES (v_id, v_uid, 'founder');
  RETURN v_id;
END $$;

-- Tạo invite
CREATE OR REPLACE FUNCTION public.create_light_circle_invite(p_circle_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT public.is_light_circle_officer(p_circle_id, v_uid) THEN RAISE EXCEPTION 'not_officer'; END IF;
  v_code := upper(substr(md5(gen_random_uuid()::text),1,8));
  INSERT INTO light_circle_invites(circle_id,code,created_by) VALUES (p_circle_id,v_code,v_uid);
  RETURN v_code;
END $$;

-- Join bằng code
CREATE OR REPLACE FUNCTION public.join_light_circle_by_code(p_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv record;
  v_circle record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS(SELECT 1 FROM light_circle_members WHERE user_id=v_uid) THEN
    RAISE EXCEPTION 'already_in_circle';
  END IF;
  SELECT * INTO v_inv FROM light_circle_invites
   WHERE code=upper(p_code) AND expires_at > now() AND uses_left > 0
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_invite'; END IF;
  SELECT * INTO v_circle FROM light_circles WHERE id=v_inv.circle_id FOR UPDATE;
  IF v_circle.member_count >= v_circle.max_members THEN RAISE EXCEPTION 'circle_full'; END IF;
  INSERT INTO light_circle_members(circle_id,user_id,role) VALUES (v_circle.id,v_uid,'member');
  UPDATE light_circles SET member_count = member_count + 1 WHERE id=v_circle.id;
  UPDATE light_circle_invites SET uses_left = uses_left - 1 WHERE id=v_inv.id;
  RETURN v_circle.id;
END $$;

-- Join trực tiếp vòng mở (is_open=true)
CREATE OR REPLACE FUNCTION public.join_open_light_circle(p_circle_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_circle record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS(SELECT 1 FROM light_circle_members WHERE user_id=v_uid) THEN
    RAISE EXCEPTION 'already_in_circle';
  END IF;
  SELECT * INTO v_circle FROM light_circles WHERE id=p_circle_id FOR UPDATE;
  IF NOT FOUND OR NOT v_circle.is_open THEN RAISE EXCEPTION 'not_open'; END IF;
  IF v_circle.member_count >= v_circle.max_members THEN RAISE EXCEPTION 'circle_full'; END IF;
  INSERT INTO light_circle_members(circle_id,user_id,role) VALUES (v_circle.id,v_uid,'member');
  UPDATE light_circles SET member_count = member_count + 1 WHERE id=v_circle.id;
  RETURN v_circle.id;
END $$;

-- Rời vòng (chuyển founder nếu cần)
CREATE OR REPLACE FUNCTION public.leave_light_circle()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mem record;
  v_next uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_mem FROM light_circle_members WHERE user_id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_in_circle'; END IF;

  DELETE FROM light_circle_members WHERE circle_id=v_mem.circle_id AND user_id=v_uid;
  UPDATE light_circles SET member_count = GREATEST(member_count-1, 0) WHERE id=v_mem.circle_id;

  IF v_mem.role = 'founder' THEN
    SELECT user_id INTO v_next FROM light_circle_members
     WHERE circle_id=v_mem.circle_id
     ORDER BY (role='steward')::int DESC, joined_at ASC LIMIT 1;
    IF v_next IS NOT NULL THEN
      UPDATE light_circle_members SET role='founder' WHERE circle_id=v_mem.circle_id AND user_id=v_next;
    ELSE
      DELETE FROM light_circles WHERE id=v_mem.circle_id;
    END IF;
  END IF;
  RETURN true;
END $$;

-- Gửi tin nhắn (rate-limit 1/2s + length 1-500)
CREATE OR REPLACE FUNCTION public.send_light_circle_message(p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_circle uuid;
  v_last timestamptz;
  v_id uuid;
  v_body text := btrim(p_body);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF v_body IS NULL OR char_length(v_body) < 1 OR char_length(v_body) > 500 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;
  SELECT circle_id INTO v_circle FROM light_circle_members WHERE user_id=v_uid;
  IF v_circle IS NULL THEN RAISE EXCEPTION 'not_in_circle'; END IF;
  SELECT max(created_at) INTO v_last FROM light_circle_chat_messages
    WHERE circle_id=v_circle AND user_id=v_uid;
  IF v_last IS NOT NULL AND v_last > now() - interval '2 seconds' THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  INSERT INTO light_circle_chat_messages(circle_id,user_id,body) VALUES (v_circle,v_uid,v_body)
    RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Lấy vòng của tôi (members + 50 chat gần nhất)
CREATE OR REPLACE FUNCTION public.get_my_light_circle()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_circle_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('in_circle', false); END IF;
  SELECT circle_id INTO v_circle_id FROM light_circle_members WHERE user_id=v_uid;
  IF v_circle_id IS NULL THEN RETURN jsonb_build_object('in_circle', false); END IF;

  SELECT jsonb_build_object(
    'in_circle', true,
    'circle', to_jsonb(c.*),
    'my_role', (SELECT role FROM light_circle_members WHERE circle_id=c.id AND user_id=v_uid),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'joined_at', m.joined_at,
        'contributed_light', m.contributed_light,
        'display_name', COALESCE(p.display_name, p.handle, 'Người dùng'),
        'avatar_url', p.avatar_url,
        'handle', p.handle
      ) ORDER BY m.joined_at)
      FROM light_circle_members m
      LEFT JOIN profiles p ON p.id = m.user_id
      WHERE m.circle_id=c.id
    ), '[]'::jsonb),
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'user_id', x.user_id, 'body', x.body, 'created_at', x.created_at,
        'display_name', COALESCE(p.display_name, p.handle, 'Người dùng'),
        'avatar_url', p.avatar_url
      ) ORDER BY x.created_at)
      FROM (
        SELECT * FROM light_circle_chat_messages
         WHERE circle_id=c.id ORDER BY created_at DESC LIMIT 50
      ) x
      LEFT JOIN profiles p ON p.id = x.user_id
    ), '[]'::jsonb),
    'invites', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'code', i.code, 'expires_at', i.expires_at, 'uses_left', i.uses_left
      ) ORDER BY i.created_at DESC)
      FROM light_circle_invites i
      WHERE i.circle_id=c.id AND i.expires_at>now() AND i.uses_left>0
    ), '[]'::jsonb)
  ) INTO v_result
  FROM light_circles c WHERE c.id=v_circle_id;

  RETURN v_result;
END $$;

-- Liệt kê vòng mở
CREATE OR REPLACE FUNCTION public.list_open_light_circles(p_limit int DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'motto', c.motto, 'emoji', c.avatar_emoji,
    'member_count', c.member_count, 'max_members', c.max_members,
    'created_at', c.created_at
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  FROM light_circles c
  WHERE c.is_open AND c.member_count < c.max_members
  LIMIT GREATEST(LEAST(COALESCE(p_limit,30), 100), 1);
$$;

-- ============ TRIGGER: cộng ánh sáng từ Season XP ============
CREATE OR REPLACE FUNCTION public.tg_light_circle_absorb_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_circle uuid;
  v_light bigint;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  SELECT circle_id INTO v_circle FROM light_circle_members WHERE user_id=NEW.user_id;
  IF v_circle IS NULL THEN RETURN NEW; END IF;
  v_light := NEW.amount::bigint * 5;
  UPDATE light_circle_members
    SET contributed_light = contributed_light + v_light
    WHERE circle_id=v_circle AND user_id=NEW.user_id;
  UPDATE light_circles SET light_pool = light_pool + v_light WHERE id=v_circle;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_light_circle_absorb_xp ON public.user_season_xp_log;
CREATE TRIGGER trg_light_circle_absorb_xp
  AFTER INSERT ON public.user_season_xp_log
  FOR EACH ROW EXECUTE FUNCTION public.tg_light_circle_absorb_xp();

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.light_circle_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.light_circles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.light_circle_members;
