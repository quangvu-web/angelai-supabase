
-- Create fraud whitelist table
CREATE TABLE IF NOT EXISTS public.fraud_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'Admin whitelisted',
  whitelisted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fraud whitelist"
ON public.fraud_whitelist
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert the 3 whitelisted users
INSERT INTO public.fraud_whitelist (user_id, reason) VALUES
  ('2a5c721a-c0f8-475e-88fb-a92c816eb7ce', 'ANGEL ÁNH NGUYỆT - Whitelisted by admin'),
  ('9aa48f46-a2f6-45e8-889d-83e2d3cbe3ad', 'ANGEL AI TREASURY - Whitelisted by admin'),
  ('671abecc-8018-4d65-9bce-72ebbf42bb76', 'Hoàng Tỷ Đô - Whitelisted by admin')
ON CONFLICT (user_id) DO NOTHING;

-- Update auto_fraud_check to skip whitelisted users
CREATE OR REPLACE FUNCTION public.auto_fraud_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email TEXT;
  v_pattern RECORD;
  v_alert_count INTEGER;
  v_recent_registrations INTEGER;
  v_is_whitelisted BOOLEAN;
BEGIN
  -- Check if user is whitelisted
  SELECT EXISTS (
    SELECT 1 FROM public.fraud_whitelist WHERE user_id = NEW.user_id
  ) INTO v_is_whitelisted;
  
  IF v_is_whitelisted THEN
    RETURN NEW;
  END IF;

  -- Lấy email của user mới đăng ký
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Kiểm tra email với các pattern trong sybil_pattern_registry
  FOR v_pattern IN
    SELECT * FROM public.sybil_pattern_registry WHERE is_active = true
  LOOP
    IF v_email ILIKE '%' || v_pattern.pattern_value || '%' THEN
      INSERT INTO public.fraud_alerts (
        user_id, alert_type, matched_pattern, severity, details
      ) VALUES (
        NEW.user_id,
        'email_pattern',
        v_pattern.pattern_value,
        v_pattern.severity,
        jsonb_build_object(
          'email', v_email,
          'pattern_type', v_pattern.pattern_type,
          'pattern_id', v_pattern.id
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  
  -- Kiểm tra bulk registration: >3 tài khoản trong 2 giờ
  SELECT COUNT(*) INTO v_recent_registrations
  FROM public.user_light_agreements
  WHERE agreed_at > now() - INTERVAL '2 hours'
    AND user_id != NEW.user_id;
  
  IF v_recent_registrations >= 3 THEN
    SELECT COUNT(*) INTO v_alert_count
    FROM auth.users au
    JOIN public.user_light_agreements ula ON ula.user_id = au.id
    WHERE ula.agreed_at > now() - INTERVAL '2 hours'
      AND au.id != NEW.user_id
      AND SUBSTRING(au.email, 1, 5) = SUBSTRING(v_email, 1, 5);
    
    IF v_alert_count >= 2 THEN
      INSERT INTO public.fraud_alerts (
        user_id, alert_type, severity, details
      ) VALUES (
        NEW.user_id,
        'bulk_registration',
        'high',
        jsonb_build_object(
          'email', v_email,
          'similar_accounts_2h', v_alert_count,
          'email_prefix', SUBSTRING(v_email, 1, 5)
        )
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
