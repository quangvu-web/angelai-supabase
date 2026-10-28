
DROP FUNCTION IF EXISTS public.join_treasure_team(uuid);
DROP FUNCTION IF EXISTS public.create_treasure_team(uuid, text);

CREATE OR REPLACE FUNCTION public.create_treasure_team(p_event_id uuid, p_name text, p_max_size int DEFAULT 5)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_team uuid; v_event_max int; v_size int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  SELECT max_team_size INTO v_event_max FROM public.treasure_events WHERE id = p_event_id;
  IF v_event_max IS NULL THEN RAISE EXCEPTION 'event_not_found'; END IF;
  v_size := GREATEST(2, LEAST(COALESCE(p_max_size, 5), v_event_max));
  IF EXISTS (SELECT 1 FROM public.treasure_team_members m
             JOIN public.treasure_teams t ON t.id=m.team_id
             WHERE m.user_id=v_user AND t.event_id=p_event_id) THEN
    RAISE EXCEPTION 'already_in_team';
  END IF;
  INSERT INTO public.treasure_teams(event_id, name, leader_user_id, max_size)
    VALUES (p_event_id, trim(p_name), v_user, v_size) RETURNING id INTO v_team;
  INSERT INTO public.treasure_team_members(team_id, user_id) VALUES (v_team, v_user);
  RETURN v_team;
END;$$;
GRANT EXECUTE ON FUNCTION public.create_treasure_team(uuid, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_treasure_team(p_team_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_team RECORD; v_count int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_team FROM public.treasure_teams WHERE id = p_team_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'team_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.treasure_team_members m
             JOIN public.treasure_teams t ON t.id=m.team_id
             WHERE m.user_id=v_user AND t.event_id=v_team.event_id) THEN
    RAISE EXCEPTION 'already_in_team';
  END IF;
  SELECT count(*) INTO v_count FROM public.treasure_team_members WHERE team_id=p_team_id;
  IF v_count >= v_team.max_size THEN RAISE EXCEPTION 'team_full'; END IF;
  INSERT INTO public.treasure_team_members(team_id, user_id) VALUES (p_team_id, v_user);
  RETURN jsonb_build_object('ok', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.join_treasure_team(uuid) TO authenticated;
