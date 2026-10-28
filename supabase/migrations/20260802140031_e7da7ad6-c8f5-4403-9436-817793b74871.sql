INSERT INTO public.system_settings (key, value, description)
VALUES ('ai_routing', '{"lock_google_only": true}'::jsonb, 'Khóa luồng AI: chỉ dùng Cloudflare BYOK → Google API trực tiếp, chặn fallback Lovable Gateway')
ON CONFLICT (key) DO NOTHING;