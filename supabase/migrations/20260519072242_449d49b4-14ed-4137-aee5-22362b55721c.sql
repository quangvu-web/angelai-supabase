
-- ============ ENUM: add coin transaction types ============
ALTER TYPE coin_transaction_type ADD VALUE IF NOT EXISTS 'riddle_solve';
ALTER TYPE coin_transaction_type ADD VALUE IF NOT EXISTS 'riddle_spark_exchange';

-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.cosmic_riddles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  riddle_date date NOT NULL,
  idx smallint NOT NULL CHECK (idx BETWEEN 1 AND 3),
  theme text NOT NULL,
  prompt text NOT NULL,
  hint text,
  expected_keywords text[] DEFAULT '{}'::text[],
  meaning text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(riddle_date, idx)
);

CREATE TABLE IF NOT EXISTS public.cosmic_riddle_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  riddle_id uuid NOT NULL REFERENCES public.cosmic_riddles(id) ON DELETE CASCADE,
  answer text NOT NULL,
  ai_score numeric(4,3) NOT NULL DEFAULT 0,
  ai_reason text,
  reward_camly integer NOT NULL DEFAULT 0,
  reward_xp integer NOT NULL DEFAULT 0,
  reward_sparks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, riddle_id)
);

CREATE TABLE IF NOT EXISTS public.user_riddle_sparks (
  user_id uuid PRIMARY KEY,
  sparks integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cosmic_riddles_date ON public.cosmic_riddles(riddle_date DESC);
CREATE INDEX IF NOT EXISTS idx_riddle_attempts_user ON public.cosmic_riddle_attempts(user_id, created_at DESC);

-- ============ RLS ============
ALTER TABLE public.cosmic_riddles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cosmic_riddle_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_riddle_sparks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published riddles"
  ON public.cosmic_riddles FOR SELECT
  USING (published = true);

CREATE POLICY "Users can view own attempts"
  ON public.cosmic_riddle_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sparks"
  ON public.user_riddle_sparks FOR SELECT
  USING (auth.uid() = user_id);

-- ============ RPC: riddle_get_today ============
CREATE OR REPLACE FUNCTION public.riddle_get_today()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_riddles jsonb;
  v_sparks integer;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'idx', r.idx,
    'theme', r.theme,
    'prompt', r.prompt,
    'hint', r.hint,
    'attempted', a.id IS NOT NULL,
    'ai_score', a.ai_score,
    'reward_camly', a.reward_camly,
    'reward_xp', a.reward_xp,
    'reward_sparks', a.reward_sparks,
    'meaning', CASE WHEN a.id IS NOT NULL THEN r.meaning ELSE NULL END
  ) ORDER BY r.idx), '[]'::jsonb)
  INTO v_riddles
  FROM public.cosmic_riddles r
  LEFT JOIN public.cosmic_riddle_attempts a
    ON a.riddle_id = r.id AND a.user_id = v_uid
  WHERE r.riddle_date = v_today AND r.published = true;

  SELECT COALESCE(sparks, 0) INTO v_sparks
  FROM public.user_riddle_sparks WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'riddle_date', v_today,
    'riddles', v_riddles,
    'sparks', COALESCE(v_sparks, 0)
  );
END;
$$;

-- ============ RPC: riddle_record_attempt (service-role only via edge function) ============
CREATE OR REPLACE FUNCTION public.riddle_record_attempt(
  p_user_id uuid,
  p_riddle_id uuid,
  p_answer text,
  p_ai_score numeric,
  p_ai_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_camly integer;
  v_xp integer;
  v_sparks integer;
  v_score numeric := GREATEST(0, LEAST(1, p_ai_score));
  v_existing uuid;
BEGIN
  -- idempotency
  SELECT id INTO v_existing FROM public.cosmic_riddle_attempts
  WHERE user_id = p_user_id AND riddle_id = p_riddle_id;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'already_attempted';
  END IF;

  -- Reward curve: 20–120 Camly + 40–150 XP, 1 spark if score >= 0.7
  v_camly := 20 + floor(v_score * 100)::int;
  v_xp    := 40 + floor(v_score * 110)::int;
  v_sparks := CASE WHEN v_score >= 0.7 THEN 1 ELSE 0 END;

  -- Gate fail: score < 0.4 → no reward
  IF v_score < 0.4 THEN
    v_camly := 0; v_xp := 0; v_sparks := 0;
  END IF;

  INSERT INTO public.cosmic_riddle_attempts (
    user_id, riddle_id, answer, ai_score, ai_reason,
    reward_camly, reward_xp, reward_sparks
  ) VALUES (
    p_user_id, p_riddle_id, p_answer, v_score, p_ai_reason,
    v_camly, v_xp, v_sparks
  );

  -- Pay Camly via existing helper (respects daily cap)
  IF v_camly > 0 THEN
    PERFORM public.add_camly_coins(
      p_user_id, v_camly, 'riddle_solve'::coin_transaction_type,
      'Giải câu đố vũ trụ', jsonb_build_object('riddle_id', p_riddle_id, 'score', v_score)
    );
  END IF;

  -- Add Season XP (mirrors to Mastery via trigger)
  IF v_xp > 0 THEN
    PERFORM public.add_season_xp(p_user_id, v_xp, 'riddle_solve', p_riddle_id::text);
  END IF;

  -- Sparks
  IF v_sparks > 0 THEN
    INSERT INTO public.user_riddle_sparks (user_id, sparks, total_earned)
    VALUES (p_user_id, v_sparks, v_sparks)
    ON CONFLICT (user_id) DO UPDATE
      SET sparks = user_riddle_sparks.sparks + EXCLUDED.sparks,
          total_earned = user_riddle_sparks.total_earned + EXCLUDED.total_earned,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'score', v_score,
    'reward_camly', v_camly,
    'reward_xp', v_xp,
    'reward_sparks', v_sparks
  );
END;
$$;

-- ============ RPC: riddle_exchange_sparks (10 sparks → 1 rare box ticket) ============
CREATE OR REPLACE FUNCTION public.riddle_exchange_sparks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT sparks INTO v_current FROM public.user_riddle_sparks WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_current, 0) < 10 THEN
    RAISE EXCEPTION 'not_enough_sparks';
  END IF;

  UPDATE public.user_riddle_sparks
  SET sparks = sparks - 10,
      total_spent = total_spent + 10,
      updated_at = now()
  WHERE user_id = v_uid;

  -- Grant 1 rare box ticket
  PERFORM public.grant_box_ticket(v_uid, 'rare', 'riddle_spark_exchange', NULL);

  RETURN jsonb_build_object('ok', true, 'sparks_remaining', v_current - 10);
END;
$$;

GRANT EXECUTE ON FUNCTION public.riddle_get_today() TO authenticated;
GRANT EXECUTE ON FUNCTION public.riddle_exchange_sparks() TO authenticated;
