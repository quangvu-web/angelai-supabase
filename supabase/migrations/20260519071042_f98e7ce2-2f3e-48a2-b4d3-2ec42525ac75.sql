CREATE OR REPLACE FUNCTION public.tg_mastery_from_season_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.amount > 0 THEN
    PERFORM public.add_mastery_xp(
      NEW.user_id,
      COALESCE(NEW.source, 'season') || ':season',
      COALESCE(NEW.ref_id, NEW.id::text),
      NEW.amount
    );
  END IF;
  RETURN NEW;
END;
$$;