
-- ============================================================
-- Phase 6B — Season Weekly Quests
-- ============================================================

-- 1) Tables
CREATE TABLE IF NOT EXISTS public.season_weekly_quest_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.game_seasons(id) ON DELETE CASCADE,
  week_index INT,                 -- NULL = áp dụng mọi tuần trong mùa
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,           -- match user_season_xp_log.source
  target_count INT NOT NULL CHECK (target_count > 0),
  xp_reward INT NOT NULL CHECK (xp_reward >= 0),
  is_premium_only BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, code)
);
CREATE INDEX IF NOT EXISTS idx_swqt_season_active ON public.season_weekly_quest_templates(season_id, is_active);

CREATE TABLE IF NOT EXISTS public.user_weekly_quest_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.season_weekly_quest_templates(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  xp_granted INT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_uwqc_user_week ON public.user_weekly_quest_claims(user_id, week_start);

ALTER TABLE public.season_weekly_quest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_weekly_quest_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates readable by all"
  ON public.season_weekly_quest_templates FOR SELECT USING (true);

CREATE POLICY "user reads own claims"
  ON public.user_weekly_quest_claims FOR SELECT USING (auth.uid() = user_id);

-- 2) Helper: thứ 2 đầu tuần theo giờ VN
CREATE OR REPLACE FUNCTION public._current_week_start_vn()
RETURNS DATE
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT date_trunc('week', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date;
$$;

-- 3) RPC: get_weekly_quests()
CREATE OR REPLACE FUNCTION public.get_weekly_quests()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_season public.game_seasons;
  v_week_start DATE := public._current_week_start_vn();
  v_week_end DATE := v_week_start + 7;
  v_quests jsonb;
  v_pass public.user_season_pass;
BEGIN
  v_season := public._current_season();
  IF v_season.id IS NULL THEN
    RETURN jsonb_build_object('season', NULL, 'quests', '[]'::jsonb);
  END IF;

  IF v_user IS NOT NULL THEN
    SELECT * INTO v_pass FROM public.user_season_pass
      WHERE user_id = v_user AND season_id = v_season.id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'code', t.code,
    'title', t.title,
    'description', t.description,
    'source', t.source,
    'target_count', t.target_count,
    'xp_reward', t.xp_reward,
    'is_premium_only', t.is_premium_only,
    'position', t.position,
    'progress', COALESCE(p.cnt, 0),
    'completed', COALESCE(p.cnt, 0) >= t.target_count,
    'claimed', c.id IS NOT NULL,
    'claimed_at', c.claimed_at
  ) ORDER BY t.position, t.code), '[]'::jsonb)
  INTO v_quests
  FROM public.season_weekly_quest_templates t
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.user_season_xp_log l
    WHERE l.user_id = v_user
      AND l.season_id = v_season.id
      AND l.source = t.source
      AND l.created_at >= (v_week_start::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND l.created_at <  (v_week_end::timestamp   AT TIME ZONE 'Asia/Ho_Chi_Minh')
  ) p ON true
  LEFT JOIN public.user_weekly_quest_claims c
    ON c.template_id = t.id AND c.user_id = v_user AND c.week_start = v_week_start
  WHERE t.season_id = v_season.id
    AND t.is_active = true;

  RETURN jsonb_build_object(
    'season', jsonb_build_object('id', v_season.id, 'code', v_season.code, 'name', v_season.name),
    'week_start', v_week_start,
    'week_end', v_week_end,
    'is_premium', COALESCE(v_pass.is_premium, false),
    'quests', v_quests
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_quests() TO anon, authenticated;

-- 4) RPC: claim_weekly_quest
CREATE OR REPLACE FUNCTION public.claim_weekly_quest(_template_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_season public.game_seasons;
  v_tpl public.season_weekly_quest_templates;
  v_pass public.user_season_pass;
  v_week_start DATE := public._current_week_start_vn();
  v_week_end DATE := v_week_start + 7;
  v_progress INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  v_season := public._current_season();
  IF v_season.id IS NULL THEN RAISE EXCEPTION 'no_active_season'; END IF;

  SELECT * INTO v_tpl FROM public.season_weekly_quest_templates
    WHERE id = _template_id AND season_id = v_season.id AND is_active = true;
  IF v_tpl.id IS NULL THEN RAISE EXCEPTION 'quest_not_found'; END IF;

  IF v_tpl.is_premium_only THEN
    SELECT * INTO v_pass FROM public.user_season_pass WHERE user_id = v_user AND season_id = v_season.id;
    IF NOT COALESCE(v_pass.is_premium, false) THEN RAISE EXCEPTION 'premium_required'; END IF;
  END IF;

  -- đếm tiến độ trong tuần
  SELECT COUNT(*)::int INTO v_progress
  FROM public.user_season_xp_log
  WHERE user_id = v_user
    AND season_id = v_season.id
    AND source = v_tpl.source
    AND created_at >= (v_week_start::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    AND created_at <  (v_week_end::timestamp   AT TIME ZONE 'Asia/Ho_Chi_Minh');

  IF v_progress < v_tpl.target_count THEN
    RAISE EXCEPTION 'not_completed' USING DETAIL = format('%s/%s', v_progress, v_tpl.target_count);
  END IF;

  -- chốt claim (unique sẽ chặn double-claim)
  INSERT INTO public.user_weekly_quest_claims(user_id, template_id, week_start, xp_granted)
  VALUES (v_user, v_tpl.id, v_week_start, v_tpl.xp_reward);

  PERFORM public.add_season_xp(
    v_user,
    'weekly_quest',
    v_tpl.id::text || ':' || v_week_start::text,
    v_tpl.xp_reward
  );

  RETURN jsonb_build_object(
    'ok', true,
    'xp_reward', v_tpl.xp_reward,
    'week_start', v_week_start
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_claimed';
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_weekly_quest(UUID) TO authenticated;
