DROP FUNCTION IF EXISTS public.validate_api_key(text);

CREATE FUNCTION public.validate_api_key(_key_hash text)
RETURNS TABLE(
  api_key_id uuid,
  user_id uuid,
  daily_limit integer,
  current_usage integer,
  is_rate_limited boolean,
  status text,
  scope text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _key_record RECORD;
  _current_usage INTEGER;
BEGIN
  SELECT ak.id, ak.user_id, ak.daily_limit, ak.is_active, ak.expires_at, ak.scope
  INTO _key_record
  FROM public.user_api_keys ak
  WHERE ak.key_hash = _key_hash
  LIMIT 1;

  IF _key_record IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, 0, 0, false, 'not_found'::text, NULL::text;
    RETURN;
  END IF;

  IF NOT _key_record.is_active THEN
    RETURN QUERY SELECT _key_record.id, _key_record.user_id, _key_record.daily_limit, 0, false, 'inactive'::text, _key_record.scope;
    RETURN;
  END IF;

  IF _key_record.expires_at IS NOT NULL AND _key_record.expires_at < now() THEN
    RETURN QUERY SELECT _key_record.id, _key_record.user_id, _key_record.daily_limit, 0, false, 'expired'::text, _key_record.scope;
    RETURN;
  END IF;

  SELECT COALESCE(u.request_count, 0)
  INTO _current_usage
  FROM public.api_key_usage u
  WHERE u.api_key_id = _key_record.id
    AND u.usage_date = CURRENT_DATE;

  IF _current_usage IS NULL THEN
    _current_usage := 0;
  END IF;

  IF _current_usage >= _key_record.daily_limit THEN
    RETURN QUERY SELECT _key_record.id, _key_record.user_id, _key_record.daily_limit, _current_usage, true, 'rate_limited'::text, _key_record.scope;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    _key_record.id,
    _key_record.user_id,
    _key_record.daily_limit,
    _current_usage,
    false,
    'ok'::text,
    COALESCE(_key_record.scope, 'strict');
END;
$function$;