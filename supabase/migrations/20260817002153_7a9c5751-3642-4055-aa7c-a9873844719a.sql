insert into public.user_api_keys (user_id, key_hash, key_prefix, name, daily_limit, image_daily_limit, scope, is_active)
select u.id, '115debd9a48fa235c292150bef29e2d33a3c9e76376d7cb72a1809bd079d51f5', 'ak_urn_', 'URANTIA SERVICE KEY (Angel API v1)', 5000, 100, 'open', true
from auth.users u where u.email = 'trang73790104@gmail.com'
on conflict do nothing;