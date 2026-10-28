
-- ============================================================
-- Bước 1: Thêm cột mới vào pplp_scores
-- ============================================================
ALTER TABLE public.pplp_scores
  ADD COLUMN IF NOT EXISTS reputation_weight NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS consistency_multiplier NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS integrity_penalty NUMERIC DEFAULT 0;

-- ============================================================
-- Bước 2: Thêm cột vào pplp_user_tiers
-- ============================================================
ALTER TABLE public.pplp_user_tiers
  ADD COLUMN IF NOT EXISTS contribution_days_30 INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS contribution_days_90 INTEGER DEFAULT 0;

-- ============================================================
-- Bước 3: Tạo bảng pplp_mint_cycles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pplp_mint_cycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_number INTEGER NOT NULL,
  cycle_type TEXT NOT NULL DEFAULT 'weekly', -- weekly | monthly
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  total_mint_pool BIGINT NOT NULL DEFAULT 0,
  total_light_contribution NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', -- open | closed | distributed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cycle_number, cycle_type)
);

ALTER TABLE public.pplp_mint_cycles ENABLE ROW LEVEL SECURITY;

-- Everyone can read cycles
CREATE POLICY "Anyone can view mint cycles"
  ON public.pplp_mint_cycles FOR SELECT
  USING (true);

-- ============================================================
-- Bước 4: Tạo bảng pplp_mint_allocations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pplp_mint_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES public.pplp_mint_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_light_contribution NUMERIC NOT NULL DEFAULT 0,
  allocation_ratio NUMERIC NOT NULL DEFAULT 0,
  fun_allocated BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | minted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, user_id)
);

ALTER TABLE public.pplp_mint_allocations ENABLE ROW LEVEL SECURITY;

-- Users can see their own allocations
CREATE POLICY "Users can view own allocations"
  ON public.pplp_mint_allocations FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- Bước 5: Hàm RPC calculate_reputation_weight
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_reputation_weight(_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days_active INTEGER;
  v_pass_rate NUMERIC;
  v_completed_sequences INTEGER;
  v_trust_score NUMERIC;
  v_total_actions INTEGER;
  v_passed_actions INTEGER;
  v_weight NUMERIC := 1.0;
BEGIN
  -- 1. Thời gian đóng góp (ngày từ hành động đầu tiên)
  SELECT EXTRACT(DAY FROM (now() - MIN(created_at)))::INTEGER
  INTO v_days_active
  FROM pplp_actions WHERE actor_id = _user_id;
  
  v_days_active := COALESCE(v_days_active, 0);

  -- 2. Tỷ lệ pass/fail
  SELECT COUNT(*), COUNT(CASE WHEN s.decision = 'pass' THEN 1 END)
  INTO v_total_actions, v_passed_actions
  FROM pplp_actions a
  JOIN pplp_scores s ON s.action_id = a.id
  WHERE a.actor_id = _user_id;

  IF v_total_actions > 0 THEN
    v_pass_rate := v_passed_actions::NUMERIC / v_total_actions;
  ELSE
    v_pass_rate := 0.5;
  END IF;

  -- 3. Số chuỗi hoàn thành
  SELECT COUNT(*)
  INTO v_completed_sequences
  FROM pplp_behavior_sequences
  WHERE user_id = _user_id AND status = 'completed';

  v_completed_sequences := COALESCE(v_completed_sequences, 0);

  -- 4. Trust score từ pplp_user_tiers
  SELECT COALESCE(trust_score, 50)
  INTO v_trust_score
  FROM pplp_user_tiers WHERE user_id = _user_id;

  v_trust_score := COALESCE(v_trust_score, 50);

  -- Tính toán weight tổng hợp [0.5 - 1.5]
  v_weight := 0.5
    + (LEAST(v_days_active, 180)::NUMERIC / 180) * 0.25  -- max +0.25 cho 180 ngày
    + v_pass_rate * 0.30                                    -- max +0.30 cho 100% pass
    + (LEAST(v_completed_sequences, 20)::NUMERIC / 20) * 0.20 -- max +0.20 cho 20 chuỗi
    + (v_trust_score / 100) * 0.25;                         -- max +0.25 cho trust 100

  -- Clamp [0.5, 1.5]
  v_weight := GREATEST(0.5, LEAST(1.5, v_weight));

  RETURN ROUND(v_weight, 4);
END;
$$;

-- ============================================================
-- Bước 6: Hàm RPC calculate_consistency_multiplier
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_consistency_multiplier(_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days_30 INTEGER;
  v_days_90 INTEGER;
  v_multiplier NUMERIC := 1.0;
BEGIN
  -- Đếm số ngày có hành động trong 30 ngày gần nhất
  SELECT COUNT(DISTINCT DATE(created_at))
  INTO v_days_30
  FROM pplp_actions
  WHERE actor_id = _user_id
    AND created_at > now() - INTERVAL '30 days'
    AND status IN ('scored', 'minted');

  -- Đếm số ngày có hành động trong 90 ngày gần nhất
  SELECT COUNT(DISTINCT DATE(created_at))
  INTO v_days_90
  FROM pplp_actions
  WHERE actor_id = _user_id
    AND created_at > now() - INTERVAL '90 days'
    AND status IN ('scored', 'minted');

  -- Cập nhật pplp_user_tiers
  UPDATE pplp_user_tiers
  SET contribution_days_30 = v_days_30,
      contribution_days_90 = v_days_90,
      updated_at = now()
  WHERE user_id = _user_id;

  -- Tính multiplier
  IF v_days_90 >= 60 THEN      -- ~67% ngày trong 90 ngày → ổn định cao
    v_multiplier := 1.6;
  ELSIF v_days_30 >= 20 THEN   -- ~67% ngày trong 30 ngày → ổn định
    v_multiplier := 1.3;
  ELSE
    v_multiplier := 1.0;
  END IF;

  RETURN v_multiplier;
END;
$$;

-- Enable realtime for mint cycles
ALTER PUBLICATION supabase_realtime ADD TABLE public.pplp_mint_cycles;
