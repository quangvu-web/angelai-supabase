
-- Leave team
CREATE OR REPLACE FUNCTION public.leave_treasure_team(p_team_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_leader uuid; v_remaining int; v_new_leader uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT leader_user_id INTO v_leader FROM public.treasure_teams WHERE id = p_team_id;
  IF v_leader IS NULL THEN RAISE EXCEPTION 'team_not_found'; END IF;
  DELETE FROM public.treasure_team_members WHERE team_id = p_team_id AND user_id = v_user;
  SELECT count(*) INTO v_remaining FROM public.treasure_team_members WHERE team_id = p_team_id;
  IF v_remaining = 0 THEN
    DELETE FROM public.treasure_teams WHERE id = p_team_id;
  ELSIF v_leader = v_user THEN
    SELECT user_id INTO v_new_leader FROM public.treasure_team_members
      WHERE team_id = p_team_id ORDER BY joined_at ASC LIMIT 1;
    UPDATE public.treasure_teams SET leader_user_id = v_new_leader WHERE id = p_team_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.leave_treasure_team(uuid) TO authenticated;

-- List open teams in an event
CREATE OR REPLACE FUNCTION public.list_open_treasure_teams(p_event_id uuid)
RETURNS TABLE(team_id uuid, name text, member_count bigint, max_size int, leader_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, COUNT(m.user_id) AS member_count, e.max_team_size, t.leader_user_id
  FROM public.treasure_teams t
  JOIN public.treasure_events e ON e.id = t.event_id
  LEFT JOIN public.treasure_team_members m ON m.team_id = t.id
  WHERE t.event_id = p_event_id
  GROUP BY t.id, e.max_team_size
  HAVING COUNT(m.user_id) < e.max_team_size
  ORDER BY t.created_at DESC
  LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.list_open_treasure_teams(uuid) TO authenticated;

-- Team member progress
CREATE OR REPLACE FUNCTION public.get_treasure_team_progress(p_team_id uuid)
RETURNS TABLE(user_id uuid, joined_at timestamptz, solved_count bigint, is_leader boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_event uuid; v_leader uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.treasure_team_members WHERE team_id = p_team_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'not_member';
  END IF;
  SELECT event_id, leader_user_id INTO v_event, v_leader FROM public.treasure_teams WHERE id = p_team_id;
  RETURN QUERY
  SELECT m.user_id, m.joined_at,
         (SELECT COUNT(*) FROM public.treasure_progress p
          WHERE p.event_id = v_event AND p.user_id = m.user_id) AS solved_count,
         (m.user_id = v_leader) AS is_leader
  FROM public.treasure_team_members m
  WHERE m.team_id = p_team_id
  ORDER BY m.joined_at ASC;
END;$$;
GRANT EXECUTE ON FUNCTION public.get_treasure_team_progress(uuid) TO authenticated;
