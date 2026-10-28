ALTER TABLE public.scoring_rules ADD COLUMN IF NOT EXISTS effective_after TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.scoring_rules.effective_after IS 'Timelock: new rules only become active after this timestamp. NULL means immediately active (legacy). New rules should set this to NOW() + interval 48 hours.';