-- 1) Add array column
ALTER TABLE public.treasure_clues
  ADD COLUMN IF NOT EXISTS answer_hashes text[] NOT NULL DEFAULT '{}';

-- 2) Backfill from legacy single hash
UPDATE public.treasure_clues
   SET answer_hashes = ARRAY[answer_hash]
 WHERE (answer_hashes IS NULL OR cardinality(answer_hashes) = 0)
   AND answer_hash IS NOT NULL;

-- 3) Update RPC to check ANY of the hashes
CREATE OR REPLACE FUNCTION public.submit_treasure_answer(p_clue_id uuid, p_answer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_clue RECORD; v_event RECORD; v_team_id UUID;
  v_normalized TEXT; v_hash TEXT; v_last TIMESTAMPTZ; v_wait INT; v_correct BOOLEAN;
  v_cooldown_seconds INT := 60;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO v_clue FROM public.treasure_clues WHERE id = p_clue_id;
  IF v_clue IS NULL THEN RAISE EXCEPTION 'clue not found'; END IF;
  SELECT * INTO v_event FROM public.treasure_events WHERE id = v_clue.event_id;
  IF v_event.status <> 'active' OR now() < v_event.starts_at OR now() > v_event.ends_at THEN
    RAISE EXCEPTION 'event not active'; END IF;
  IF EXISTS (SELECT 1 FROM public.treasure_progress WHERE user_id=v_user AND clue_id=p_clue_id) THEN
    RETURN jsonb_build_object('already_solved', true); END IF;

  SELECT max(attempted_at) INTO v_last
    FROM public.treasure_attempt_log
    WHERE user_id=v_user AND clue_id=p_clue_id;
  IF v_last IS NOT NULL AND v_last > now() - make_interval(secs => v_cooldown_seconds) THEN
    v_wait := GREATEST(1, v_cooldown_seconds - EXTRACT(EPOCH FROM (now() - v_last))::INT);
    RETURN jsonb_build_object('rate_limited', true, 'wait_seconds', v_wait);
  END IF;

  v_normalized := lower(trim(coalesce(p_answer,'')));
  v_hash := encode(sha256(convert_to(v_normalized, 'UTF8')), 'hex');
  v_correct := (v_hash = ANY(COALESCE(v_clue.answer_hashes, ARRAY[]::text[])))
               OR (v_hash = v_clue.answer_hash);
  INSERT INTO public.treasure_attempt_log(user_id,clue_id,correct) VALUES (v_user,p_clue_id,v_correct);
  IF NOT v_correct THEN
    RETURN jsonb_build_object('correct', false, 'cooldown_seconds', v_cooldown_seconds);
  END IF;

  SELECT m.team_id INTO v_team_id FROM public.treasure_team_members m
    JOIN public.treasure_teams t ON t.id=m.team_id
    WHERE m.user_id=v_user AND t.event_id=v_event.id LIMIT 1;
  INSERT INTO public.treasure_progress(event_id,user_id,clue_id,team_id)
    VALUES (v_event.id,v_user,p_clue_id,v_team_id);
  INSERT INTO public.treasure_fragments(user_id,event_id,fragment_index)
    VALUES (v_user,v_event.id,v_clue.seq) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('correct',true,'fragment_index',v_clue.seq,'points',v_clue.points);
END;
$function$;