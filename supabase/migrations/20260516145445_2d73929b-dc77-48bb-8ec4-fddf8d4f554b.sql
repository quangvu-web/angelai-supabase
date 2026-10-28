CREATE OR REPLACE FUNCTION public.grant_box_ticket(
  p_user_id uuid, p_tier_code text, p_source text, p_source_ref text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_id UUID;
  v_seed TEXT;
BEGIN
  v_seed := encode(extensions.gen_random_bytes(16), 'hex');
  INSERT INTO public.box_tickets(user_id, tier_code, source, source_ref, server_seed)
  VALUES (p_user_id, p_tier_code, p_source, p_source_ref, v_seed)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;