
-- 1. Create action_types lookup table
CREATE TABLE public.action_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  pillar_group TEXT NOT NULL DEFAULT 'S',
  base_impact_score NUMERIC NOT NULL DEFAULT 1.0,
  category TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.action_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Action types are readable by everyone"
  ON public.action_types FOR SELECT USING (true);

-- 2. Seed action_types with existing PPLP_ACTION_TYPES + BASE_REWARDS
INSERT INTO public.action_types (code, pillar_group, base_impact_score, category, description) VALUES
  -- Learning & Education
  ('LEARN_COMPLETE', 'S', 2000, 'Learning', 'Complete a learning module'),
  ('PROJECT_SUBMIT', 'S', 5000, 'Learning', 'Submit a project'),
  ('MENTOR_HELP', 'S', 3000, 'Learning', 'Help as a mentor'),
  ('COURSE_CREATE', 'S', 10000, 'Learning', 'Create a course'),
  ('QUIZ_PASS', 'S', 1000, 'Learning', 'Pass a quiz'),
  -- Content & Community
  ('CONTENT_CREATE', 'H', 1500, 'Community', 'Create content'),
  ('CONTENT_REVIEW', 'T', 1000, 'Community', 'Review content'),
  ('CONTENT_SHARE', 'U', 500, 'Community', 'Share content'),
  ('COMMENT_CREATE', 'U', 500, 'Community', 'Create a comment'),
  ('POST_ENGAGEMENT', 'U', 300, 'Community', 'Engage with a post'),
  -- Charity & Volunteer
  ('DONATE', 'S', 2000, 'Charity', 'Make a donation'),
  ('VOLUNTEER', 'S', 3000, 'Charity', 'Volunteer time'),
  ('CAMPAIGN_CREATE', 'S', 5000, 'Charity', 'Create a campaign'),
  ('CAMPAIGN_SUPPORT', 'S', 1000, 'Charity', 'Support a campaign'),
  -- Environment
  ('TREE_PLANT', 'S', 2000, 'Earth', 'Plant a tree'),
  ('CLEANUP_EVENT', 'S', 2500, 'Earth', 'Participate in cleanup'),
  ('CARBON_OFFSET', 'S', 1500, 'Earth', 'Offset carbon'),
  ('ECO_ACTION', 'S', 500, 'Earth', 'Eco-friendly action'),
  -- Commerce
  ('FARM_DELIVERY', 'S', 2000, 'Commerce', 'Farm delivery'),
  ('MARKET_FAIR_TRADE', 'T', 1500, 'Commerce', 'Fair trade transaction'),
  ('PRODUCT_REVIEW', 'T', 800, 'Commerce', 'Review a product'),
  ('SELLER_VERIFY', 'T', 2000, 'Commerce', 'Verify a seller'),
  -- Governance & Legal
  ('BUG_BOUNTY', 'T', 10000, 'Governance', 'Submit a bug bounty'),
  ('GOV_PROPOSAL', 'U', 5000, 'Governance', 'Submit a governance proposal'),
  ('GOV_VOTE', 'U', 500, 'Governance', 'Vote on governance'),
  ('DISPUTE_RESOLVE', 'T', 3000, 'Governance', 'Resolve a dispute'),
  ('POLICY_REVIEW', 'T', 1500, 'Governance', 'Review a policy'),
  -- Daily Life
  ('DAILY_RITUAL', 'H', 500, 'Daily', 'Daily ritual practice'),
  ('GRATITUDE_PRACTICE', 'H', 1000, 'Daily', 'Gratitude practice'),
  ('JOURNAL_WRITE', 'H', 2000, 'Daily', 'Write in journal'),
  ('QUESTION_ASK', 'S', 1500, 'Daily', 'Ask a meaningful question'),
  ('VISION_CREATE', 'H', 1000, 'Daily', 'Create a vision'),
  -- Investment
  ('STAKE_LOCK', 'C', 0, 'Investment', 'Lock tokens in staking'),
  ('LIQUIDITY_PROVIDE', 'C', 0, 'Investment', 'Provide liquidity'),
  ('REFERRAL_INVITE', 'U', 1000, 'Investment', 'Invite via referral'),
  -- Identity
  ('PROFILE_COMPLETE', 'T', 2000, 'Identity', 'Complete profile'),
  ('KYC_VERIFY', 'T', 5000, 'Identity', 'Complete KYC verification'),
  ('REPUTATION_EARN', 'T', 1000, 'Identity', 'Earn reputation'),
  -- Service (ERD-specific)
  ('SERVICE', 'S', 3000, 'Service', 'General service action');

-- 3. Add missing columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trust_level NUMERIC NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS total_fun_minted NUMERIC NOT NULL DEFAULT 0;

-- 4. Create convenience views for ERD naming
CREATE OR REPLACE VIEW public.user_actions AS
  SELECT * FROM public.pplp_actions;

CREATE OR REPLACE VIEW public.pplp_validations AS
  SELECT * FROM public.pplp_scores;
