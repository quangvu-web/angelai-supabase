CREATE OR REPLACE FUNCTION public.peek_treasure_team_members(p_team_id uuid)
RETURNS TABLE(user_id uuid, joined_at timestamptz, is_leader boolean, display_name text, handle text, avatar_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_leader uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT leader_user_id INTO v_leader FROM public.treasure_teams WHERE id = p_team_id;
  IF v_leader IS NULL THEN RAISE EXCEPTION 'team_not_found'; END IF;
  RETURN QUERY
  SELECT m.user_id, m.joined_at, (m.user_id = v_leader) AS is_leader,
         p.display_name, p.handle, p.avatar_url
  FROM public.treasure_team_members m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.team_id = p_team_id
  ORDER BY m.joined_at ASC
  LIMIT 50;
END;$$;
GRANT EXECUTE ON FUNCTION public.peek_treasure_team_members(uuid) TO authenticated;