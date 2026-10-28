-- 1) trusted_guardians
CREATE TABLE IF NOT EXISTS public.trusted_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  guardian_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, guardian_user_id),
  CHECK (user_id <> guardian_user_id)
);

CREATE INDEX IF NOT EXISTS idx_guardians_user ON public.trusted_guardians(user_id, status);
CREATE INDEX IF NOT EXISTS idx_guardians_guardian ON public.trusted_guardians(guardian_user_id, status);

ALTER TABLE public.trusted_guardians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own guardians" ON public.trusted_guardians FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = guardian_user_id);
CREATE POLICY "User invites guardian" ON public.trusted_guardians FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Either party updates" ON public.trusted_guardians FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = guardian_user_id);
CREATE POLICY "Admins view all guardians" ON public.trusted_guardians FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) recovery_requests
CREATE TABLE IF NOT EXISTS public.recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('wallet_change','account_unlock','did_recovery','email_recovery')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','expired','cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  required_approvals int NOT NULL DEFAULT 2,
  approvals_count int NOT NULL DEFAULT 0,
  rejections_count int NOT NULL DEFAULT 0,
  reason text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recovery_user ON public.recovery_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recovery_status ON public.recovery_requests(status, expires_at);

ALTER TABLE public.recovery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own recovery requests" ON public.recovery_requests FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Guardians view requests they vote on" ON public.recovery_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.trusted_guardians g
    WHERE g.user_id = recovery_requests.user_id
      AND g.guardian_user_id = auth.uid()
      AND g.status = 'active'
  ));
CREATE POLICY "Admins view all recovery" ON public.recovery_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) recovery_approvals
CREATE TABLE IF NOT EXISTS public.recovery_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.recovery_requests(id) ON DELETE CASCADE,
  guardian_user_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, guardian_user_id)
);

CREATE INDEX IF NOT EXISTS idx_approvals_request ON public.recovery_approvals(request_id);

ALTER TABLE public.recovery_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views approvals on own requests" ON public.recovery_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.recovery_requests r
    WHERE r.id = recovery_approvals.request_id AND r.user_id = auth.uid()
  ));
CREATE POLICY "Guardian views own votes" ON public.recovery_approvals FOR SELECT
  USING (auth.uid() = guardian_user_id);
CREATE POLICY "Admins view all approvals" ON public.recovery_approvals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ===== RPCs =====

-- add_guardian
CREATE OR REPLACE FUNCTION public.add_guardian(_guardian_user_id uuid, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _id uuid;
  _active_count int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _me = _guardian_user_id THEN RAISE EXCEPTION 'Cannot add yourself as guardian'; END IF;

  SELECT COUNT(*) INTO _active_count FROM public.trusted_guardians
  WHERE user_id = _me AND status IN ('pending','active');
  IF _active_count >= 5 THEN RAISE EXCEPTION 'Max 5 guardians allowed'; END IF;

  INSERT INTO public.trusted_guardians (user_id, guardian_user_id, note)
  VALUES (_me, _guardian_user_id, _note)
  ON CONFLICT (user_id, guardian_user_id) DO UPDATE
    SET status = 'pending', invited_at = now(), revoked_at = NULL, updated_at = now()
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- accept_guardian_invite
CREATE OR REPLACE FUNCTION public.accept_guardian_invite(_relationship_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _g_id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT guardian_user_id INTO _g_id FROM public.trusted_guardians WHERE id = _relationship_id;
  IF _g_id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF _g_id <> _me THEN RAISE EXCEPTION 'Only the invited guardian can accept'; END IF;

  UPDATE public.trusted_guardians
  SET status = 'active', accepted_at = now(), updated_at = now()
  WHERE id = _relationship_id AND status = 'pending';

  RETURN FOUND;
END;
$$;

-- revoke_guardian
CREATE OR REPLACE FUNCTION public.revoke_guardian(_relationship_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _u uuid; _g uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id, guardian_user_id INTO _u, _g FROM public.trusted_guardians WHERE id = _relationship_id;
  IF _u IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _me <> _u AND _me <> _g THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE public.trusted_guardians
  SET status = 'revoked', revoked_at = now(), revoked_by = _me, updated_at = now()
  WHERE id = _relationship_id;

  RETURN FOUND;
END;
$$;

-- create_recovery_request
CREATE OR REPLACE FUNCTION public.create_recovery_request(
  _request_type text,
  _payload jsonb DEFAULT '{}'::jsonb,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _active_guardians int;
  _last_request timestamptz;
  _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _request_type NOT IN ('wallet_change','account_unlock','did_recovery','email_recovery') THEN
    RAISE EXCEPTION 'Invalid request_type';
  END IF;

  SELECT COUNT(*) INTO _active_guardians FROM public.trusted_guardians
  WHERE user_id = _me AND status = 'active';
  IF _active_guardians < 3 THEN RAISE EXCEPTION 'Need at least 3 active guardians (have %)', _active_guardians; END IF;

  -- 72h cooldown between requests
  SELECT MAX(created_at) INTO _last_request FROM public.recovery_requests
  WHERE user_id = _me AND status NOT IN ('cancelled','rejected','expired');
  IF _last_request IS NOT NULL AND _last_request > now() - interval '72 hours' THEN
    RAISE EXCEPTION 'Cooldown active. Next request available after %', _last_request + interval '72 hours';
  END IF;

  INSERT INTO public.recovery_requests (user_id, request_type, payload, reason, required_approvals)
  VALUES (_me, _request_type, _payload, _reason, 2)
  RETURNING id INTO _id;

  -- Log
  INSERT INTO public.identity_recovery_log (user_id, recovery_method, status, risk_delta, metadata)
  VALUES (_me, _request_type, 'requested', 0,
    jsonb_build_object('request_id', _id, 'guardians_count', _active_guardians));

  RETURN _id;
END;
$$;

-- vote_recovery_request
CREATE OR REPLACE FUNCTION public.vote_recovery_request(
  _request_id uuid,
  _decision text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _req record;
  _is_guardian boolean;
  _approvals int; _rejections int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Decision must be approve or reject'; END IF;

  SELECT * INTO _req FROM public.recovery_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'Request is %', _req.status; END IF;
  IF _req.expires_at < now() THEN
    UPDATE public.recovery_requests SET status='expired', updated_at=now() WHERE id=_request_id;
    RAISE EXCEPTION 'Request expired';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.trusted_guardians
    WHERE user_id = _req.user_id AND guardian_user_id = _me AND status = 'active'
  ) INTO _is_guardian;
  IF NOT _is_guardian THEN RAISE EXCEPTION 'Not an active guardian for this user'; END IF;

  INSERT INTO public.recovery_approvals (request_id, guardian_user_id, decision, reason)
  VALUES (_request_id, _me, _decision, _reason)
  ON CONFLICT (request_id, guardian_user_id) DO NOTHING;

  IF NOT FOUND THEN RAISE EXCEPTION 'Already voted on this request'; END IF;

  SELECT
    COUNT(*) FILTER (WHERE decision='approve'),
    COUNT(*) FILTER (WHERE decision='reject')
  INTO _approvals, _rejections
  FROM public.recovery_approvals WHERE request_id = _request_id;

  UPDATE public.recovery_requests
  SET approvals_count = _approvals,
      rejections_count = _rejections,
      status = CASE
        WHEN _approvals >= required_approvals THEN 'approved'
        WHEN _rejections >= 2 THEN 'rejected'
        ELSE 'pending'
      END,
      approved_at = CASE WHEN _approvals >= required_approvals THEN now() ELSE approved_at END,
      updated_at = now()
  WHERE id = _request_id;

  RETURN jsonb_build_object(
    'approvals', _approvals,
    'rejections', _rejections,
    'required', _req.required_approvals,
    'status', CASE
      WHEN _approvals >= _req.required_approvals THEN 'approved'
      WHEN _rejections >= 2 THEN 'rejected'
      ELSE 'pending'
    END
  );
END;
$$;

-- execute_recovery
CREATE OR REPLACE FUNCTION public.execute_recovery(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _req record;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _req FROM public.recovery_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF _req.user_id <> _me THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _req.status <> 'approved' THEN RAISE EXCEPTION 'Request status is % (need approved)', _req.status; END IF;

  UPDATE public.recovery_requests
  SET status='executed', executed_at=now(), updated_at=now()
  WHERE id=_request_id;

  INSERT INTO public.identity_recovery_log (user_id, recovery_method, status, risk_delta, metadata)
  VALUES (_me, _req.request_type, 'executed', -0.05,
    jsonb_build_object('request_id', _request_id, 'approvals', _req.approvals_count));

  RETURN jsonb_build_object('success', true, 'executed_at', now());
END;
$$;

-- Helpers
CREATE OR REPLACE FUNCTION public.get_my_guardians()
RETURNS TABLE (
  id uuid, guardian_user_id uuid, status text,
  invited_at timestamptz, accepted_at timestamptz,
  display_name text, avatar_url text, email text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT g.id, g.guardian_user_id, g.status, g.invited_at, g.accepted_at,
         p.display_name, p.avatar_url, u.email
  FROM public.trusted_guardians g
  LEFT JOIN public.profiles p ON p.user_id = g.guardian_user_id
  LEFT JOIN auth.users u ON u.id = g.guardian_user_id
  WHERE g.user_id = auth.uid() AND g.status <> 'revoked'
  ORDER BY g.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_guardian_inbox()
RETURNS TABLE (
  relationship_id uuid, user_id uuid, status text,
  invited_at timestamptz,
  display_name text, avatar_url text, email text,
  pending_requests int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    g.id, g.user_id, g.status, g.invited_at,
    p.display_name, p.avatar_url, u.email,
    (SELECT COUNT(*)::int FROM public.recovery_requests r
      WHERE r.user_id = g.user_id AND r.status = 'pending' AND r.expires_at > now()
        AND NOT EXISTS (SELECT 1 FROM public.recovery_approvals a
                        WHERE a.request_id = r.id AND a.guardian_user_id = auth.uid()))
  FROM public.trusted_guardians g
  LEFT JOIN public.profiles p ON p.user_id = g.user_id
  LEFT JOIN auth.users u ON u.id = g.user_id
  WHERE g.guardian_user_id = auth.uid() AND g.status <> 'revoked'
  ORDER BY g.invited_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_my_recovery_requests()
RETURNS TABLE (
  id uuid, request_type text, status text,
  approvals_count int, rejections_count int, required_approvals int,
  reason text, expires_at timestamptz, created_at timestamptz, executed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id, request_type, status, approvals_count, rejections_count, required_approvals,
         reason, expires_at, created_at, executed_at
  FROM public.recovery_requests
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_recovery_for_guardian()
RETURNS TABLE (
  request_id uuid, user_id uuid, request_type text, reason text,
  approvals_count int, rejections_count int, required_approvals int,
  created_at timestamptz, expires_at timestamptz,
  display_name text, avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.user_id, r.request_type, r.reason,
         r.approvals_count, r.rejections_count, r.required_approvals,
         r.created_at, r.expires_at,
         p.display_name, p.avatar_url
  FROM public.recovery_requests r
  JOIN public.trusted_guardians g
    ON g.user_id = r.user_id AND g.guardian_user_id = auth.uid() AND g.status = 'active'
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.status = 'pending' AND r.expires_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.recovery_approvals a
      WHERE a.request_id = r.id AND a.guardian_user_id = auth.uid()
    )
  ORDER BY r.created_at DESC;
$$;