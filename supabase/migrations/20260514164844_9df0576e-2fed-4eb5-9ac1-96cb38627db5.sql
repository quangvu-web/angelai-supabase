
-- Bảng chat treasure team
CREATE TABLE public.treasure_team_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.treasure_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ttcm_team_created ON public.treasure_team_chat_messages(team_id, created_at DESC);

ALTER TABLE public.treasure_team_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_team_chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.treasure_team_chat_messages;

-- Chỉ thành viên team được đọc
CREATE POLICY "members read team chat"
ON public.treasure_team_chat_messages FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.treasure_team_members m
  WHERE m.team_id = treasure_team_chat_messages.team_id AND m.user_id = auth.uid()
));

-- Insert chỉ qua RPC (không cho client raw insert)
-- (không tạo policy INSERT cho client)

-- RPC gửi tin
CREATE OR REPLACE FUNCTION public.send_treasure_team_message(p_team_id uuid, p_content text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid; v_last timestamptz; v_clean text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  v_clean := btrim(coalesce(p_content, ''));
  IF char_length(v_clean) = 0 THEN RAISE EXCEPTION 'empty_content'; END IF;
  IF char_length(v_clean) > 500 THEN RAISE EXCEPTION 'too_long'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.treasure_team_members
                  WHERE team_id = p_team_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  -- Rate limit: 1 tin / 2 giây / user / team
  SELECT max(created_at) INTO v_last FROM public.treasure_team_chat_messages
   WHERE team_id = p_team_id AND user_id = v_user;
  IF v_last IS NOT NULL AND v_last > now() - interval '2 seconds' THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  INSERT INTO public.treasure_team_chat_messages(team_id, user_id, content)
  VALUES (p_team_id, v_user, v_clean) RETURNING id INTO v_id;
  RETURN v_id;
END;$$;
GRANT EXECUTE ON FUNCTION public.send_treasure_team_message(uuid, text) TO authenticated;
