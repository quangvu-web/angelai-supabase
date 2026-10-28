
-- ============================================
-- 1. Bảng pplp_parameter_config
-- ============================================
CREATE TABLE IF NOT EXISTS public.pplp_parameter_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  phase TEXT DEFAULT 'early',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pplp_parameter_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read parameters"
  ON public.pplp_parameter_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only service role can manage parameters"
  ON public.pplp_parameter_config FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 2. Seed dữ liệu tham số production-ready v1.0
-- ============================================

INSERT INTO public.pplp_parameter_config (key, value, phase, description) VALUES
-- 2a. Giá trị gốc sự kiện (Base Values)
('base_values', '{
  "daily_check_in": 0.2,
  "question_ask": 2,
  "comment_create": 1.5,
  "journal_write": 2.5,
  "post_create": 3,
  "content_create": 4,
  "analysis_post": 5,
  "help_given": 4.5,
  "giving": 5,
  "service": 5.5,
  "meditation": 3,
  "share_content": 1,
  "login": 0.5,
  "profile_completion": 3,
  "did_verification": 7,
  "soulbound_mint": 10,
  "content_saved": 5,
  "learning_completion": 2,
  "referral_raw": 0.5,
  "referral_activated": 10,
  "transaction": 1,
  "contribution": 8,
  "governance": 6,
  "successful_proposal": 15,
  "long_term_value_asset": 50
}'::jsonb, 'early', 'Giá trị gốc B cho mỗi loại sự kiện'),

-- 2b. Dải chất lượng Quality (Q_e)
('quality_bands', '{
  "low": {"min": 0.3, "max": 0.6, "label": "Thấp — nội dung rỗng hoặc copy"},
  "normal": {"min": 0.8, "max": 1.0, "label": "Bình thường — đủ chất lượng"},
  "good": {"min": 1.0, "max": 1.3, "label": "Tốt — có chiều sâu, có dẫn chứng"},
  "excellent": {"min": 1.3, "max": 1.8, "label": "Xuất sắc — sáng tạo, có bằng chứng, tạo giá trị mới"}
}'::jsonb, 'early', 'Dải hệ số chất lượng Q_e (0.3–1.8)'),

-- 2c. Cấp độ tin cậy Trust Confidence (TC_e)
('trust_levels', '{
  "unknown": {"value": 0.65, "label": "Chưa xác minh — mới tạo tài khoản, chưa có gì"},
  "basic": {"value": 0.9, "label": "Cơ bản — email/phone đã xác minh"},
  "verified": {"value": 1.1, "label": "Đã xác minh — DID active"},
  "strong": {"value": 1.3, "label": "Mạnh — SBT + lịch sử sạch > 90 ngày"},
  "core": {"value": 1.45, "label": "Cốt lõi — đóng góp lâu năm, streak 90+, không có flag"}
}'::jsonb, 'early', 'Hệ số tin cậy TC_e theo 5 cấp (0.5–1.5)'),

-- 2d. Dải Intent Integrity Score (IIS)
('iis_bands', '{
  "spam": {"min": 0, "max": 0.3, "label": "Spam — hành vi lặp vô nghĩa, farming rõ"},
  "farming_light": {"min": 0.5, "max": 0.8, "label": "Farming nhẹ — pattern giống bot nhưng chưa rõ"},
  "normal": {"min": 0.9, "max": 1.0, "label": "Bình thường — đa dạng hành vi, nhịp hợp lý"},
  "good": {"min": 1.0, "max": 1.2, "label": "Tốt — có chuỗi giá trị, cross-window"},
  "pure": {"min": 1.2, "max": 1.5, "label": "Thuần khiết — đóng góp đều, không cần nhắc"}
}'::jsonb, 'early', 'Dải Intent Integrity Score (0–1.5)'),

-- 2e. Dải Impact Multiplier (IM)
('im_bands', '{
  "no_use": {"min": 0.5, "max": 0.8, "label": "Không ai dùng — không tạo giá trị cho người khác"},
  "some_use": {"min": 0.8, "max": 1.0, "label": "Có người xem — tương tác cơ bản"},
  "useful": {"min": 1.0, "max": 1.5, "label": "Hữu ích — nhiều người dùng, có lượt lưu"},
  "high_impact": {"min": 1.5, "max": 2.5, "label": "Tác động cao — tạo thay đổi thật, nhiều người áp dụng"},
  "system_impact": {"min": 2.5, "max": 3.0, "label": "Tạo hệ quả lớn — governance, policy, hạ tầng"}
}'::jsonb, 'early', 'Dải Impact Multiplier (0.5–3.0)'),

-- 2f. Dải Anti-Abuse Factor (AAF)
('aaf_bands', '{
  "normal": {"value": 1.0, "label": "Bình thường — không có tín hiệu gian lận"},
  "suspect": {"min": 0.5, "max": 0.8, "label": "Nghi ngờ — 1-2 tín hiệu nhẹ"},
  "flagged": {"min": 0.2, "max": 0.5, "label": "Cờ nhẹ — 3-5 tín hiệu, chờ xem xét"},
  "near_spam": {"min": 0.05, "max": 0.2, "label": "Gần spam — nhiều tín hiệu, giảm nặng"},
  "blocked": {"value": 0, "label": "Chặn — tài khoản bị đình chỉ"}
}'::jsonb, 'early', 'Dải Anti-Abuse Factor (0–1.0)'),

-- 2g. Dải Ego Risk Penalty (ERP — đổi ngữ nghĩa từ Event Reputation Premium)
('erp_bands', '{
  "neutral": {"value": 1.0, "label": "Trung tính — không có tín hiệu ego rủi ro"},
  "optimized": {"value": 0.9, "label": "Tối ưu reward — nhẹ ego nhưng chấp nhận được"},
  "clickbait": {"min": 0.7, "max": 0.85, "label": "Clickbait/shallow — nội dung nông, câu tương tác"},
  "toxic": {"min": 0.5, "max": 0.7, "label": "Toxic/lệch hệ — gây hại cộng đồng, vi phạm giá trị cốt lõi"}
}'::jsonb, 'early', 'Hệ số phạt rủi ro bản ngã ERP (0.5–1.0) — KHÔNG PHẢI bonus'),

-- 2h. Bảng Consistency C_t
('consistency_table', '{
  "1_3": {"value": 0.95, "label": "1–3 ngày — mới bắt đầu hoặc đứt quãng"},
  "4_7": {"value": 1.0, "label": "4–7 ngày — bình thường"},
  "8_30": {"value": 1.05, "label": "8–30 ngày — ổn định"},
  "31_90": {"value": 1.1, "label": "31–90 ngày — bền bỉ"},
  "90_plus": {"min": 1.15, "max": 1.25, "label": "90+ ngày — kiên định, tối đa"}
}'::jsonb, 'early', 'Hệ số nhất quán C_t theo chuỗi ngày (0.95–1.25)'),

-- 2i. Bảng Reliability R_t
('reliability_table', '{
  "unreliable": {"min": 0.6, "max": 0.8, "label": "Không đáng tin — nhiều flag, reversal cao"},
  "normal": {"min": 0.9, "max": 1.0, "label": "Bình thường — pass rate > 70%, ít flag"},
  "reliable": {"min": 1.0, "max": 1.1, "label": "Đáng tin — pass rate > 90%, không reversal"},
  "highly_reliable": {"min": 1.1, "max": 1.2, "label": "Rất đáng tin — pass rate > 95%, lịch sử sạch hoàn toàn"}
}'::jsonb, 'early', 'Hệ số độ tin cậy R_t (0.6–1.2)'),

-- 2j. Hệ số mạng lưới (Network Light)
('network_multipliers', '{
  "quality_network": {"description": "QN — chất lượng người được giới thiệu/hướng dẫn", "range": [0.5, 1.5]},
  "trust_network": {"description": "TN — mức tin cậy của mạng lưới", "range": [0.5, 1.3]},
  "diversity_network": {"description": "DN — đa dạng mạng lưới (không tập trung 1 nhóm)", "range": [0.8, 1.2]}
}'::jsonb, 'early', 'Hệ số mạng lưới QN, TN, DN cho Network Light Score'),

-- 2k. Tham số di sản (Legacy Light)
('legacy_params', '{
  "passive_value": {"description": "PV — giá trị thụ động (content được reuse/bookmark)", "weight": 0.3},
  "age_decay": {"description": "AD — suy giảm theo thời gian (nội dung cũ giảm dần)", "half_life_days": 180},
  "long_term_outcome": {"description": "LO — kết quả dài hạn (proposal adopted, mentor thành công)", "weight": 0.4},
  "public_utility": {"description": "PU — tiện ích công cộng (bao nhiêu người hưởng lợi)", "weight": 0.3}
}'::jsonb, 'early', 'Tham số Legacy Light Score: PV, AD, LO, PU'),

-- 2l. Trọng số TLS theo giai đoạn
('tls_weights', '{
  "early": {"alpha": 0.7, "beta": 0.2, "gamma": 0.1, "label": "Giai đoạn sớm — ưu tiên cá nhân"},
  "growth": {"alpha": 0.5, "beta": 0.3, "gamma": 0.2, "label": "Giai đoạn tăng trưởng — cân bằng"},
  "mature": {"alpha": 0.4, "beta": 0.3, "gamma": 0.3, "label": "Giai đoạn trưởng thành — ưu tiên di sản"}
}'::jsonb, 'early', 'Trọng số α/β/γ cho PLS/NLS/LLS theo giai đoạn'),

-- 2m. Ngưỡng kích hoạt tính năng
('activation_thresholds', '{
  "earn_basic": {"display_light": 10, "trust_level": "basic", "label": "Kiếm cơ bản — bắt đầu nhận thưởng"},
  "community_interact": {"display_light": 30, "trust_level": "basic", "label": "Tương tác cộng đồng — bình luận, đánh giá"},
  "governance_vote": {"display_light": 200, "trust_level": "verified", "label": "Bỏ phiếu quản trị"},
  "create_proposal": {"display_light": 350, "trust_level": "strong", "label": "Tạo đề xuất quản trị"},
  "mentor_role": {"display_light": 150, "trust_level": "verified", "streak_days": 30, "label": "Vai trò cố vấn"},
  "validator_role": {"display_light": 300, "trust_level": "strong", "streak_days": 60, "label": "Vai trò xác thực viên"}
}'::jsonb, 'early', 'Ngưỡng kích hoạt tính năng theo Display Light + Trust Level');

-- ============================================
-- 3. Cập nhật compute_intent_integrity — ánh xạ 5 dải
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_intent_integrity(_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_days INT;
  total_days INT;
  pass_count INT;
  fail_count INT;
  flagged_count INT;
  consistency_ratio NUMERIC;
  pass_ratio NUMERIC;
  raw_score NUMERIC;
  same_type_pct NUMERIC;
  burst_count INT;
  band_score NUMERIC;
BEGIN
  -- Tính số ngày hoạt động trong 30 ngày gần nhất
  SELECT COUNT(DISTINCT date) INTO active_days
  FROM features_user_day
  WHERE user_id = _user_id AND date >= CURRENT_DATE - 30;

  total_days := 30;
  consistency_ratio := COALESCE(active_days::NUMERIC / GREATEST(total_days, 1), 0);

  -- Tỷ lệ pass / tổng decisions
  SELECT
    COALESCE(SUM(CASE WHEN decision = 'pass' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN decision = 'fail' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN decision = 'flagged' OR decision = 'pending_review' THEN 1 ELSE 0 END), 0)
  INTO pass_count, fail_count, flagged_count
  FROM pplp_scores
  WHERE actor_id = _user_id AND created_at >= CURRENT_DATE - 30;

  pass_ratio := CASE WHEN (pass_count + fail_count + flagged_count) > 0
    THEN pass_count::NUMERIC / (pass_count + fail_count + flagged_count)
    ELSE 0.5 END;

  -- Phát hiện lặp vô nghĩa (>70% cùng loại trong ngày)
  SELECT COALESCE(MAX(type_pct), 0) INTO same_type_pct
  FROM (
    SELECT (COUNT(*)::NUMERIC / GREATEST(SUM(COUNT(*)) OVER(), 1)) AS type_pct
    FROM pplp_actions
    WHERE actor_id = _user_id AND created_at >= CURRENT_DATE AND status != 'rejected'
    GROUP BY action_type
  ) sub;

  -- Phát hiện burst (>5 hành động trong 1 giờ)
  SELECT COUNT(*) INTO burst_count
  FROM pplp_actions
  WHERE actor_id = _user_id
    AND created_at >= NOW() - INTERVAL '1 hour'
    AND status != 'rejected';

  -- Tính điểm thô
  raw_score := (consistency_ratio * 0.3 + pass_ratio * 0.4 + (1 - same_type_pct) * 0.2 + LEAST(1, active_days::NUMERIC / 14) * 0.1);

  -- Phạt burst
  IF burst_count > 5 THEN
    raw_score := raw_score * 0.6;
  ELSIF burst_count > 3 THEN
    raw_score := raw_score * 0.8;
  END IF;

  -- Ánh xạ qua 5 dải rời rạc theo spec
  IF raw_score < 0.2 THEN
    band_score := 0.15; -- Spam (0–0.3)
  ELSIF raw_score < 0.4 THEN
    band_score := 0.65; -- Farming nhẹ (0.5–0.8)
  ELSIF raw_score < 0.6 THEN
    band_score := 0.95; -- Bình thường (0.9–1.0)
  ELSIF raw_score < 0.8 THEN
    band_score := 1.1;  -- Tốt (1.0–1.2)
  ELSE
    band_score := 1.35; -- Thuần khiết (1.2–1.5)
  END IF;

  RETURN LEAST(1.5, GREATEST(0, band_score));
END;
$$;

-- ============================================
-- 4. Tạo compute_reliability — RPC mới cho R_t
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_reliability(_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_scored INT;
  pass_count INT;
  flag_count INT;
  reversal_count INT;
  pass_rate NUMERIC;
  r_score NUMERIC;
BEGIN
  -- Tổng số actions đã scored (90 ngày)
  SELECT COUNT(*) INTO total_scored
  FROM pplp_scores
  WHERE actor_id = _user_id AND created_at >= CURRENT_DATE - 90;

  IF total_scored < 5 THEN
    RETURN 0.95; -- Mặc định cho người mới
  END IF;

  SELECT COALESCE(SUM(CASE WHEN decision = 'pass' THEN 1 ELSE 0 END), 0) INTO pass_count
  FROM pplp_scores WHERE actor_id = _user_id AND created_at >= CURRENT_DATE - 90;

  SELECT COALESCE(COUNT(*), 0) INTO flag_count
  FROM pplp_fraud_signals WHERE actor_id = _user_id AND is_resolved = false;

  -- Reversal: actions bị chuyển từ pass sang fail/rejected
  SELECT COALESCE(COUNT(*), 0) INTO reversal_count
  FROM pplp_actions
  WHERE actor_id = _user_id
    AND status IN ('rejected', 'flagged')
    AND scored_at IS NOT NULL
    AND created_at >= CURRENT_DATE - 90;

  pass_rate := pass_count::NUMERIC / GREATEST(total_scored, 1);

  -- Ánh xạ 4 dải theo spec
  IF pass_rate > 0.95 AND flag_count = 0 AND reversal_count = 0 THEN
    r_score := 1.15; -- Rất đáng tin (1.1–1.2)
  ELSIF pass_rate > 0.90 AND reversal_count = 0 THEN
    r_score := 1.05; -- Đáng tin (1.0–1.1)
  ELSIF pass_rate > 0.70 THEN
    r_score := 0.95; -- Bình thường (0.9–1.0)
  ELSE
    r_score := 0.7;  -- Không đáng tin (0.6–0.8)
  END IF;

  -- Phạt thêm nếu có nhiều flag
  IF flag_count > 3 THEN
    r_score := r_score * 0.85;
  ELSIF flag_count > 0 THEN
    r_score := r_score * 0.95;
  END IF;

  RETURN LEAST(1.2, GREATEST(0.6, r_score));
END;
$$;

-- ============================================
-- 5. Cập nhật compute_network_light — tách QN, TN, DN
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_network_light(_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_vvu NUMERIC := 0;
  quality_network NUMERIC := 1.0;   -- QN
  trust_network NUMERIC := 1.0;     -- TN
  diversity_network NUMERIC := 1.0; -- DN
  active_referrals INT := 0;
  total_referrals INT := 0;
  referral_avg_vvu NUMERIC := 0;
  distinct_action_types INT := 0;
BEGIN
  -- Tìm người được giới thiệu qua fun_id_links (thay vì profiles.referred_by)
  SELECT COALESCE(SUM(s.vvu_score), 0), COUNT(DISTINCT a.actor_id), COUNT(*)
  INTO referral_vvu, active_referrals, total_referrals
  FROM pplp_actions a
  JOIN pplp_scores s ON s.action_id = a.id AND s.decision = 'pass'
  WHERE a.actor_id IN (
    SELECT angel_user_id FROM fun_id_links
    WHERE fun_profile_user_id = _user_id AND status = 'active'
  )
  AND a.created_at >= CURRENT_DATE - 90;

  -- QN — Chất lượng người được giới thiệu
  IF active_referrals > 0 THEN
    referral_avg_vvu := referral_vvu / GREATEST(active_referrals, 1);
    quality_network := LEAST(1.5, GREATEST(0.5, 0.5 + referral_avg_vvu / 20));
  END IF;

  -- TN — Tin cậy mạng lưới (dựa trên tỷ lệ active/total)
  IF total_referrals > 0 THEN
    trust_network := LEAST(1.3, GREATEST(0.5, active_referrals::NUMERIC / GREATEST(total_referrals, 1) + 0.5));
  END IF;

  -- DN — Đa dạng mạng lưới (nhiều loại hành động khác nhau)
  SELECT COUNT(DISTINCT a.action_type) INTO distinct_action_types
  FROM pplp_actions a
  WHERE a.actor_id IN (
    SELECT angel_user_id FROM fun_id_links
    WHERE fun_profile_user_id = _user_id AND status = 'active'
  )
  AND a.created_at >= CURRENT_DATE - 90
  AND a.status = 'scored';

  IF distinct_action_types > 0 THEN
    diversity_network := LEAST(1.2, GREATEST(0.8, 0.8 + distinct_action_types::NUMERIC / 25));
  END IF;

  RETURN GREATEST(0, referral_vvu * quality_network * trust_network * diversity_network / 100);
END;
$$;

-- ============================================
-- 6. Cập nhật compute_legacy_light — tách PV, AD, LO, PU
-- ============================================
CREATE OR REPLACE FUNCTION public.compute_legacy_light(_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  passive_value NUMERIC := 0;   -- PV
  age_decay NUMERIC := 1.0;     -- AD
  long_term_outcome NUMERIC := 0; -- LO
  public_utility NUMERIC := 0;  -- PU
  content_reuse_count INT := 0;
  avg_content_age_days INT := 0;
  proposal_adopted INT := 0;
  total_beneficiaries INT := 0;
BEGIN
  -- PV — Giá trị thụ động: nội dung được lưu/chia sẻ lại
  SELECT COALESCE(COUNT(*), 0) INTO content_reuse_count
  FROM community_shares cs
  JOIN community_posts cp ON cp.id = cs.post_id
  WHERE cp.user_id = _user_id AND cs.created_at >= CURRENT_DATE - 180;

  SELECT COALESCE(SUM(COALESCE(cp.likes_count, 0) + COALESCE(cp.shares_count, 0)), 0) INTO passive_value
  FROM community_posts cp
  WHERE cp.user_id = _user_id AND cp.created_at >= CURRENT_DATE - 365;

  passive_value := LEAST(100, passive_value / 10 + content_reuse_count * 2);

  -- AD — Suy giảm theo thời gian (half-life 180 ngày)
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM NOW() - cp.created_at) / 86400), 0) INTO avg_content_age_days
  FROM community_posts cp WHERE cp.user_id = _user_id AND cp.created_at >= CURRENT_DATE - 365;

  age_decay := POWER(0.5, avg_content_age_days::NUMERIC / 180);

  -- LO — Kết quả dài hạn: đề xuất được chấp nhận, mentor thành công
  SELECT COALESCE(COUNT(*), 0) INTO proposal_adopted
  FROM build_ideas
  WHERE user_id = _user_id AND status = 'approved';

  long_term_outcome := LEAST(50, proposal_adopted * 10);

  -- PU — Tiện ích công cộng: số người hưởng lợi
  SELECT COALESCE(SUM(COALESCE(cp.likes_count, 0) + COALESCE(cp.comments_count, 0)), 0) INTO total_beneficiaries
  FROM community_posts cp
  WHERE cp.user_id = _user_id AND cp.created_at >= CURRENT_DATE - 365;

  public_utility := LEAST(50, total_beneficiaries / 20);

  -- Kết hợp: PV * AD * 0.3 + LO * 0.4 + PU * 0.3
  RETURN GREATEST(0, (passive_value * age_decay * 0.3 + long_term_outcome * 0.4 + public_utility * 0.3));
END;
$$;

-- ============================================
-- 7. Cập nhật recompute_user_light_score — đọc phase
-- ============================================
CREATE OR REPLACE FUNCTION public.recompute_user_light_score(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pls NUMERIC;
  nls NUMERIC;
  lls NUMERIC;
  tls_raw NUMERIC;
  display_ls NUMERIC;
  tier TEXT;
  w_alpha NUMERIC := 0.6;
  w_beta NUMERIC := 0.25;
  w_gamma NUMERIC := 0.15;
  current_phase TEXT := 'early';
  phase_weights JSONB;
BEGIN
  -- Đọc giai đoạn hiện tại từ epoch_config
  SELECT config_value->>'phase' INTO current_phase
  FROM epoch_config
  WHERE config_key = 'current_phase'
  LIMIT 1;

  current_phase := COALESCE(current_phase, 'early');

  -- Đọc trọng số từ pplp_parameter_config theo giai đoạn
  SELECT value->current_phase INTO phase_weights
  FROM pplp_parameter_config
  WHERE key = 'tls_weights';

  IF phase_weights IS NOT NULL THEN
    w_alpha := COALESCE((phase_weights->>'alpha')::NUMERIC, 0.6);
    w_beta := COALESCE((phase_weights->>'beta')::NUMERIC, 0.25);
    w_gamma := COALESCE((phase_weights->>'gamma')::NUMERIC, 0.15);
  END IF;

  -- PLS — Personal Light (tích lũy VVU + reliability + consistency)
  SELECT COALESCE(SUM(vvu_score), 0) INTO pls
  FROM pplp_scores
  WHERE actor_id = _user_id AND decision = 'pass' AND scoring_engine_version = 'v2.5';

  -- NLS — Network Light
  SELECT COALESCE(compute_network_light(_user_id), 0) INTO nls;

  -- LLS — Legacy Light
  SELECT COALESCE(compute_legacy_light(_user_id), 0) INTO lls;

  -- TLS = α × PLS + β × NLS + γ × LLS
  tls_raw := w_alpha * pls + w_beta * nls + w_gamma * lls;

  -- DisplayLS = 100 × ln(1 + TLS)
  display_ls := ROUND(100 * LN(1 + tls_raw), 2);

  -- Xác định tier
  IF display_ls >= 800 THEN tier := 'cosmic_light';
  ELSIF display_ls >= 500 THEN tier := 'legacy_light';
  ELSIF display_ls >= 300 THEN tier := 'radiant_light';
  ELSIF display_ls >= 150 THEN tier := 'guiding_light';
  ELSIF display_ls >= 50 THEN tier := 'pure_light';
  ELSE tier := 'seed_light';
  END IF;

  -- Upsert
  INSERT INTO user_light_scores (user_id, personal_light, network_light, legacy_light, total_light_raw, display_light, light_tier, alpha, beta, gamma, updated_at)
  VALUES (_user_id, pls, nls, lls, tls_raw, display_ls, tier, w_alpha, w_beta, w_gamma, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    personal_light = EXCLUDED.personal_light,
    network_light = EXCLUDED.network_light,
    legacy_light = EXCLUDED.legacy_light,
    total_light_raw = EXCLUDED.total_light_raw,
    display_light = EXCLUDED.display_light,
    light_tier = EXCLUDED.light_tier,
    alpha = EXCLUDED.alpha,
    beta = EXCLUDED.beta,
    gamma = EXCLUDED.gamma,
    updated_at = NOW();
END;
$$;
