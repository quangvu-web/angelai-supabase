CREATE TABLE public.pronoun_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  context TEXT,
  user_id UUID,
  target_user_id UUID,
  message_preview TEXT NOT NULL,
  full_message TEXT NOT NULL,
  violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity TEXT NOT NULL DEFAULT 'warning',
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pronoun_audit_created ON public.pronoun_audit_log (created_at DESC);
CREATE INDEX idx_pronoun_audit_function ON public.pronoun_audit_log (function_name, created_at DESC);
CREATE INDEX idx_pronoun_audit_unreviewed ON public.pronoun_audit_log (is_reviewed, created_at DESC) WHERE is_reviewed = false;

GRANT ALL ON public.pronoun_audit_log TO service_role;
GRANT SELECT, UPDATE ON public.pronoun_audit_log TO authenticated;

ALTER TABLE public.pronoun_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pronoun audit"
ON public.pronoun_audit_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pronoun audit"
ON public.pronoun_audit_log FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));