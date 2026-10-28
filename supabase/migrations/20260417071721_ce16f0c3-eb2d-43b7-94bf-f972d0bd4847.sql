
-- =========================================
-- Auto-issue Trust SBT khi tier upgrade
-- =========================================
CREATE OR REPLACE FUNCTION public.auto_issue_trust_sbt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _subtype text;
  _existing_count int;
BEGIN
  -- Only proceed when tier actually upgrades to T2+
  IF NEW.trust_tier IS NULL OR NEW.trust_tier NOT IN ('T2', 'T3', 'T4') THEN
    RETURN NEW;
  END IF;

  IF OLD.trust_tier = NEW.trust_tier THEN
    RETURN NEW;
  END IF;

  _subtype := CASE NEW.trust_tier
    WHEN 'T2' THEN 'trust_verified'
    WHEN 'T3' THEN 'trust_proven'
    WHEN 'T4' THEN 'trust_master'
  END;

  -- Skip if already issued
  SELECT COUNT(*) INTO _existing_count
  FROM public.sbt_registry
  WHERE did_id = NEW.did_id
    AND sbt_type = 'trust'
    AND sbt_subtype = _subtype
    AND status = 'active';

  IF _existing_count > 0 THEN
    RETURN NEW;
  END IF;

  -- Issue SBT
  PERFORM public.issue_sbt(
    NEW.did_id,
    'trust',
    _subtype,
    'system:trust-engine',
    jsonb_build_object('tier', NEW.trust_tier, 'tc', NEW.tc, 'issued_at', now())
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_trust_sbt ON public.trust_profile;
CREATE TRIGGER trg_auto_trust_sbt
AFTER UPDATE OF trust_tier ON public.trust_profile
FOR EACH ROW
EXECUTE FUNCTION public.auto_issue_trust_sbt();

-- =========================================
-- Search user RPC (cho AttestationDialog)
-- =========================================
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
    d.did_identifier,
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
      d.did_identifier ILIKE '%' || _query || '%'
      OR p.display_name ILIKE '%' || _query || '%'
      OR p.username ILIKE '%' || _query || '%'
      OR u.email ILIKE '%' || _query || '%'
    )
  ORDER BY tp.tc DESC NULLS LAST
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_user_for_attestation(text) TO authenticated;

-- =========================================
-- Realtime cho attestation_log
-- =========================================
ALTER TABLE public.attestation_log REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'attestation_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attestation_log;
  END IF;
END $$;
