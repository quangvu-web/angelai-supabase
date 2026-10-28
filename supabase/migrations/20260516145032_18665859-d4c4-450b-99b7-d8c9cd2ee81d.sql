
-- Admin-only plaintext storage for clue answers
CREATE TABLE IF NOT EXISTS public.treasure_clue_answer_words (
  clue_id uuid PRIMARY KEY REFERENCES public.treasure_clues(id) ON DELETE CASCADE,
  words text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.treasure_clue_answer_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage clue words"
ON public.treasure_clue_answer_words
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Set answers for a clue (admin only). Hashes words and writes to treasure_clues.answer_hashes.
CREATE OR REPLACE FUNCTION public.admin_set_clue_answers(
  p_clue_id uuid,
  p_words text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clean text[];
  v_hashes text[];
  w text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  IF p_words IS NULL OR array_length(p_words, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'words_empty');
  END IF;

  -- Normalize: lowercase, trim, dedupe, drop empties
  SELECT array_agg(DISTINCT lower(btrim(x)))
  INTO v_clean
  FROM unnest(p_words) AS x
  WHERE btrim(x) <> '';

  IF v_clean IS NULL OR array_length(v_clean, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'words_empty');
  END IF;

  IF array_length(v_clean, 1) > 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_words');
  END IF;

  v_hashes := ARRAY[]::text[];
  FOREACH w IN ARRAY v_clean LOOP
    v_hashes := v_hashes || encode(extensions.digest(w, 'sha256'), 'hex');
  END LOOP;

  UPDATE public.treasure_clues
  SET answer_hashes = v_hashes,
      answer_hash = v_hashes[1]
  WHERE id = p_clue_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'clue_not_found');
  END IF;

  INSERT INTO public.treasure_clue_answer_words (clue_id, words, updated_at, updated_by)
  VALUES (p_clue_id, v_clean, now(), v_uid)
  ON CONFLICT (clue_id) DO UPDATE
  SET words = EXCLUDED.words,
      updated_at = now(),
      updated_by = v_uid;

  RETURN jsonb_build_object('success', true, 'count', array_length(v_clean, 1), 'words', v_clean);
END;
$$;

-- List clues with current plaintext words (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_treasure_clues()
RETURNS TABLE (
  clue_id uuid,
  event_id uuid,
  event_title text,
  seq int,
  title text,
  description text,
  points int,
  words text[],
  hashes_count int,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT c.id, c.event_id, e.title, c.seq, c.title, c.description, c.points,
         COALESCE(w.words, ARRAY[]::text[]),
         COALESCE(array_length(c.answer_hashes, 1), 0),
         w.updated_at
  FROM public.treasure_clues c
  JOIN public.treasure_events e ON e.id = c.event_id
  LEFT JOIN public.treasure_clue_answer_words w ON w.clue_id = c.id
  ORDER BY e.starts_at DESC NULLS LAST, c.seq ASC;
END;
$$;
