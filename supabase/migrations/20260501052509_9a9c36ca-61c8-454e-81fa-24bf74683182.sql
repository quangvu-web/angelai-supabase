CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cycle_type text NOT NULL DEFAULT 'monthly',
  notification_type text NOT NULL DEFAULT 'mint_ready',
  title text NOT NULL,
  content_template text NOT NULL,
  cta_label text NOT NULL DEFAULT 'Xem ngay',
  cta_url text NOT NULL DEFAULT '/mint',
  audience text NOT NULL DEFAULT 'cycle_eligible',
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_templates_active ON public.notification_templates(is_active, cycle_type);

CREATE TABLE IF NOT EXISTS public.notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  cycle_id uuid,
  cycle_label text,
  audience text NOT NULL,
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  error text,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_broadcasts_created ON public.notification_broadcasts(created_at DESC);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification templates"
ON public.notification_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view broadcasts"
ON public.notification_broadcasts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins create broadcasts"
ON public.notification_broadcasts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_notif_templates_updated
BEFORE UPDATE ON public.notification_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed mẫu chuẩn dựa trên thông báo Cycle #2 vừa gửi
INSERT INTO public.notification_templates (name, cycle_type, notification_type, title, content_template, cta_label, cta_url, audience, metadata)
VALUES
  ('Mint Ready - Hàng tháng', 'monthly', 'mint_ready',
   '🎉 Chúc mừng! FUN Money của bạn đã sẵn sàng',
   'Tổng phần thưởng {{cycle_label}}: {{fun_amount}} FUN. Vào Ví → FUN Money để claim phần thưởng của bạn.',
   'Claim ngay', '/mint', 'cycle_eligible',
   '{"icon": "🎉", "color": "gold"}'::jsonb),
  ('Mint Ready - Hàng tuần', 'weekly', 'mint_ready',
   '✨ Phần thưởng tuần này đã sẵn sàng',
   'Tuần {{cycle_label}}: bạn nhận được {{fun_amount}} FUN. Vào Ví để claim ngay nhé!',
   'Claim ngay', '/mint', 'cycle_eligible',
   '{"icon": "✨"}'::jsonb),
  ('Nhắc nhở chưa claim', 'monthly', 'mint_reminder',
   '⏰ Bạn chưa claim FUN tháng này',
   'Phần thưởng {{fun_amount}} FUN của {{cycle_label}} đang chờ bạn. Claim trước khi hết hạn nhé!',
   'Claim ngay', '/mint', 'cycle_unclaimed',
   '{"icon": "⏰"}'::jsonb)
ON CONFLICT DO NOTHING;