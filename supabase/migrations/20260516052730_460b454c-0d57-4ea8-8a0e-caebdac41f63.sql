ALTER TABLE public.viral_referrals ALTER COLUMN reward_camly_each SET DEFAULT 20000;
UPDATE public.viral_referrals SET reward_camly_each = 20000 WHERE completed_at IS NULL AND reward_camly_each = 100;