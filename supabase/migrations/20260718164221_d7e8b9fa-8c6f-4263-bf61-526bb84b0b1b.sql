ALTER TABLE public.user_api_keys ADD COLUMN IF NOT EXISTS image_daily_limit INTEGER;
UPDATE public.user_api_keys SET image_daily_limit = 500 WHERE id = '428d2cb9-ac32-411c-8474-02bbf365e727';