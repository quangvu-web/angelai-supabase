
-- 1. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_title text,
  ADD COLUMN IF NOT EXISTS active_achievement_code text;

-- 2. Catalog
CREATE TABLE IF NOT EXISTS public.achievements (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '✨',
  category text NOT NULL,
  tier smallint NOT NULL DEFAULT 1,
  title_text text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achievements public read" ON public.achievements;
CREATE POLICY "achievements public read" ON public.achievements
  FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "achievements admin manage" ON public.achievements;
CREATE POLICY "achievements admin manage" ON public.achievements
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3. User achievements
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_code text NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id, achievement_code)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id, unlocked_at DESC);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ua self read" ON public.user_achievements;
CREATE POLICY "ua self read" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "ua admin manage" ON public.user_achievements;
CREATE POLICY "ua admin manage" ON public.user_achievements
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. grant_achievement RPC
CREATE OR REPLACE FUNCTION public.grant_achievement(_user_id uuid, _code text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_title text; v_has_title boolean;
BEGIN
  IF _user_id IS NULL OR _code IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM achievements WHERE code = _code AND is_active = true) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM user_achievements ua WHERE ua.user_id=_user_id AND ua.achievement_code=_code) THEN RETURN false; END IF;
  INSERT INTO user_achievements(user_id, achievement_code, meta) VALUES (_user_id, _code, _meta);
  SELECT title_text INTO v_title FROM achievements WHERE code = _code;
  IF v_title IS NOT NULL THEN
    SELECT (p.active_title IS NOT NULL) INTO v_has_title FROM profiles p WHERE p.user_id = _user_id;
    IF NOT COALESCE(v_has_title, false) THEN
      UPDATE profiles SET active_title = v_title, active_achievement_code = _code, updated_at = now() WHERE user_id = _user_id;
    END IF;
  END IF;
  RETURN true;
END $$;

-- 5. set_active_title
CREATE OR REPLACE FUNCTION public.set_active_title(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_title text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_authenticated'); END IF;
  IF _code IS NULL THEN
    UPDATE profiles SET active_title=NULL, active_achievement_code=NULL, updated_at=now() WHERE user_id=v_uid;
    RETURN jsonb_build_object('success',true,'cleared',true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_achievements ua WHERE ua.user_id=v_uid AND ua.achievement_code=_code) THEN
    RETURN jsonb_build_object('success',false,'error','not_unlocked');
  END IF;
  SELECT title_text INTO v_title FROM achievements WHERE code=_code AND is_active=true;
  IF v_title IS NULL THEN RETURN jsonb_build_object('success',false,'error','no_title'); END IF;
  UPDATE profiles SET active_title=v_title, active_achievement_code=_code, updated_at=now() WHERE user_id=v_uid;
  RETURN jsonb_build_object('success',true,'title',v_title,'code',_code);
END $$;

-- 6. get_user_achievements
CREATE OR REPLACE FUNCTION public.get_user_achievements(_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := COALESCE(_user_id, auth.uid()); v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', a.code, 'name', a.name, 'description', a.description,
    'icon', a.icon, 'category', a.category, 'tier', a.tier,
    'title_text', a.title_text, 'sort_order', a.sort_order,
    'unlocked', (ua.user_id IS NOT NULL),
    'unlocked_at', ua.unlocked_at
  ) ORDER BY a.category, a.sort_order, a.tier), '[]'::jsonb)
  INTO v_result
  FROM achievements a
  LEFT JOIN user_achievements ua ON ua.achievement_code=a.code AND ua.user_id=v_uid
  WHERE a.is_active = true;
  RETURN v_result;
END $$;

-- 7. Seed
INSERT INTO public.achievements (code, name, description, icon, category, tier, title_text, criteria, sort_order) VALUES
  ('ascendant_t1','Ánh sáng sơ khai','Hoàn tất Thăng Sáng Tier 1','🌅','ascension',1,'Thăng Sáng I','{"tier":1}',101),
  ('ascendant_t2','Ánh sáng tinh tấn','Hoàn tất Thăng Sáng Tier 2','🌄','ascension',2,'Thăng Sáng II','{"tier":2}',102),
  ('ascendant_t3','Ánh sáng rực rỡ','Hoàn tất Thăng Sáng Tier 3','☀️','ascension',3,'Thăng Sáng III','{"tier":3}',103),
  ('ascendant_t4','Ánh sáng vô lượng','Hoàn tất Thăng Sáng Tier 4','🌟','ascension',4,'Thăng Sáng IV','{"tier":4}',104),
  ('ascendant_t5','Ánh sáng tối thượng','Hoàn tất Thăng Sáng Tier 5','✨','ascension',5,'Thăng Sáng V','{"tier":5}',105),
  ('pet_first','Bạn đồng hành','Nhận pet đầu tiên','🐾','pet',1,'Bạn của Tinh linh','{}',201),
  ('treasure_first','Bước chân khám phá','Giải kho báu đầu tiên','🗺️','treasure',1,'Thợ săn ánh sáng','{}',301),
  ('treasure_5','Người săn kho báu','Giải 5 kho báu','🏆','treasure',2,'Lữ khách kho báu','{"count":5}',302),
  ('referral_1','Người gieo duyên','Mời thành công 1 bạn','💌','referral',1,'Người kết nối','{"count":1}',401),
  ('referral_5','Người gọi ánh sáng','Mời thành công 5 bạn','📣','referral',2,'Người gọi ánh sáng','{"count":5}',402),
  ('referral_20','Hải đăng dẫn lối','Mời thành công 20 bạn','🗼','referral',3,'Hải đăng','{"count":20}',403),
  ('mastery_10','Thiền giả','Đạt Mastery cấp 10','🧘','mastery',1,'Thiền giả ánh sáng','{"level":10}',501),
  ('mastery_25','Bậc thầy','Đạt Mastery cấp 25','🌀','mastery',2,'Bậc thầy ánh sáng','{"level":25}',502),
  ('mastery_50','Đại sư','Đạt Mastery cấp 50','🔱','mastery',3,'Đại sư ánh sáng','{"level":50}',503),
  ('nft_5','Người sưu tầm','Sở hữu 5 NFT','🎴','nft',1,'Người sưu tầm','{"count":5}',601),
  ('nft_20','Nhà sưu tập','Sở hữu 20 NFT','🖼️','nft',2,'Nhà sưu tập','{"count":20}',602),
  ('nft_50','Bảo tàng sống','Sở hữu 50 NFT','🏛️','nft',3,'Bảo tàng sống','{"count":50}',603),
  ('lamp_keeper','Người giữ đèn','Nhận phần thưởng giữ đèn lần đầu','🏮','lamp',1,'Người giữ đèn','{}',701),
  ('lamp_keeper_5','Quản đăng','Giữ đèn thành công 5 lần','🪔','lamp',2,'Quản đăng','{"count":5}',702),
  ('season_premium','Tinh tú mùa','Mở khoá Season Pass Premium','🎟️','season',1,'Tinh tú mùa','{}',801)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon,
  title_text=EXCLUDED.title_text, sort_order=EXCLUDED.sort_order, is_active=true;

-- 8. Triggers
CREATE OR REPLACE FUNCTION public.tg_ach_on_ascension()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM grant_achievement(NEW.user_id, 'ascendant_t'||NEW.tier::text, jsonb_build_object('tier',NEW.tier)); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS tg_ach_ascension ON public.user_ascensions;
CREATE TRIGGER tg_ach_ascension AFTER INSERT ON public.user_ascensions FOR EACH ROW EXECUTE FUNCTION public.tg_ach_on_ascension();

CREATE OR REPLACE FUNCTION public.tg_ach_on_pet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM grant_achievement(NEW.user_id, 'pet_first'); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS tg_ach_pet ON public.pets;
CREATE TRIGGER tg_ach_pet AFTER INSERT ON public.pets FOR EACH ROW EXECUTE FUNCTION public.tg_ach_on_pet();

CREATE OR REPLACE FUNCTION public.tg_ach_on_treasure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM grant_achievement(NEW.user_id, 'treasure_first');
  SELECT count(*) INTO v_count FROM treasure_progress tp WHERE tp.user_id = NEW.user_id;
  IF v_count >= 5 THEN PERFORM grant_achievement(NEW.user_id, 'treasure_5'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_ach_treasure ON public.treasure_progress;
CREATE TRIGGER tg_ach_treasure AFTER INSERT ON public.treasure_progress FOR EACH ROW EXECUTE FUNCTION public.tg_ach_on_treasure();

CREATE OR REPLACE FUNCTION public.tg_ach_on_referral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM viral_referrals vr WHERE vr.referrer_id = NEW.referrer_id AND vr.completed_at IS NOT NULL;
  IF v_count >= 1 THEN PERFORM grant_achievement(NEW.referrer_id, 'referral_1'); END IF;
  IF v_count >= 5 THEN PERFORM grant_achievement(NEW.referrer_id, 'referral_5'); END IF;
  IF v_count >= 20 THEN PERFORM grant_achievement(NEW.referrer_id, 'referral_20'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_ach_referral ON public.viral_referrals;
CREATE TRIGGER tg_ach_referral AFTER UPDATE OF completed_at ON public.viral_referrals FOR EACH ROW EXECUTE FUNCTION public.tg_ach_on_referral();

CREATE OR REPLACE FUNCTION public.tg_ach_on_mastery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.level >= 10 THEN PERFORM grant_achievement(NEW.user_id, 'mastery_10'); END IF;
  IF NEW.level >= 25 THEN PERFORM grant_achievement(NEW.user_id, 'mastery_25'); END IF;
  IF NEW.level >= 50 THEN PERFORM grant_achievement(NEW.user_id, 'mastery_50'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_ach_mastery ON public.user_mastery;
CREATE TRIGGER tg_ach_mastery AFTER INSERT OR UPDATE OF level ON public.user_mastery FOR EACH ROW EXECUTE FUNCTION public.tg_ach_on_mastery();

CREATE OR REPLACE FUNCTION public.tg_ach_on_nft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.owner_user_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM nft_items n WHERE n.owner_user_id = NEW.owner_user_id;
  IF v_count >= 5 THEN PERFORM grant_achievement(NEW.owner_user_id, 'nft_5'); END IF;
  IF v_count >= 20 THEN PERFORM grant_achievement(NEW.owner_user_id, 'nft_20'); END IF;
  IF v_count >= 50 THEN PERFORM grant_achievement(NEW.owner_user_id, 'nft_50'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_ach_nft ON public.nft_items;
CREATE TRIGGER tg_ach_nft AFTER INSERT ON public.nft_items FOR EACH ROW EXECUTE FUNCTION public.tg_ach_on_nft();

CREATE OR REPLACE FUNCTION public.tg_ach_on_lamp_grant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count int;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM grant_achievement(NEW.user_id, 'lamp_keeper');
  SELECT count(*) INTO v_count FROM light_circle_lamp_loot_grants g WHERE g.user_id = NEW.user_id;
  IF v_count >= 5 THEN PERFORM grant_achievement(NEW.user_id, 'lamp_keeper_5'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tg_ach_lamp_grant ON public.light_circle_lamp_loot_grants;
CREATE TRIGGER tg_ach_lamp_grant AFTER INSERT ON public.light_circle_lamp_loot_grants FOR EACH ROW EXECUTE FUNCTION public.tg_ach_on_lamp_grant();

-- 9. Backfill
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT DISTINCT ua.user_id, 'ascendant_t'||ua.tier::text FROM public.user_ascensions ua
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT DISTINCT p.user_id, 'pet_first' FROM public.pets p WHERE p.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT DISTINCT tp.user_id, 'treasure_first' FROM public.treasure_progress tp WHERE tp.user_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT tp.user_id, 'treasure_5' FROM public.treasure_progress tp WHERE tp.user_id IS NOT NULL
GROUP BY tp.user_id HAVING count(*) >= 5
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT vr.referrer_id, 'referral_1' FROM public.viral_referrals vr WHERE vr.completed_at IS NOT NULL
GROUP BY vr.referrer_id HAVING count(*) >= 1
ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT vr.referrer_id, 'referral_5' FROM public.viral_referrals vr WHERE vr.completed_at IS NOT NULL
GROUP BY vr.referrer_id HAVING count(*) >= 5
ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT vr.referrer_id, 'referral_20' FROM public.viral_referrals vr WHERE vr.completed_at IS NOT NULL
GROUP BY vr.referrer_id HAVING count(*) >= 20
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT um.user_id, 'mastery_10' FROM public.user_mastery um WHERE um.level >= 10
ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT um.user_id, 'mastery_25' FROM public.user_mastery um WHERE um.level >= 25
ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT um.user_id, 'mastery_50' FROM public.user_mastery um WHERE um.level >= 50
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT n.owner_user_id, 'nft_5' FROM public.nft_items n WHERE n.owner_user_id IS NOT NULL
GROUP BY n.owner_user_id HAVING count(*) >= 5
ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT n.owner_user_id, 'nft_20' FROM public.nft_items n WHERE n.owner_user_id IS NOT NULL
GROUP BY n.owner_user_id HAVING count(*) >= 20
ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT n.owner_user_id, 'nft_50' FROM public.nft_items n WHERE n.owner_user_id IS NOT NULL
GROUP BY n.owner_user_id HAVING count(*) >= 50
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT DISTINCT g.user_id, 'lamp_keeper' FROM public.light_circle_lamp_loot_grants g WHERE g.user_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT g.user_id, 'lamp_keeper_5' FROM public.light_circle_lamp_loot_grants g WHERE g.user_id IS NOT NULL
GROUP BY g.user_id HAVING count(*) >= 5
ON CONFLICT DO NOTHING;

INSERT INTO public.user_achievements(user_id, achievement_code)
SELECT usp.user_id, 'season_premium' FROM public.user_season_pass usp WHERE usp.is_premium = true
ON CONFLICT DO NOTHING;

GRANT EXECUTE ON FUNCTION public.grant_achievement(uuid,text,jsonb) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_active_title(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_achievements(uuid) TO authenticated, anon;
