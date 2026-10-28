
CREATE OR REPLACE FUNCTION public.get_team_jackpot_split(p_team_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_team RECORD;
  v_total_solved bigint;
  v_total_clues int;
  v_members jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_team FROM public.treasure_teams WHERE id = p_team_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'team_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.treasure_team_members
                  WHERE team_id = p_team_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'not_member';
  END IF;

  SELECT count(*) INTO v_total_clues FROM public.treasure_clues WHERE event_id = v_team.event_id;

  SELECT coalesce(sum(solved.cnt), 0) INTO v_total_solved
  FROM public.treasure_team_members m
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS cnt FROM public.treasure_progress p
    WHERE p.event_id = v_team.event_id AND p.user_id = m.user_id
  ) solved ON true
  WHERE m.team_id = p_team_id;

  SELECT jsonb_agg(jsonb_build_object(
    'user_id', m.user_id,
    'display_name', p.display_name,
    'handle', p.handle,
    'avatar_url', p.avatar_url,
    'is_leader', (m.user_id = v_team.leader_user_id),
    'joined_at', m.joined_at,
    'solved_count', coalesce(s.cnt, 0),
    'share_pct', CASE WHEN v_total_solved = 0
                      THEN round(100.0 / nullif((SELECT count(*) FROM public.treasure_team_members WHERE team_id = p_team_id), 0), 2)
                      ELSE round(coalesce(s.cnt, 0) * 100.0 / v_total_solved, 2) END,
    'has_claimed', EXISTS (SELECT 1 FROM public.treasure_jackpot_claims c
                            WHERE c.user_id = m.user_id AND c.event_id = v_team.event_id),
    'ticket_id', (SELECT c.ticket_id FROM public.treasure_jackpot_claims c
                   WHERE c.user_id = m.user_id AND c.event_id = v_team.event_id LIMIT 1)
  ) ORDER BY coalesce(s.cnt, 0) DESC, m.joined_at ASC)
  INTO v_members
  FROM public.treasure_team_members m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS cnt FROM public.treasure_progress pr
    WHERE pr.event_id = v_team.event_id AND pr.user_id = m.user_id
  ) s ON true
  WHERE m.team_id = p_team_id;

  RETURN jsonb_build_object(
    'team_id', v_team.id,
    'team_name', v_team.name,
    'event_id', v_team.event_id,
    'total_clues', v_total_clues,
    'total_solved', v_total_solved,
    'jackpot_tier', (SELECT jackpot_tier FROM public.treasure_events WHERE id = v_team.event_id),
    'members', coalesce(v_members, '[]'::jsonb)
  );
END;$$;
GRANT EXECUTE ON FUNCTION public.get_team_jackpot_split(uuid) TO authenticated;
