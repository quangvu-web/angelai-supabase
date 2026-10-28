CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.create_telegram_link_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code TEXT;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  v_code := lower(encode(extensions.gen_random_bytes(4), 'hex'));

  INSERT INTO public.telegram_link_codes (code, user_id)
  VALUES (v_code, v_uid);

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_telegram_link_code() TO authenticated;