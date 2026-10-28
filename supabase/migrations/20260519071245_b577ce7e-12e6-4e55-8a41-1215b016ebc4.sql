
-- =====================================================
-- LANTERN PATH (Sprint 2) — 7 weekly segments
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lantern_path_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  day_idx int NOT NULL CHECK (day_idx BETWEEN 0 AND 6),
  theme_key text NOT NULL,
  evidence text NOT NULL,
  ai_score numeric(4,3) NOT NULL,
  camly_awarded int NOT NULL DEFAULT 0,
  xp_awarded int NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, day_idx)
);
CREATE INDEX IF NOT EXISTS idx_lantern_user_week ON public.lantern_path_progress(user_id, week_start);
ALTER TABLE public.lantern_path_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own lantern" ON public.lantern_path_progress FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.lantern_weekly_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  camly_awarded int NOT NULL DEFAULT 0,
  xp_awarded int NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.lantern_weekly_bonus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own bonus" ON public.lantern_weekly_bonus FOR SELECT USING (auth.uid() = user_id);

-- Helper: compute week_start (Monday) in VN timezone
CREATE OR REPLACE FUNCTION public.lantern_week_start_vn()
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (date_trunc('week', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date);
$$;

-- 7 themes fixed (S/T/H/C/U dimension tags) — extend later if needed
CREATE OR REPLACE FUNCTION public.lantern_themes()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_build_array(
    jsonb_build_object('key','gratitude','label','Biết ơn','emoji','🙏','dim','C','prompt','Hôm nay bạn biết ơn điều gì? Cụ thể, chân thật.'),
    jsonb_build_object('key','kindness','label','Tử tế','emoji','💗','dim','C','prompt','Hành động tử tế nhỏ bạn vừa làm cho ai đó.'),
    jsonb_build_object('key','learning','label','Học hỏi','emoji','📚','dim','U','prompt','Một điều mới bạn học được hôm nay.'),
    jsonb_build_object('key','health','label','Chăm thân','emoji','🌿','dim','H','prompt','Việc chăm sóc thân thể bạn đã làm (đi bộ, thiền, ngủ đủ…).'),
    jsonb_build_object('key','family','label','Gia đình','emoji','👨‍👩‍👧','dim','C','prompt','Khoảnh khắc kết nối với người thân hôm nay.'),
    jsonb_build_object('key','creation','label','Sáng tạo','emoji','🎨','dim','S','prompt','Việc sáng tạo nhỏ bạn vừa làm (viết, vẽ, code, nấu ăn…).'),
    jsonb_build_object('key','reflection','label','Chiêm nghiệm','emoji','🪞','dim','T','prompt','Một bài học sâu sắc qua trải nghiệm hôm nay.')
  );
$$;

CREATE OR REPLACE FUNCTION public.lantern_current_week()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_week date := public.lantern_week_start_vn();
BEGIN
  RETURN jsonb_build_object(
    'ok', true,
    'week_start', v_week,
    'themes', public.lantern_themes()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lantern_get_my_progress(p_week_start date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_week date := COALESCE(p_week_start, public.lantern_week_start_vn());
  v_days jsonb;
  v_bonus record;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauth'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day_idx', day_idx, 'theme_key', theme_key, 'ai_score', ai_score,
    'camly_awarded', camly_awarded, 'xp_awarded', xp_awarded,
    'completed_at', completed_at, 'evidence', evidence
  ) ORDER BY day_idx), '[]'::jsonb)
    INTO v_days
    FROM public.lantern_path_progress
    WHERE user_id = v_user AND week_start = v_week;

  SELECT * INTO v_bonus FROM public.lantern_weekly_bonus
    WHERE user_id = v_user AND week_start = v_week;

  RETURN jsonb_build_object(
    'ok', true,
    'week_start', v_week,
    'themes', public.lantern_themes(),
    'days', v_days,
    'bonus_claimed', v_bonus IS NOT NULL,
    'bonus', CASE WHEN v_bonus IS NULL THEN NULL ELSE jsonb_build_object(
      'camly_awarded', v_bonus.camly_awarded,
      'xp_awarded', v_bonus.xp_awarded,
      'claimed_at', v_bonus.claimed_at
    ) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lantern_complete_day(
  p_day_idx int,
  p_theme_key text,
  p_evidence text,
  p_ai_score numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_week date := public.lantern_week_start_vn();
  v_themes jsonb := public.lantern_themes();
  v_valid_theme boolean;
  v_camly int;
  v_xp int := 60;
  v_score numeric;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauth'); END IF;
  IF p_day_idx IS NULL OR p_day_idx < 0 OR p_day_idx > 6 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_day');
  END IF;
  IF char_length(COALESCE(p_evidence,'')) < 30 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'evidence_too_short');
  END IF;
  v_score := COALESCE(p_ai_score, 0);
  IF v_score < 0.55 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ai_gate_failed', 'score', v_score);
  END IF;

  -- Validate theme_key matches one of 7 themes
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_themes) t WHERE t->>'key' = p_theme_key
  ) INTO v_valid_theme;
  IF NOT v_valid_theme THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_theme');
  END IF;

  -- Reward Camly = 30 + score * 50 (range 30-80)
  v_camly := 30 + floor(LEAST(GREATEST(v_score, 0), 1) * 50)::int;

  -- Insert progress (unique day enforced)
  BEGIN
    INSERT INTO public.lantern_path_progress (
      user_id, week_start, day_idx, theme_key, evidence, ai_score, camly_awarded, xp_awarded
    ) VALUES (v_user, v_week, p_day_idx, p_theme_key, p_evidence, v_score, v_camly, v_xp);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'day_already_done');
  END;

  -- Award Camly + Season XP (auto-mirrors Mastery via trigger)
  PERFORM public.add_camly_coins(
    v_user, v_camly,
    'lantern_day'::coin_transaction_type,
    format('%s:%s', v_week, p_day_idx)
  );
  PERFORM public.add_season_xp(v_user, 'lantern_day', format('%s:%s', v_week, p_day_idx), v_xp);

  RETURN jsonb_build_object(
    'ok', true,
    'week_start', v_week,
    'day_idx', p_day_idx,
    'camly', v_camly,
    'xp', v_xp,
    'score', v_score
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lantern_claim_weekly_bonus(p_week_start date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_week date := COALESCE(p_week_start, public.lantern_week_start_vn());
  v_done int;
  v_camly int := 400;
  v_xp int := 600;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauth'); END IF;

  SELECT count(*) INTO v_done FROM public.lantern_path_progress
    WHERE user_id = v_user AND week_start = v_week;
  IF v_done < 7 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_complete', 'done', v_done);
  END IF;

  BEGIN
    INSERT INTO public.lantern_weekly_bonus (user_id, week_start, camly_awarded, xp_awarded)
      VALUES (v_user, v_week, v_camly, v_xp);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END;

  PERFORM public.add_camly_coins(
    v_user, v_camly,
    'lantern_weekly'::coin_transaction_type,
    v_week::text
  );
  PERFORM public.add_season_xp(v_user, 'lantern_weekly', v_week::text, v_xp);

  RETURN jsonb_build_object('ok', true, 'camly', v_camly, 'xp', v_xp, 'week_start', v_week);
END;
$$;
