
ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'strict'
  CHECK (scope IN ('strict','open'));

INSERT INTO public.user_api_keys
  (user_id, key_hash, key_prefix, name, daily_limit, image_daily_limit, is_active, scope)
VALUES
  ('73c04f20-a486-4e96-9a1b-b40567a5e712',
   '3e87a3acace3bea9890730fb6736d5b4b6ebb771b472d155d0cd3fcbbd823e02',
   'ak_73c04_WlH...',
   'FUNPROFILE (open scope)',
   5000,
   500,
   true,
   'open');
