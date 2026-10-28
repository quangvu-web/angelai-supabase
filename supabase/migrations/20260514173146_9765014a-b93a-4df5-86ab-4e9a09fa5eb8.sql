
CREATE OR REPLACE FUNCTION public.get_season_coop_spotlight()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_season public.game_seasons;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_top_teams jsonb;
  v_top_contributors jsonb;
  v_most_connected jsonb;
BEGIN
  v_season := public._current_season();
  IF v_season.id IS NULL THEN
    RETURN jsonb_build_object('active', false);
  END IF;
  v_start := v_season.starts_at;
  v_end := v_season.ends_at;

  -- Top 10 teams theo số mảnh đã giải trong context team
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.solved_total DESC), '[]'::jsonb)
  INTO v_top_teams
  FROM (
    SELECT
      tt.id AS team_id,
      tt.name AS team_name,
      COUNT(tp.id)::int AS solved_total,
      COUNT(DISTINCT tp.user_id)::int AS member_count
    FROM public.treasure_progress tp
    JOIN public.treasure_teams tt ON tt.id = tp.team_id
    WHERE tp.team_id IS NOT NULL
      AND tp.solved_at >= v_start AND tp.solved_at < v_end
    GROUP BY tt.id, tt.name
    ORDER BY solved_total DESC
    LIMIT 10
  ) t;

  -- Top 20 contributor: chỉ tính solve có team_id (đóng góp cho team)
  SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.contributions DESC), '[]'::jsonb)
  INTO v_top_contributors
  FROM (
    SELECT
      tp.user_id,
      p.display_name,
      p.handle,
      p.avatar_url,
      COUNT(*)::int AS contributions,
      COUNT(DISTINCT tp.team_id)::int AS teams_helped
    FROM public.treasure_progress tp
    LEFT JOIN public.profiles p ON p.user_id = tp.user_id
    WHERE tp.team_id IS NOT NULL
      AND tp.solved_at >= v_start AND tp.solved_at < v_end
    GROUP BY tp.user_id, p.display_name, p.handle, p.avatar_url
    ORDER BY contributions DESC
    LIMIT 20
  ) c;

  -- Most connected: số team khác nhau đã join trong mùa
  SELECT COALESCE(jsonb_agg(row_to_json(m) ORDER BY m.teams_joined DESC), '[]'::jsonb)
  INTO v_most_connected
  FROM (
    SELECT
      tm.user_id,
      p.display_name,
      p.handle,
      p.avatar_url,
      COUNT(DISTINCT tm.team_id)::int AS teams_joined
    FROM public.treasure_team_members tm
    LEFT JOIN public.profiles p ON p.user_id = tm.user_id
    WHERE tm.joined_at >= v_start AND tm.joined_at < v_end
    GROUP BY tm.user_id, p.display_name, p.handle, p.avatar_url
    HAVING COUNT(DISTINCT tm.team_id) >= 1
    ORDER BY teams_joined DESC
    LIMIT 10
  ) m;

  RETURN jsonb_build_object(
    'active', true,
    'season', jsonb_build_object('id', v_season.id, 'code', v_season.code, 'name', v_season.name),
    'window_start', v_start,
    'window_end', v_end,
    'top_teams', v_top_teams,
    'top_contributors', v_top_contributors,
    'most_connected', v_most_connected
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_season_coop_spotlight() TO anon, authenticated;
