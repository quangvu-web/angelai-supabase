
-- ============================================================================
-- FUN.RICH MINI GAME — PHASE 1: DAILY LIGHT QUEST
-- ============================================================================

-- 1) quest_templates -----------------------------------------------------------
CREATE TABLE public.quest_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  dimension text NOT NULL CHECK (dimension IN ('S','T','H','C','U','bonus')),
  title_vi text NOT NULL,
  title_en text NOT NULL,
  description_vi text,
  description_en text,
  icon text DEFAULT 'sparkles',
  base_xp integer NOT NULL DEFAULT 30,
  base_camly integer NOT NULL DEFAULT 5,
  weight numeric NOT NULL DEFAULT 1.0,
  daily_cap integer NOT NULL DEFAULT 1,
  requires_evidence boolean NOT NULL DEFAULT false,
  evidence_type text,
  active boolean NOT NULL DEFAULT true,
  phase integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quest_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active quests"
  ON public.quest_templates FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Admins manage quests"
  ON public.quest_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) user_daily_quests ---------------------------------------------------------
CREATE TABLE public.user_daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.quest_templates(id) ON DELETE CASCADE,
  assigned_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','expired','frozen')),
  evidence_ref text,
  ai_score numeric,
  risk_score numeric,
  multiplier_applied numeric DEFAULT 1.0,
  xp_awarded integer DEFAULT 0,
  camly_awarded integer DEFAULT 0,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id, assigned_date)
);

CREATE INDEX idx_udq_user_date ON public.user_daily_quests(user_id, assigned_date DESC);
CREATE INDEX idx_udq_status ON public.user_daily_quests(status) WHERE status IN ('pending','in_progress');

ALTER TABLE public.user_daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own quests"
  ON public.user_daily_quests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own quests"
  ON public.user_daily_quests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage all quests"
  ON public.user_daily_quests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) user_quest_streaks --------------------------------------------------------
CREATE TABLE public.user_quest_streaks (
  user_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_claim_date date,
  multiplier numeric NOT NULL DEFAULT 1.0,
  grace_used_month integer DEFAULT 0,
  grace_month_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_quest_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own streak"
  ON public.user_quest_streaks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all streaks"
  ON public.user_quest_streaks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) user_xp_ledger ------------------------------------------------------------
CREATE TABLE public.user_xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  source text NOT NULL,
  source_ref uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_xp_user_created ON public.user_xp_ledger(user_id, created_at DESC);

ALTER TABLE public.user_xp_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own xp"
  ON public.user_xp_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5) quest_evidence_audit ------------------------------------------------------
CREATE TABLE public.quest_evidence_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.user_daily_quests(id) ON DELETE CASCADE,
  ai_score numeric,
  risk_score numeric,
  decision text NOT NULL CHECK (decision IN ('approved','rejected','review')),
  ai_model text,
  raw_response jsonb,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quest_evidence_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit"
  ON public.quest_evidence_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- RPC: claim_quest_reward
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_quest_reward(
  p_quest_id uuid,
  p_evidence_ref text DEFAULT NULL,
  p_ai_score numeric DEFAULT 1.0,
  p_risk_score numeric DEFAULT 0.0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_quest RECORD;
  v_template RECORD;
  v_streak RECORD;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_mult numeric := 1.0;
  v_new_streak integer;
  v_xp integer;
  v_camly integer;
  v_month_key text := to_char(v_today, 'YYYY-MM');
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_quest FROM public.user_daily_quests
    WHERE id = p_quest_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'quest_not_found');
  END IF;
  IF v_quest.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_completed');
  END IF;
  IF v_quest.status = 'frozen' THEN
    RETURN jsonb_build_object('success', false, 'error', 'frozen');
  END IF;
  IF p_ai_score < 0.5 THEN
    UPDATE public.user_daily_quests
      SET status = 'frozen', ai_score = p_ai_score, risk_score = p_risk_score
      WHERE id = p_quest_id;
    INSERT INTO public.quest_evidence_audit (claim_id, ai_score, risk_score, decision)
      VALUES (p_quest_id, p_ai_score, p_risk_score, 'rejected');
    RETURN jsonb_build_object('success', false, 'error', 'evidence_rejected', 'ai_score', p_ai_score);
  END IF;

  SELECT * INTO v_template FROM public.quest_templates WHERE id = v_quest.template_id;

  -- Streak update
  SELECT * INTO v_streak FROM public.user_quest_streaks WHERE user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.user_quest_streaks (user_id, current_streak, longest_streak, last_claim_date, multiplier, grace_month_key)
      VALUES (v_user, 1, 1, v_today, 1.0, v_month_key)
      RETURNING * INTO v_streak;
  ELSE
    IF v_streak.last_claim_date = v_today THEN
      v_new_streak := v_streak.current_streak;
    ELSIF v_streak.last_claim_date = v_today - 1 THEN
      v_new_streak := v_streak.current_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;
    v_mult := CASE
      WHEN v_new_streak >= 180 THEN 2.00
      WHEN v_new_streak >= 90  THEN 1.75
      WHEN v_new_streak >= 60  THEN 1.55
      WHEN v_new_streak >= 30  THEN 1.40
      WHEN v_new_streak >= 14  THEN 1.25
      WHEN v_new_streak >= 7   THEN 1.15
      WHEN v_new_streak >= 3   THEN 1.05
      ELSE 1.00
    END;
    UPDATE public.user_quest_streaks
      SET current_streak = v_new_streak,
          longest_streak = GREATEST(longest_streak, v_new_streak),
          last_claim_date = v_today,
          multiplier = v_mult,
          grace_month_key = CASE WHEN grace_month_key = v_month_key THEN grace_month_key ELSE v_month_key END,
          grace_used_month = CASE WHEN grace_month_key = v_month_key THEN grace_used_month ELSE 0 END,
          updated_at = now()
      WHERE user_id = v_user;
  END IF;

  v_xp    := ROUND(v_template.base_xp * v_mult);
  v_camly := ROUND(v_template.base_camly * v_mult);

  -- Mark quest complete
  UPDATE public.user_daily_quests
    SET status = 'completed',
        ai_score = p_ai_score,
        risk_score = p_risk_score,
        multiplier_applied = v_mult,
        xp_awarded = v_xp,
        camly_awarded = v_camly,
        evidence_ref = COALESCE(p_evidence_ref, evidence_ref),
        claimed_at = now()
    WHERE id = p_quest_id;

  -- Audit
  INSERT INTO public.quest_evidence_audit (claim_id, ai_score, risk_score, decision)
    VALUES (p_quest_id, p_ai_score, p_risk_score, 'approved');

  -- XP ledger
  INSERT INTO public.user_xp_ledger (user_id, delta, source, source_ref, metadata)
    VALUES (v_user, v_xp, 'quest_claim', p_quest_id,
            jsonb_build_object('template', v_template.code, 'multiplier', v_mult));

  -- Camly reward (upsert balance + transaction)
  INSERT INTO public.camly_coin_balances (user_id, balance, lifetime_earned)
    VALUES (v_user, v_camly, v_camly)
    ON CONFLICT (user_id) DO UPDATE SET
      balance = camly_coin_balances.balance + v_camly,
      lifetime_earned = camly_coin_balances.lifetime_earned + v_camly,
      updated_at = now();

  INSERT INTO public.camly_coin_transactions (user_id, amount, transaction_type, description, metadata)
    VALUES (v_user, v_camly, 'quest_reward',
            'Daily Light Quest: ' || v_template.code,
            jsonb_build_object('quest_id', p_quest_id, 'multiplier', v_mult, 'xp', v_xp));

  RETURN jsonb_build_object(
    'success', true,
    'xp_awarded', v_xp,
    'camly_awarded', v_camly,
    'multiplier', v_mult,
    'new_streak', COALESCE(v_new_streak, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_quest_reward(uuid, text, numeric, numeric) TO authenticated;

-- ============================================================================
-- SEED 12 QUEST TEMPLATES
-- ============================================================================
INSERT INTO public.quest_templates (code, dimension, title_vi, title_en, description_vi, description_en, icon, base_xp, base_camly, weight, requires_evidence, evidence_type, phase) VALUES
  ('Q_POST_HONEST',   'S', 'Đăng 1 bài chân thành',     'Post one honest update',          'Chia sẻ một điều thật lòng hôm nay.',          'Share one honest moment today.',                'pen-line',     50, 10, 1.0, true, 'post_id',    1),
  ('Q_COMMENT_KIND',  'S', 'Để lại 3 comment tích cực', 'Leave 3 kind comments',           'Chia sẻ năng lượng tích cực với 3 người.',     'Share positive energy with 3 people.',          'message-heart',30,  6, 1.0, true, 'comment_ids',1),
  ('Q_LEARN_LESSON',  'T', 'Học 1 bài Knowledge',       'Complete one Knowledge lesson',   'Mở mang trí tuệ qua một bài học.',             'Expand wisdom through one lesson.',             'book-open',    60, 12, 1.0, true, 'lesson_id',  1),
  ('Q_TIP_FRIEND',    'T', 'Tặng Camly cho 1 bạn',      'Tip Camly to a friend',           'Lan toả lòng biết ơn bằng 1 món quà nhỏ.',     'Share gratitude with a small Camly gift.',      'gift',         40,  8, 0.9, true, 'tx_id',      1),
  ('Q_MEDITATE_5M',   'H', 'Thiền 5 phút',              'Meditate for 5 minutes',          'Tĩnh tâm 5 phút cùng Angel AI.',               'Sit in stillness for 5 minutes with Angel AI.', 'sparkles',     70, 14, 1.1, true, 'session_id', 1),
  ('Q_GRATITUDE',     'H', 'Viết 3 điều biết ơn',       'Write 3 gratitudes',              'Ghi lại 3 điều bạn biết ơn hôm nay.',          'Write down 3 things you are grateful for.',     'heart',        50, 10, 1.0, true, 'gratitude_id',1),
  ('Q_HELP_QUESTION', 'C', 'Trả lời 1 câu hỏi cộng đồng','Answer 1 community question',    'Phụng sự bằng kiến thức của bạn.',             'Serve the community with your knowledge.',      'help-circle',  80, 16, 1.0, true, 'answer_id',  1),
  ('Q_INVITE_FRIEND', 'C', 'Mời 1 người bạn mới',       'Invite a new friend',             'Mời 1 người bạn cùng đi trên con đường ánh sáng.','Invite a friend to walk the path of light.', 'user-plus',   200, 50, 0.5, true, 'invite_id',  1),
  ('Q_SHARE_LIGHT',   'U', 'Chia sẻ 1 câu chuyện ánh sáng','Share a light story',          'Lan toả một câu chuyện truyền cảm hứng.',      'Share an inspiring story.',                     'share-2',      60, 12, 1.0, true, 'post_id',    1),
  ('Q_PLAY_PET',      'U', 'Chơi với Angel Pet 3 phút', 'Play with Angel Pet 3 minutes',   'Tạm thời khóa — sẽ mở ở Phase 3.',             'Locked — opens in Phase 3.',                    'cat',          30,  6, 0.0, false, NULL,        3),
  ('Q_OPEN_BOX',      'bonus','Mở 1 Mystery Box',       'Open a Mystery Box',              'Tạm thời khóa — sẽ mở ở Phase 2.',             'Locked — opens in Phase 2.',                    'package',      20,  0, 0.0, false, NULL,        2),
  ('Q_HUNT_CLUE',     'bonus','Giải 1 Treasure Clue',   'Solve a Treasure Clue',           'Tạm thời khóa — sẽ mở ở Phase 4.',             'Locked — opens in Phase 4.',                    'compass',     100, 25, 0.0, false, NULL,        4)
ON CONFLICT (code) DO NOTHING;
