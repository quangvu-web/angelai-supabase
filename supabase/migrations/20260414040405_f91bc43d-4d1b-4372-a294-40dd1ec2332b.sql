
-- ============================================================
-- Phase C: Dedicated proofs table
-- ============================================================

CREATE TABLE public.proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES public.pplp_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  proof_type TEXT NOT NULL DEFAULT 'url',
  proof_url TEXT,
  file_hash TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT proofs_type_check CHECK (proof_type IN ('url', 'image', 'video', 'file', 'log')),
  CONSTRAINT proofs_status_check CHECK (status IN ('pending', 'verified', 'rejected', 'duplicate'))
);

CREATE INDEX idx_proofs_action_id ON public.proofs(action_id);
CREATE INDEX idx_proofs_user_id ON public.proofs(user_id);
CREATE INDEX idx_proofs_file_hash ON public.proofs(file_hash) WHERE file_hash IS NOT NULL;

ALTER TABLE public.proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own proofs"
  ON public.proofs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proofs"
  ON public.proofs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Phase D: Attendance Events table (Zoom / Livestream / Love House)
-- Named "attendance_events" to avoid conflict with existing pplp_events (event log)
-- ============================================================

CREATE TABLE public.attendance_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'zoom',
  host_user_id UUID NOT NULL,
  zoom_link TEXT,
  meeting_id TEXT,
  livestream_link TEXT,
  duration_minutes INT NOT NULL DEFAULT 0,
  event_date TIMESTAMPTZ NOT NULL,
  event_proof_score NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT att_events_type_check CHECK (event_type IN ('zoom', 'livestream', 'love_house', 'meditation', 'workshop')),
  CONSTRAINT att_events_status_check CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled'))
);

CREATE INDEX idx_att_events_host ON public.attendance_events(host_user_id);
CREATE INDEX idx_att_events_date ON public.attendance_events(event_date);

ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view events"
  ON public.attendance_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Hosts can create events"
  ON public.attendance_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update their events"
  ON public.attendance_events FOR UPDATE TO authenticated
  USING (auth.uid() = host_user_id);

-- ============================================================
-- Phase D: Groups table (Love House subgroups)
-- ============================================================

CREATE TABLE public.pplp_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.attendance_events(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  leader_user_id UUID NOT NULL,
  leader_confirmed BOOLEAN NOT NULL DEFAULT false,
  participant_estimate INT NOT NULL DEFAULT 0,
  photo_proof_url TEXT,
  video_proof_url TEXT,
  group_confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pplp_groups_event ON public.pplp_groups(event_id);
CREATE INDEX idx_pplp_groups_leader ON public.pplp_groups(leader_user_id);

ALTER TABLE public.pplp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view groups"
  ON public.pplp_groups FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Leaders can create groups"
  ON public.pplp_groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = leader_user_id);

CREATE POLICY "Leaders can update their groups"
  ON public.pplp_groups FOR UPDATE TO authenticated
  USING (auth.uid() = leader_user_id);

-- ============================================================
-- Phase D: Attendance table (per-user participation)
-- ============================================================

CREATE TABLE public.pplp_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.attendance_events(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.pplp_groups(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  app_check_in TIMESTAMPTZ,
  app_check_out TIMESTAMPTZ,
  host_confirmed BOOLEAN NOT NULL DEFAULT false,
  reflection_submitted BOOLEAN NOT NULL DEFAULT false,
  reflection_text TEXT,
  duration_estimate NUMERIC(5,2) DEFAULT 0,
  optional_presence_signal BOOLEAN NOT NULL DEFAULT false,
  participation_factor NUMERIC(3,2) NOT NULL DEFAULT 0,
  light_score_earned NUMERIC(10,4) DEFAULT 0,
  action_id UUID REFERENCES public.pplp_actions(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_unique UNIQUE (event_id, user_id)
);

CREATE INDEX idx_pplp_attendance_event ON public.pplp_attendance(event_id);
CREATE INDEX idx_pplp_attendance_user ON public.pplp_attendance(user_id);

ALTER TABLE public.pplp_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attendance"
  ON public.pplp_attendance FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attendance"
  ON public.pplp_attendance FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance"
  ON public.pplp_attendance FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Compute participation factor (Pseudocode §8 Step C)
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_participation_factor(_attendance_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _att RECORD;
  _factor NUMERIC := 0;
BEGIN
  SELECT * INTO _att FROM public.pplp_attendance WHERE id = _attendance_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF _att.app_check_in IS NOT NULL THEN _factor := _factor + 0.25; END IF;
  IF _att.app_check_out IS NOT NULL THEN _factor := _factor + 0.20; END IF;
  IF _att.host_confirmed THEN _factor := _factor + 0.25; END IF;
  IF _att.reflection_submitted THEN _factor := _factor + 0.15; END IF;
  IF _att.duration_estimate >= 0.8 THEN _factor := _factor + 0.10; END IF;
  IF _att.optional_presence_signal THEN _factor := _factor + 0.05; END IF;

  _factor := LEAST(_factor, 1.0);

  UPDATE public.pplp_attendance 
  SET participation_factor = _factor, updated_at = now()
  WHERE id = _attendance_id;

  RETURN _factor;
END;
$$;

-- ============================================================
-- Triggers for updated_at
-- ============================================================

CREATE TRIGGER update_proofs_updated_at
  BEFORE UPDATE ON public.proofs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_att_events_updated_at
  BEFORE UPDATE ON public.attendance_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pplp_groups_updated_at
  BEFORE UPDATE ON public.pplp_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pplp_attendance_updated_at
  BEFORE UPDATE ON public.pplp_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
