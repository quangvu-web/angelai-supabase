
DROP FUNCTION IF EXISTS public.search_user_for_attestation(text);

CREATE OR REPLACE FUNCTION public.search_user_for_attestation(_query text)
RETURNS TABLE (
  did_id uuid,
  did_identifier text,
  display_name text,
  user_email text,
  trust_tier text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _query IS NULL OR length(trim(_query)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.did::text,
    COALESCE(p.display_name, p.username, 'Người dùng')::text,
    u.email::text,
    COALESCE(tp.trust_tier, 'T0')::text
  FROM public.user_dids d
  LEFT JOIN public.profiles p ON p.user_id = d.user_id
  LEFT JOIN auth.users u ON u.id = d.user_id
  LEFT JOIN public.trust_profile tp ON tp.did_id = d.id
  WHERE
    d.user_id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      d.did ILIKE '%' || _query || '%'
      OR p.display_name ILIKE '%' || _query || '%'
      OR p.username ILIKE '%' || _query || '%'
      OR u.email ILIKE '%' || _query || '%'
    )
  ORDER BY tp.tc DESC NULLS LAST
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_user_for_attestation(text) TO authenticated;

-- Fix get_attestations_for_did to use correct column 'did'
CREATE OR REPLACE FUNCTION public.get_attestations_for_did(_did_id uuid)
RETURNS TABLE (
  id uuid,
  direction text,
  counterparty_did uuid,
  counterparty_label text,
  attestation_type text,
  weight numeric,
  status text,
  evidence jsonb,
  created_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    (CASE WHEN a.to_did = _did_id THEN 'received' ELSE 'sent' END)::text,
    (CASE WHEN a.to_did = _did_id THEN a.from_did ELSE a.to_did END),
    COALESCE(
      (SELECT did FROM public.user_dids WHERE id =
        CASE WHEN a.to_did = _did_id THEN a.from_did ELSE a.to_did END
      ),
      'system'
    )::text,
    a.attestation_type,
    a.weight,
    a.status,
    a.evidence,
    a.created_at,
    a.expires_at
  FROM public.attestation_log a
  WHERE a.to_did = _did_id OR a.from_did = _did_id
  ORDER BY a.created_at DESC
  LIMIT 200;
END;
$$;
