
-- =============================================
-- STEP 1: Event-based Scoring Model Migration
-- =============================================

-- 1. Create reputation_level enum
DO $$ BEGIN
  CREATE TYPE public.reputation_level AS ENUM ('seed', 'sprout', 'builder', 'guardian', 'architect');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pplp_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pplp_version TEXT,
  ADD COLUMN IF NOT EXISTS mantra_ack_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reputation_level TEXT DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS reputation_score NUMERIC DEFAULT 0;

-- 3. Create pplp_events (append-only event store)
CREATE TABLE IF NOT EXISTS public.pplp_events (
  event_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_user_id UUID NOT NULL,
  target_type TEXT DEFAULT 'system',
  target_id UUID,
  context_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'web',
  payload_json JSONB DEFAULT '{}',
  ingest_hash TEXT,
  scoring_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pplp_events_actor ON public.pplp_events (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_pplp_events_type ON public.pplp_events (event_type);
CREATE INDEX IF NOT EXISTS idx_pplp_events_occurred ON public.pplp_events (occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pplp_events_ingest_hash ON public.pplp_events (ingest_hash) WHERE ingest_hash IS NOT NULL;

ALTER TABLE public.pplp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events"
  ON public.pplp_events FOR SELECT
  USING (auth.uid() = actor_user_id);

CREATE POLICY "Service role can insert events"
  ON public.pplp_events FOR INSERT
  WITH CHECK (true);

-- 4. Create pplp_ratings (5-pillar community ratings)
CREATE TABLE IF NOT EXISTS public.pplp_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL,
  rater_user_id UUID NOT NULL,
  pillar_truth SMALLINT NOT NULL DEFAULT 0 CHECK (pillar_truth >= 0 AND pillar_truth <= 2),
  pillar_sustain SMALLINT NOT NULL DEFAULT 0 CHECK (pillar_sustain >= 0 AND pillar_sustain <= 2),
  pillar_heal_love SMALLINT NOT NULL DEFAULT 0 CHECK (pillar_heal_love >= 0 AND pillar_heal_love <= 2),
  pillar_life_service SMALLINT NOT NULL DEFAULT 0 CHECK (pillar_life_service >= 0 AND pillar_life_service <= 2),
  pillar_unity_source SMALLINT NOT NULL DEFAULT 0 CHECK (pillar_unity_source >= 0 AND pillar_unity_source <= 2),
  comment TEXT,
  weight_applied NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(content_id, rater_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pplp_ratings_content ON public.pplp_ratings (content_id);
CREATE INDEX IF NOT EXISTS idx_pplp_ratings_rater ON public.pplp_ratings (rater_user_id);

ALTER TABLE public.pplp_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ratings"
  ON public.pplp_ratings FOR SELECT USING (true);

CREATE POLICY "Users can create ratings"
  ON public.pplp_ratings FOR INSERT
  WITH CHECK (auth.uid() = rater_user_id);

CREATE POLICY "Users can update own ratings"
  ON public.pplp_ratings FOR UPDATE
  USING (auth.uid() = rater_user_id);

-- 5. Create features_user_day (materialized daily features)
CREATE TABLE IF NOT EXISTS public.features_user_day (
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  count_posts INTEGER DEFAULT 0,
  count_comments INTEGER DEFAULT 0,
  count_help INTEGER DEFAULT 0,
  count_reports_valid INTEGER DEFAULT 0,
  count_questions INTEGER DEFAULT 0,
  count_journals INTEGER DEFAULT 0,
  count_logins INTEGER DEFAULT 0,
  avg_rating_weighted NUMERIC DEFAULT 0,
  consistency_streak INTEGER DEFAULT 0,
  sequence_count INTEGER DEFAULT 0,
  anti_farm_risk NUMERIC DEFAULT 0,
  onchain_value_score NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_features_user_day_user ON public.features_user_day (user_id);

ALTER TABLE public.features_user_day ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own features"
  ON public.features_user_day FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage features"
  ON public.features_user_day FOR ALL
  USING (true) WITH CHECK (true);

-- 6. Create light_score_ledger (periodic aggregated scores)
CREATE TABLE IF NOT EXISTS public.light_score_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  base_score NUMERIC DEFAULT 0,
  reputation_weight NUMERIC DEFAULT 1.0,
  consistency_multiplier NUMERIC DEFAULT 1.0,
  sequence_multiplier NUMERIC DEFAULT 1.0,
  integrity_penalty NUMERIC DEFAULT 0,
  final_light_score NUMERIC DEFAULT 0,
  level TEXT DEFAULT 'seed',
  explain_ref UUID,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_light_score_ledger_user ON public.light_score_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_light_score_ledger_period ON public.light_score_ledger (period, period_start DESC);

ALTER TABLE public.light_score_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ledger"
  ON public.light_score_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage ledger"
  ON public.light_score_ledger FOR ALL
  USING (true) WITH CHECK (true);

-- 7. Create score_explanations (audit trail)
CREATE TABLE IF NOT EXISTS public.score_explanations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  top_contributors_json JSONB DEFAULT '[]',
  penalties_json JSONB DEFAULT '[]',
  ai_pillar_scores JSONB,
  ai_ego_risk NUMERIC,
  ai_explanation TEXT,
  version TEXT DEFAULT 'v2.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_explanations_user ON public.score_explanations (user_id);

ALTER TABLE public.score_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own explanations"
  ON public.score_explanations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage explanations"
  ON public.score_explanations FOR ALL
  USING (true) WITH CHECK (true);

-- 8. Create content_unified view
CREATE OR REPLACE VIEW public.content_unified AS
  SELECT 
    id AS content_id,
    user_id AS author_user_id,
    'post' AS content_type,
    content AS content_text,
    NULL::TEXT AS root_content_id,
    'public' AS visibility,
    metadata AS metadata_json,
    created_at
  FROM public.community_posts
  UNION ALL
  SELECT
    id AS content_id,
    user_id AS author_user_id,
    'journal' AS content_type,
    content AS content_text,
    NULL AS root_content_id,
    'private' AS visibility,
    NULL AS metadata_json,
    created_at
  FROM public.gratitude_journal
  UNION ALL
  SELECT
    id AS content_id,
    user_id AS author_user_id,
    'chat' AS content_type,
    question_text AS content_text,
    session_id::TEXT AS root_content_id,
    'private' AS visibility,
    NULL AS metadata_json,
    created_at
  FROM public.chat_history;

-- 9. RPC: build_features_user_day
CREATE OR REPLACE FUNCTION public.build_features_user_day(_user_id UUID, _date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_posts INTEGER;
  v_comments INTEGER;
  v_help INTEGER;
  v_questions INTEGER;
  v_journals INTEGER;
  v_logins INTEGER;
  v_avg_rating NUMERIC;
  v_streak INTEGER;
  v_sequences INTEGER;
  v_anti_farm NUMERIC;
BEGIN
  -- Count posts
  SELECT COUNT(*) INTO v_posts
  FROM community_posts WHERE user_id = _user_id AND DATE(created_at) = _date;
  
  -- Count comments
  SELECT COUNT(*) INTO v_comments
  FROM community_comments WHERE user_id = _user_id AND DATE(created_at) = _date;
  
  -- Count help
  SELECT COUNT(*) INTO v_help
  FROM community_helps WHERE helper_id = _user_id AND DATE(created_at) = _date;
  
  -- Count questions
  SELECT COUNT(*) INTO v_questions
  FROM chat_questions WHERE user_id = _user_id AND DATE(created_at) = _date AND is_rewarded = true;
  
  -- Count journals
  SELECT COUNT(*) INTO v_journals
  FROM gratitude_journal WHERE user_id = _user_id AND DATE(created_at) = _date;
  
  -- Count logins
  SELECT COUNT(*) INTO v_logins
  FROM daily_login_tracking WHERE user_id = _user_id AND login_date = _date;
  
  -- Average weighted rating received
  SELECT COALESCE(AVG(
    (r.pillar_truth + r.pillar_sustain + r.pillar_heal_love + r.pillar_life_service + r.pillar_unity_source) * r.weight_applied / 5.0
  ), 0) INTO v_avg_rating
  FROM pplp_ratings r
  JOIN community_posts p ON r.content_id = p.id
  WHERE p.user_id = _user_id AND DATE(r.created_at) = _date;
  
  -- Consistency streak
  SELECT COALESCE(streak_count, 0) INTO v_streak
  FROM daily_login_tracking WHERE user_id = _user_id AND login_date = _date;
  
  -- Active sequences
  SELECT COUNT(*) INTO v_sequences
  FROM pplp_behavior_sequences WHERE user_id = _user_id AND status = 'active';
  
  -- Anti-farm risk from fraud signals
  SELECT COALESCE(AVG(severity), 0) INTO v_anti_farm
  FROM pplp_fraud_signals WHERE actor_id = _user_id AND is_resolved = false;
  
  -- Upsert
  INSERT INTO features_user_day (user_id, date, count_posts, count_comments, count_help, count_questions, count_journals, count_logins, avg_rating_weighted, consistency_streak, sequence_count, anti_farm_risk, updated_at)
  VALUES (_user_id, _date, v_posts, v_comments, v_help, v_questions, v_journals, v_logins, v_avg_rating, v_streak, v_sequences, v_anti_farm, now())
  ON CONFLICT (user_id, date) DO UPDATE SET
    count_posts = EXCLUDED.count_posts,
    count_comments = EXCLUDED.count_comments,
    count_help = EXCLUDED.count_help,
    count_questions = EXCLUDED.count_questions,
    count_journals = EXCLUDED.count_journals,
    count_logins = EXCLUDED.count_logins,
    avg_rating_weighted = EXCLUDED.avg_rating_weighted,
    consistency_streak = EXCLUDED.consistency_streak,
    sequence_count = EXCLUDED.sequence_count,
    anti_farm_risk = EXCLUDED.anti_farm_risk,
    updated_at = now();
END;
$$;

-- 10. RPC: compute_light_score_ledger
CREATE OR REPLACE FUNCTION public.compute_light_score_ledger(_user_id UUID, _period TEXT, _start TIMESTAMPTZ, _end TIMESTAMPTZ)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_base NUMERIC;
  v_rep_weight NUMERIC;
  v_consistency NUMERIC;
  v_seq_mult NUMERIC;
  v_penalty NUMERIC;
  v_final NUMERIC;
  v_level TEXT;
  v_explain_id UUID;
  v_ledger_id UUID;
  v_top_contributors JSONB;
  v_penalties JSONB;
BEGIN
  -- Calculate base score from pplp_scores in period
  SELECT COALESCE(AVG(light_score), 0) INTO v_base
  FROM pplp_scores s
  JOIN pplp_actions a ON s.action_id = a.id
  WHERE a.actor_id = _user_id AND a.created_at BETWEEN _start AND _end;
  
  -- Get reputation weight
  SELECT COALESCE(public.calculate_reputation_weight(_user_id), 1.0) INTO v_rep_weight;
  
  -- Get consistency multiplier
  SELECT COALESCE(public.calculate_consistency_multiplier(_user_id), 1.0) INTO v_consistency;
  
  -- Get sequence multiplier (avg bonus from completed sequences in period)
  SELECT COALESCE(AVG(sequence_multiplier), 1.0) INTO v_seq_mult
  FROM pplp_behavior_sequences
  WHERE user_id = _user_id AND status = 'completed'
    AND completed_at BETWEEN _start AND _end;
  
  -- Get integrity penalty
  SELECT COALESCE(SUM(severity) * 5, 0) INTO v_penalty
  FROM pplp_fraud_signals
  WHERE actor_id = _user_id AND is_resolved = false;
  v_penalty := LEAST(v_penalty, 50);
  
  -- Calculate final score
  v_final := v_base * v_rep_weight * v_consistency * v_seq_mult * (1 - v_penalty / 100.0);
  
  -- Determine level
  v_level := CASE
    WHEN v_final >= 90 THEN 'architect'
    WHEN v_final >= 75 THEN 'guardian'
    WHEN v_final >= 60 THEN 'builder'
    WHEN v_final >= 40 THEN 'sprout'
    ELSE 'seed'
  END;
  
  -- Build top contributors
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'action_type', a.action_type,
    'light_score', s.light_score,
    'reward', s.final_reward
  ) ORDER BY s.light_score DESC), '[]'::JSONB) INTO v_top_contributors
  FROM (
    SELECT s2.light_score, s2.final_reward, a2.action_type
    FROM pplp_scores s2
    JOIN pplp_actions a2 ON s2.action_id = a2.id
    WHERE a2.actor_id = _user_id AND a2.created_at BETWEEN _start AND _end
    ORDER BY s2.light_score DESC LIMIT 5
  ) s JOIN pplp_actions a ON true LIMIT 5;
  
  -- Simpler top contributors query
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB) INTO v_top_contributors
  FROM (
    SELECT a.action_type, s.light_score, s.final_reward
    FROM pplp_scores s
    JOIN pplp_actions a ON s.action_id = a.id
    WHERE a.actor_id = _user_id AND a.created_at BETWEEN _start AND _end
    ORDER BY s.light_score DESC LIMIT 5
  ) t;
  
  -- Build penalties
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB) INTO v_penalties
  FROM (
    SELECT signal_type, severity, created_at
    FROM pplp_fraud_signals
    WHERE actor_id = _user_id AND is_resolved = false
    ORDER BY severity DESC LIMIT 5
  ) t;
  
  -- Insert explanation
  INSERT INTO score_explanations (user_id, top_contributors_json, penalties_json, version)
  VALUES (_user_id, v_top_contributors, v_penalties, 'v2.0')
  RETURNING id INTO v_explain_id;
  
  -- Upsert ledger
  INSERT INTO light_score_ledger (user_id, period, period_start, period_end, base_score, reputation_weight, consistency_multiplier, sequence_multiplier, integrity_penalty, final_light_score, level, explain_ref)
  VALUES (_user_id, _period, _start, _end, v_base, v_rep_weight, v_consistency, v_seq_mult, v_penalty, v_final, v_level, v_explain_id)
  ON CONFLICT (user_id, period, period_start) DO UPDATE SET
    base_score = EXCLUDED.base_score,
    reputation_weight = EXCLUDED.reputation_weight,
    consistency_multiplier = EXCLUDED.consistency_multiplier,
    sequence_multiplier = EXCLUDED.sequence_multiplier,
    integrity_penalty = EXCLUDED.integrity_penalty,
    final_light_score = EXCLUDED.final_light_score,
    level = EXCLUDED.level,
    explain_ref = EXCLUDED.explain_ref,
    computed_at = now()
  RETURNING id INTO v_ledger_id;
  
  -- Update profile reputation
  UPDATE profiles SET
    reputation_level = v_level,
    reputation_score = v_final
  WHERE user_id = _user_id;
  
  RETURN v_ledger_id;
END;
$$;

-- 11. Trigger: Auto-insert pplp_events when pplp_actions is inserted
CREATE OR REPLACE FUNCTION public.bridge_action_to_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO pplp_events (
    event_type,
    actor_user_id,
    target_type,
    target_id,
    occurred_at,
    source,
    payload_json,
    scoring_tags
  ) VALUES (
    COALESCE(NEW.action_type, 'UNKNOWN'),
    NEW.actor_id,
    'content',
    NEW.target_id,
    COALESCE(NEW.created_at, now()),
    COALESCE((NEW.metadata->>'auth_source')::TEXT, 'web'),
    jsonb_build_object(
      'action_id', NEW.id,
      'platform_id', NEW.platform_id,
      'policy_version', NEW.policy_version,
      'evidence_hash', NEW.evidence_hash,
      'canonical_hash', NEW.canonical_hash
    ),
    CASE
      WHEN NEW.action_type IN ('POST_CREATE', 'COMMENT_CREATE', 'JOURNAL_WRITE', 'QUESTION_ASK') THEN ARRAY['pplp_pillar_candidate']
      WHEN NEW.action_type IN ('MENTOR_HELP', 'HELP_NEWBIE', 'CONFLICT_RESOLVE') THEN ARRAY['sequence_candidate']
      ELSE ARRAY[]::TEXT[]
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_action_to_event ON public.pplp_actions;
CREATE TRIGGER trg_bridge_action_to_event
  AFTER INSERT ON public.pplp_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.bridge_action_to_event();
