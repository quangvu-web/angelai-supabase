-- Tables
CREATE TABLE public.treasure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  jackpot_tier TEXT NOT NULL DEFAULT 'cosmic' REFERENCES public.box_tiers(code),
  bonus_camly INT NOT NULL DEFAULT 0,
  max_team_size INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.treasure_clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.treasure_events(id) ON DELETE CASCADE,
  seq INT NOT NULL CHECK (seq BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  description TEXT,
  clue_type TEXT NOT NULL DEFAULT 'in_app',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  answer_hash TEXT NOT NULL,
  points INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, seq)
);

CREATE TABLE public.treasure_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.treasure_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.treasure_team_members (
  team_id UUID NOT NULL REFERENCES public.treasure_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(team_id, user_id)
);

CREATE TABLE public.treasure_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.treasure_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  clue_id UUID NOT NULL REFERENCES public.treasure_clues(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.treasure_teams(id) ON DELETE SET NULL,
  solved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, clue_id)
);
CREATE INDEX idx_treasure_progress_user ON public.treasure_progress(user_id, event_id);

CREATE TABLE public.treasure_fragments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.treasure_events(id) ON DELETE CASCADE,
  fragment_index INT NOT NULL CHECK (fragment_index BETWEEN 1 AND 5),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id, fragment_index)
);

CREATE TABLE public.treasure_jackpot_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.treasure_events(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.box_tickets(id),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

CREATE TABLE public.treasure_attempt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clue_id UUID NOT NULL,
  correct BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_treasure_attempt_user ON public.treasure_attempt_log(user_id, attempted_at DESC);

-- Enable RLS
ALTER TABLE public.treasure_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_jackpot_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasure_attempt_log ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "anyone view events" ON public.treasure_events FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin manage events" ON public.treasure_events FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "anyone view clues" ON public.treasure_clues FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin manage clues" ON public.treasure_clues FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "members view team" ON public.treasure_teams FOR SELECT
  USING (auth.uid() = leader_user_id OR EXISTS (
    SELECT 1 FROM public.treasure_team_members m WHERE m.team_id = treasure_teams.id AND m.user_id = auth.uid()
  ));

CREATE POLICY "members view membership" ON public.treasure_team_members FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.treasure_team_members m2 WHERE m2.team_id = treasure_team_members.team_id AND m2.user_id = auth.uid()
  ));

CREATE POLICY "user view own progress" ON public.treasure_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user view own fragments" ON public.treasure_fragments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user view own claims" ON public.treasure_jackpot_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user view own attempts" ON public.treasure_attempt_log FOR SELECT USING (auth.uid() = user_id);

-- RPCs
CREATE OR REPLACE FUNCTION public.submit_treasure_answer(p_clue_id UUID, p_answer TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_clue RECORD; v_event RECORD; v_team_id UUID;
  v_normalized TEXT; v_hash TEXT; v_recent INT; v_correct BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_clue FROM public.treasure_clues WHERE id = p_clue_id;
  IF v_clue IS NULL THEN RAISE EXCEPTION 'clue not found'; END IF;
  SELECT * INTO v_event FROM public.treasure_events WHERE id = v_clue.event_id;
  IF v_event.status <> 'active' OR now() < v_event.starts_at OR now() > v_event.ends_at THEN
    RAISE EXCEPTION 'event not active'; END IF;
  IF EXISTS (SELECT 1 FROM public.treasure_progress WHERE user_id=v_user AND clue_id=p_clue_id) THEN
    RETURN jsonb_build_object('already_solved', true); END IF;
  SELECT count(*) INTO v_recent FROM public.treasure_attempt_log
    WHERE user_id=v_user AND attempted_at > now() - interval '10 minutes';
  IF v_recent >= 1 THEN RAISE EXCEPTION 'rate_limited'; END IF;
  v_normalized := lower(trim(coalesce(p_answer,'')));
  v_hash := encode(digest(v_normalized,'sha256'),'hex');
  v_correct := (v_hash = v_clue.answer_hash);
  INSERT INTO public.treasure_attempt_log(user_id,clue_id,correct) VALUES (v_user,p_clue_id,v_correct);
  IF NOT v_correct THEN RETURN jsonb_build_object('correct', false); END IF;
  SELECT m.team_id INTO v_team_id FROM public.treasure_team_members m
    JOIN public.treasure_teams t ON t.id=m.team_id
    WHERE m.user_id=v_user AND t.event_id=v_event.id LIMIT 1;
  INSERT INTO public.treasure_progress(event_id,user_id,clue_id,team_id)
    VALUES (v_event.id,v_user,p_clue_id,v_team_id);
  INSERT INTO public.treasure_fragments(user_id,event_id,fragment_index)
    VALUES (v_user,v_event.id,v_clue.seq) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('correct',true,'fragment_index',v_clue.seq,'points',v_clue.points);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_treasure_jackpot(p_event_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid(); v_event RECORD; v_count INT; v_ticket UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_event FROM public.treasure_events WHERE id=p_event_id;
  IF v_event IS NULL THEN RAISE EXCEPTION 'event not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.treasure_jackpot_claims WHERE user_id=v_user AND event_id=p_event_id) THEN
    RAISE EXCEPTION 'already claimed'; END IF;
  SELECT count(*) INTO v_count FROM public.treasure_fragments WHERE user_id=v_user AND event_id=p_event_id;
  IF v_count < 5 THEN RAISE EXCEPTION 'need 5 fragments'; END IF;
  v_ticket := public.grant_box_ticket(v_user, v_event.jackpot_tier, 'treasure', p_event_id::text);
  INSERT INTO public.treasure_jackpot_claims(user_id,event_id,ticket_id) VALUES (v_user,p_event_id,v_ticket);
  RETURN jsonb_build_object('ticket_id',v_ticket,'tier',v_event.jackpot_tier);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_treasure_team(p_event_id UUID, p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_team UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.treasure_team_members m JOIN public.treasure_teams t ON t.id=m.team_id
             WHERE m.user_id=v_user AND t.event_id=p_event_id) THEN
    RAISE EXCEPTION 'already in a team'; END IF;
  INSERT INTO public.treasure_teams(event_id,name,leader_user_id) VALUES (p_event_id,p_name,v_user) RETURNING id INTO v_team;
  INSERT INTO public.treasure_team_members(team_id,user_id) VALUES (v_team,v_user);
  RETURN v_team;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_treasure_team(p_team_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_team RECORD; v_event RECORD; v_count INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_team FROM public.treasure_teams WHERE id=p_team_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'team not found'; END IF;
  SELECT * INTO v_event FROM public.treasure_events WHERE id=v_team.event_id;
  IF EXISTS (SELECT 1 FROM public.treasure_team_members m JOIN public.treasure_teams t ON t.id=m.team_id
             WHERE m.user_id=v_user AND t.event_id=v_team.event_id) THEN
    RAISE EXCEPTION 'already in a team'; END IF;
  SELECT count(*) INTO v_count FROM public.treasure_team_members WHERE team_id=p_team_id;
  IF v_count >= v_event.max_team_size THEN RAISE EXCEPTION 'team full'; END IF;
  INSERT INTO public.treasure_team_members(team_id,user_id) VALUES (p_team_id,v_user);
  RETURN TRUE;
END;
$$;