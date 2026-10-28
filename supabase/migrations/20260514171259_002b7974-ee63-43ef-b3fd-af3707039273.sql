-- ============================================================
-- 1) Tables
-- ============================================================

CREATE TABLE public.game_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  theme TEXT,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  xp_per_level INT NOT NULL DEFAULT 100 CHECK (xp_per_level > 0),
  max_level INT NOT NULL DEFAULT 30 CHECK (max_level > 0),
  premium_price_camly INT NOT NULL DEFAULT 5000 CHECK (premium_price_camly >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_seasons_active ON public.game_seasons(is_active, starts_at DESC);

CREATE TABLE public.season_pass_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES public.game_seasons(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level >= 1),
  track TEXT NOT NULL CHECK (track IN ('free','premium')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('camly','box_ticket','pet_xp','badge','cosmetic','fun_money')),
  reward_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  label TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, level, track)
);
CREATE INDEX idx_season_pass_rewards_season ON public.season_pass_rewards(season_id, level);

CREATE TABLE public.user_season_pass (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  season_id UUID NOT NULL REFERENCES public.game_seasons(id) ON DELETE CASCADE,
  xp INT NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  is_premium BOOLEAN NOT NULL DEFAULT false,
  premium_unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, season_id)
);
CREATE INDEX idx_user_season_pass_user ON public.user_season_pass(user_id);

CREATE TABLE public.user_season_xp_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  season_id UUID NOT NULL REFERENCES public.game_seasons(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  amount INT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, season_id, source, ref_id)
);
CREATE INDEX idx_user_season_xp_log_user ON public.user_season_xp_log(user_id, created_at DESC);

CREATE TABLE public.user_season_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pass_id UUID NOT NULL REFERENCES public.user_season_pass(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.game_seasons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  level INT NOT NULL,
  track TEXT NOT NULL CHECK (track IN ('free','premium')),
  reward_type TEXT NOT NULL,
  reward_value JSONB,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_pass_id, level, track)
);
CREATE INDEX idx_user_season_claims_user ON public.user_season_claims(user_id, season_id);

-- ============================================================
-- 2) RLS
-- ============================================================
ALTER TABLE public.game_seasons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_pass_rewards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_season_pass      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_season_xp_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_season_claims    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone view seasons"      ON public.game_seasons        FOR SELECT USING (true);
CREATE POLICY "anyone view rewards"      ON public.season_pass_rewards FOR SELECT USING (true);
CREATE POLICY "user view own pass"       ON public.user_season_pass    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user view own xp log"     ON public.user_season_xp_log  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user view own claims"     ON public.user_season_claims  FOR SELECT USING (auth.uid() = user_id);

-- Realtime
ALTER TABLE public.user_season_pass REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_season_pass;