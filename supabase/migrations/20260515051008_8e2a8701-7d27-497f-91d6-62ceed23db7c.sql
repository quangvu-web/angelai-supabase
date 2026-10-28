
-- Bảng ngọn đèn riêng của vòng
CREATE TABLE public.light_circle_lamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.light_circles(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_light bigint NOT NULL CHECK (target_light > 0),
  current_light bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','closed')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lcl_circle_status ON public.light_circle_lamps(circle_id, status);
-- Chỉ tối đa 1 đèn 'active' / vòng
CREATE UNIQUE INDEX uq_lcl_one_active ON public.light_circle_lamps(circle_id) WHERE status='active';

-- Lịch sử đóng góp
CREATE TABLE public.light_circle_lamp_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lamp_id uuid NOT NULL REFERENCES public.light_circle_lamps(id) ON DELETE CASCADE,
  circle_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lclc_lamp_time ON public.light_circle_lamp_contributions(lamp_id, created_at DESC);

ALTER TABLE public.light_circle_lamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.light_circle_lamp_contributions ENABLE ROW LEVEL SECURITY;

-- RLS: thành viên trong vòng đọc được
CREATE POLICY "members read lamps" ON public.light_circle_lamps FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.light_circle_members m WHERE m.circle_id=light_circle_lamps.circle_id AND m.user_id=auth.uid()));
CREATE POLICY "members read lamp contribs" ON public.light_circle_lamp_contributions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.light_circle_members m WHERE m.circle_id=light_circle_lamp_contributions.circle_id AND m.user_id=auth.uid()));

-- Cập nhật trigger absorb: cộng vào đèn active + ghi log
CREATE OR REPLACE FUNCTION public.tg_light_circle_absorb_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_circle uuid; v_light bigint; v_lamp uuid; v_target bigint; v_current bigint;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  SELECT circle_id INTO v_circle FROM light_circle_members WHERE user_id=NEW.user_id;
  IF v_circle IS NULL THEN RETURN NEW; END IF;
  v_light := NEW.amount::bigint * 5;
  UPDATE light_circle_members SET contributed_light = contributed_light + v_light
    WHERE circle_id=v_circle AND user_id=NEW.user_id;
  UPDATE light_circles SET light_pool = light_pool + v_light WHERE id=v_circle;

  -- Cộng vào đèn đang active (nếu có)
  SELECT id, target_light, current_light INTO v_lamp, v_target, v_current
    FROM light_circle_lamps WHERE circle_id=v_circle AND status='active' LIMIT 1;
  IF v_lamp IS NOT NULL THEN
    INSERT INTO light_circle_lamp_contributions(lamp_id, circle_id, user_id, amount)
      VALUES (v_lamp, v_circle, NEW.user_id, v_light);
    UPDATE light_circle_lamps SET current_light = current_light + v_light WHERE id=v_lamp;
    -- Tự động đánh dấu hoàn thành khi đạt mục tiêu
    IF v_current + v_light >= v_target THEN
      UPDATE light_circle_lamps SET status='completed', completed_at=now()
        WHERE id=v_lamp AND status='active';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- RPC: tạo đèn (founder/steward)
CREATE OR REPLACE FUNCTION public.create_circle_lamp(
  p_name text, p_target bigint, p_ends_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_circle uuid; v_role text; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT circle_id, role INTO v_circle, v_role FROM light_circle_members WHERE user_id=v_uid;
  IF v_circle IS NULL THEN RAISE EXCEPTION 'not_in_circle'; END IF;
  IF v_role NOT IN ('founder','steward') THEN RAISE EXCEPTION 'not_officer'; END IF;
  IF p_target IS NULL OR p_target <= 0 OR p_target > 100000000 THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF length(coalesce(p_name,'')) < 2 OR length(p_name) > 60 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF EXISTS (SELECT 1 FROM light_circle_lamps WHERE circle_id=v_circle AND status='active') THEN
    RAISE EXCEPTION 'lamp_active_exists';
  END IF;
  INSERT INTO light_circle_lamps(circle_id, name, target_light, ends_at, created_by)
    VALUES (v_circle, p_name, p_target, p_ends_at, v_uid)
    RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- RPC: lấy đèn active + 30 đóng góp gần nhất
CREATE OR REPLACE FUNCTION public.get_active_circle_lamp()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_circle uuid; v_lamp jsonb; v_contribs jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT circle_id INTO v_circle FROM light_circle_members WHERE user_id=v_uid;
  IF v_circle IS NULL THEN RETURN jsonb_build_object('has_lamp', false); END IF;

  SELECT to_jsonb(l) INTO v_lamp FROM light_circle_lamps l
    WHERE l.circle_id=v_circle AND l.status='active' LIMIT 1;
  IF v_lamp IS NULL THEN RETURN jsonb_build_object('has_lamp', false); END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_contribs
    FROM (
      SELECT c.id, c.user_id, c.amount, c.created_at,
             coalesce(p.display_name, 'Ẩn danh') AS display_name,
             p.avatar_url
      FROM light_circle_lamp_contributions c
      LEFT JOIN profiles p ON p.user_id = c.user_id
      WHERE c.lamp_id = (v_lamp->>'id')::uuid
      ORDER BY c.created_at DESC LIMIT 30
    ) x;

  RETURN jsonb_build_object('has_lamp', true, 'lamp', v_lamp, 'contributions', v_contribs);
END $$;

-- RPC: đóng đèn thủ công (founder/steward)
CREATE OR REPLACE FUNCTION public.close_circle_lamp(p_lamp_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_circle uuid; v_role text; v_lamp_circle uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT circle_id, role INTO v_circle, v_role FROM light_circle_members WHERE user_id=v_uid;
  IF v_circle IS NULL OR v_role NOT IN ('founder','steward') THEN RAISE EXCEPTION 'not_officer'; END IF;
  SELECT circle_id INTO v_lamp_circle FROM light_circle_lamps WHERE id=p_lamp_id;
  IF v_lamp_circle IS NULL OR v_lamp_circle <> v_circle THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE light_circle_lamps SET status='closed', completed_at=now()
    WHERE id=p_lamp_id AND status='active';
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.light_circle_lamps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.light_circle_lamp_contributions;
ALTER TABLE public.light_circle_lamps REPLICA IDENTITY FULL;
ALTER TABLE public.light_circle_lamp_contributions REPLICA IDENTITY FULL;
