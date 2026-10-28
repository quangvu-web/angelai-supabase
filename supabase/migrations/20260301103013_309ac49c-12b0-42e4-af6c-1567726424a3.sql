
CREATE OR REPLACE FUNCTION public.get_mint_request_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'pending', COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
    'signed', COALESCE(SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END), 0),
    'minted', COALESCE(SUM(CASE WHEN status = 'minted' THEN 1 ELSE 0 END), 0),
    'pending_fun', COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0),
    'signed_fun', COALESCE(SUM(CASE WHEN status = 'signed' THEN amount ELSE 0 END), 0),
    'minted_fun', COALESCE(SUM(CASE WHEN status = 'minted' THEN amount ELSE 0 END), 0)
  )
  FROM pplp_mint_requests;
$$;
