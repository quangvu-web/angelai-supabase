-- Add new v2.0 pillar columns to pplp_scores
ALTER TABLE public.pplp_scores
  ADD COLUMN IF NOT EXISTS pillar_repentance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_gratitude numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_service numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_helping numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pillar_giving numeric DEFAULT 0;

-- Add new scoring dimensions (Intent/Depth/Impact/Trust)
ALTER TABLE public.pplp_scores
  ADD COLUMN IF NOT EXISTS intent_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depth_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS impact_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_factor numeric DEFAULT 0;

-- Add NLP feature columns
ALTER TABLE public.pplp_scores
  ADD COLUMN IF NOT EXISTS ego_signal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS authenticity_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS love_tone numeric DEFAULT 0;

-- Add engine version tracking
ALTER TABLE public.pplp_scores
  ADD COLUMN IF NOT EXISTS scoring_engine_version text DEFAULT 'v1.0';