
-- =============================================
-- Bước 1: Light Score Activity Framework
-- 3 bảng mới + dữ liệu khởi tạo
-- =============================================

-- 1. Bảng pplp_activity_categories: Ánh xạ loại hành động → 6 nhóm
CREATE TABLE public.pplp_activity_categories (
  action_type TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('self_light', 'community_interaction', 'content_value', 'web3_economic', 'ecosystem_contribution', 'behavior_sequence')),
  subcategory TEXT,
  base_weight NUMERIC NOT NULL DEFAULT 1.0,
  description_vi TEXT,
  description_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pplp_activity_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mọi người đều đọc được danh mục hoạt động"
  ON public.pplp_activity_categories FOR SELECT
  USING (true);

-- 2. Bảng pplp_light_levels: 5 tầng Light Score
CREATE TABLE public.pplp_light_levels (
  level INTEGER PRIMARY KEY,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  min_score NUMERIC NOT NULL DEFAULT 0,
  max_score NUMERIC,
  icon TEXT,
  color TEXT,
  perks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pplp_light_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mọi người đều đọc được cấp độ Light"
  ON public.pplp_light_levels FOR SELECT
  USING (true);

-- 3. Bảng pplp_behavior_sequences: Theo dõi chuỗi hành vi
CREATE TABLE public.pplp_behavior_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sequence_type TEXT NOT NULL CHECK (sequence_type IN ('light_growth', 'mentorship', 'value_creation', 'conflict_harmony', 'economic_integrity')),
  actions UUID[] DEFAULT '{}',
  stage INTEGER NOT NULL DEFAULT 1,
  max_stage INTEGER NOT NULL DEFAULT 3,
  sequence_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pplp_behavior_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Người dùng xem chuỗi hành vi của mình"
  ON public.pplp_behavior_sequences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role quản lý chuỗi hành vi"
  ON public.pplp_behavior_sequences FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_behavior_sequences_user_status ON public.pplp_behavior_sequences (user_id, status);
CREATE INDEX idx_behavior_sequences_type ON public.pplp_behavior_sequences (sequence_type, status);

-- =============================================
-- Dữ liệu khởi tạo: 5 tầng Light Level
-- =============================================
INSERT INTO public.pplp_light_levels (level, name_vi, name_en, min_score, max_score, icon, color) VALUES
  (1, 'Hiện diện tích cực', 'Light Presence', 0, 199, '🌱', '#8BC34A'),
  (2, 'Người tạo giá trị', 'Light Contributor', 200, 499, '🌟', '#FFC107'),
  (3, 'Người xây dựng', 'Light Builder', 500, 999, '🔨', '#FF9800'),
  (4, 'Người bảo vệ', 'Light Guardian', 1000, 1999, '🛡️', '#2196F3'),
  (5, 'Người thiết kế', 'Light Architect', 2000, NULL, '👑', '#9C27B0');

-- =============================================
-- Dữ liệu khởi tạo: Phân loại 30+ loại hành động
-- =============================================

-- Nhóm 1: Hoạt động cá nhân (self_light)
INSERT INTO public.pplp_activity_categories (action_type, category, subcategory, base_weight, description_vi, description_en) VALUES
  ('DAILY_LOGIN', 'self_light', 'daily_presence', 0.5, 'Đăng nhập mỗi ngày', 'Daily login'),
  ('LIGHT_CHECKIN', 'self_light', 'daily_presence', 0.8, 'Hoàn thành Light Check-in', 'Complete Light Check-in'),
  ('DAILY_RITUAL', 'self_light', 'daily_presence', 0.8, 'Xác nhận hành động tích cực', 'Confirm positive action'),
  ('PROFILE_COMPLETE', 'self_light', 'light_identity', 1.5, 'Hoàn thiện hồ sơ 100%', 'Complete profile 100%'),
  ('KYC_VERIFY', 'self_light', 'light_identity', 2.0, 'Xác minh KYC minh bạch', 'Transparent KYC verification'),
  ('WALLET_CONNECT', 'self_light', 'light_identity', 1.0, 'Kết nối ví FUN Wallet', 'Connect FUN Wallet'),
  ('PPLP_AGREE', 'self_light', 'pplp_practice', 1.5, 'Đồng ý 5 trụ cột PPLP', 'Agree to 5 PPLP pillars'),
  ('COMMUNITY_PLEDGE', 'self_light', 'pplp_practice', 1.2, 'Cam kết 5 lời hứa cộng đồng', 'Commit 5 community pledges'),
  ('MANTRA_CONFIRM', 'self_light', 'pplp_practice', 1.0, 'Đọc và xác nhận 8 câu thần chú', 'Read and confirm 8 mantras'),

  -- Nhóm 2: Tương tác cộng đồng (community_interaction)
  ('POST_LIKE', 'community_interaction', 'light_interaction', 0.3, 'Like tích cực', 'Positive like'),
  ('COMMENT_CREATE', 'community_interaction', 'light_interaction', 0.8, 'Bình luận mang tính xây dựng', 'Constructive comment'),
  ('SHARE_CONTENT', 'community_interaction', 'light_interaction', 0.6, 'Chia sẻ nội dung có giá trị', 'Share valuable content'),
  ('GRATITUDE_PUBLIC', 'community_interaction', 'light_interaction', 1.0, 'Gửi lời biết ơn công khai', 'Public gratitude'),
  ('MENTOR_HELP', 'community_interaction', 'mentorship', 2.0, 'Hướng dẫn thành viên mới', 'Mentor new member'),
  ('QUESTION_ANSWER', 'community_interaction', 'mentorship', 1.5, 'Trả lời câu hỏi chuyên môn', 'Answer expert question'),
  ('CONFLICT_RESOLVE', 'community_interaction', 'conflict_transformation', 2.5, 'Giải quyết tranh luận bằng ngôn ngữ tích cực', 'Resolve conflict positively'),
  ('REPORT_VALID', 'community_interaction', 'conflict_transformation', 1.0, 'Báo cáo vi phạm đúng cách', 'Valid violation report'),

  -- Nhóm 3: Tạo giá trị nội dung (content_value)
  ('POST_CREATE', 'content_value', 'content_creation', 1.0, 'Viết bài gốc', 'Create original post'),
  ('VIDEO_SHARE', 'content_value', 'content_creation', 1.5, 'Chia sẻ video', 'Share video'),
  ('ANALYSIS_POST', 'content_value', 'content_creation', 2.0, 'Phân tích chuyên môn', 'Expert analysis'),
  ('CASE_STUDY', 'content_value', 'content_creation', 2.5, 'Case study minh bạch', 'Transparent case study'),
  ('CONTENT_BOOKMARK', 'content_value', 'quality_signal', 0.5, 'Nội dung được lưu lại', 'Content bookmarked'),
  ('CONTENT_CITED', 'content_value', 'quality_signal', 1.5, 'Nội dung được trích dẫn', 'Content cited'),
  ('LEARN_EARN_CREATE', 'content_value', 'knowledge', 3.0, 'Tạo khóa Learn & Earn', 'Create Learn & Earn course'),
  ('GUIDE_WRITE', 'content_value', 'knowledge', 2.0, 'Viết tài liệu hướng dẫn', 'Write guide document'),
  ('SYSTEM_IMPROVE', 'content_value', 'knowledge', 2.5, 'Đề xuất cải tiến hệ thống', 'Propose system improvement'),

  -- Nhóm 4: Kinh tế Web3 (web3_economic)
  ('NFT_MINT', 'web3_economic', 'onchain', 1.5, 'Mint NFT có giá trị thật', 'Mint real-value NFT'),
  ('TRANSPARENT_TX', 'web3_economic', 'onchain', 1.0, 'Giao dịch minh bạch', 'Transparent transaction'),
  ('STAKING', 'web3_economic', 'onchain', 1.5, 'Staking FUN / Camly Coin', 'Stake FUN / Camly Coin'),
  ('GOV_VOTE', 'web3_economic', 'onchain', 2.0, 'Tham gia Governance vote', 'Participate in governance vote'),
  ('LEARN_EARN_COMPLETE', 'web3_economic', 'earn_give', 1.0, 'Hoàn thành Learn & Earn', 'Complete Learn & Earn'),
  ('DONATE_SUPPORT', 'web3_economic', 'earn_give', 2.5, 'Quyên góp FUN Charity', 'Donate to FUN Charity'),
  ('TIP_REWARD', 'web3_economic', 'earn_give', 1.0, 'Thưởng lại người khác', 'Tip/reward others'),

  -- Nhóm 5: Đóng góp hệ sinh thái (ecosystem_contribution)
  ('FUN_PLAY_CONTENT', 'ecosystem_contribution', 'cross_platform', 1.5, 'Tạo nội dung trên FUN Play', 'Create content on FUN Play'),
  ('FUN_ACADEMY_JOIN', 'ecosystem_contribution', 'cross_platform', 1.0, 'Tham gia FUN Academy', 'Join FUN Academy'),
  ('FUN_LEGAL_CONTRIB', 'ecosystem_contribution', 'cross_platform', 2.0, 'Đóng góp FUN Legal', 'Contribute to FUN Legal'),
  ('FUN_EARTH_JOIN', 'ecosystem_contribution', 'cross_platform', 1.5, 'Tham gia FUN Earth', 'Join FUN Earth'),
  ('BUG_REPORT', 'ecosystem_contribution', 'builder', 2.0, 'Phát hiện bug', 'Report bug'),
  ('UX_IMPROVE', 'ecosystem_contribution', 'builder', 2.0, 'Đề xuất cải tiến UX', 'Propose UX improvement'),
  ('CODE_CONTRIB', 'ecosystem_contribution', 'builder', 3.0, 'Đóng góp code', 'Contribute code'),
  ('STRATEGY_CONTRIB', 'ecosystem_contribution', 'builder', 3.0, 'Đóng góp chiến lược', 'Contribute strategy'),

  -- Nhóm 6: Các hành động đã có trong hệ thống
  ('QUESTION_ASK', 'community_interaction', 'light_interaction', 0.5, 'Đặt câu hỏi', 'Ask question'),
  ('JOURNAL_WRITE', 'self_light', 'daily_presence', 1.0, 'Viết nhật ký biết ơn', 'Write gratitude journal'),
  ('GRATITUDE_PRACTICE', 'self_light', 'daily_presence', 0.8, 'Thực hành biết ơn', 'Gratitude practice'),
  ('VISION_CREATE', 'content_value', 'content_creation', 1.5, 'Tạo bảng tầm nhìn', 'Create vision board'),
  ('REFERRAL_INVITE', 'community_interaction', 'mentorship', 1.5, 'Mời bạn bè tham gia', 'Invite friends'),
  ('POLICY_REVIEW', 'ecosystem_contribution', 'builder', 1.5, 'Xem xét chính sách', 'Review policy');
