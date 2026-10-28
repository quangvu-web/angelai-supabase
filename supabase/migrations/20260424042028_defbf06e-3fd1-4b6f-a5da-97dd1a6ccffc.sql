-- Audit log for SSO bridge-login
CREATE TABLE public.bridge_login_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT,
  user_agent TEXT,
  fun_user_id TEXT,
  email TEXT,
  angel_user_id UUID,
  success BOOLEAN NOT NULL DEFAULT false,
  failure_reason TEXT,
  token_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for fraud investigation
CREATE INDEX idx_bridge_audit_ip ON public.bridge_login_audit(ip_address, created_at DESC);
CREATE INDEX idx_bridge_audit_email ON public.bridge_login_audit(email, created_at DESC);
CREATE INDEX idx_bridge_audit_fun_user ON public.bridge_login_audit(fun_user_id, created_at DESC);
CREATE INDEX idx_bridge_audit_token_hash ON public.bridge_login_audit(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX idx_bridge_audit_created ON public.bridge_login_audit(created_at DESC);

-- Enable RLS
ALTER TABLE public.bridge_login_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.bridge_login_audit
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies — only service role (bypasses RLS) can write