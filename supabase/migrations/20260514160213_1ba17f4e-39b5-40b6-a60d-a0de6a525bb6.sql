-- Phase 5B: Pet Genesis NFT

-- 1) Seed collection
INSERT INTO public.nft_collections (code, name, description, supply_max, soulbound, traits_schema)
VALUES (
  'pet_genesis',
  'Pet Genesis',
  'Soulbound NFT đại diện cho Angel Pet — tiến hoá theo level (spark → glow → flame → star → sun → cosmos).',
  5000, true,
  '{"element":["fire","water","earth","air","light"],"personality":["joyful","wise","bold","gentle"],"evolution":["spark","glow","flame","star","sun","cosmos"]}'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- 2) Evolution log
CREATE TABLE IF NOT EXISTS public.nft_pet_evolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_item_id UUID NOT NULL REFERENCES public.nft_items(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL,
  user_id UUID NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  level_at_evolve INTEGER,
  evolved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nft_pet_evolution_log_pet_idx ON public.nft_pet_evolution_log(pet_id, evolved_at DESC);

ALTER TABLE public.nft_pet_evolution_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pet_evolution_log owner read"
  ON public.nft_pet_evolution_log FOR SELECT
  USING (auth.uid() = user_id);

-- 3) Trigger on adopt → mint Pet Genesis
CREATE OR REPLACE FUNCTION public.trg_pet_adopt_nft()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  v_item_id := public.enqueue_nft_mint(
    NEW.user_id,
    'pet_genesis',
    'pet_adopt',
    'pet_' || NEW.id::text,
    jsonb_build_object(
      'pet_id', NEW.id,
      'pet_name', NEW.name,
      'element', NEW.element::text,
      'personality', NEW.personality::text,
      'evolution', NEW.evolution::text,
      'level', NEW.level,
      'adopted_at', NEW.created_at
    )
  );

  IF v_item_id IS NOT NULL THEN
    INSERT INTO public.nft_pet_evolution_log(nft_item_id, pet_id, user_id, from_stage, to_stage, level_at_evolve)
    VALUES (v_item_id, NEW.id, NEW.user_id, NULL, NEW.evolution::text, NEW.level);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pet_adopt_nft_trigger ON public.pets;
CREATE TRIGGER pet_adopt_nft_trigger
AFTER INSERT ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.trg_pet_adopt_nft();

-- 4) Trigger on evolution change → update traits + log
CREATE OR REPLACE FUNCTION public.trg_pet_evolution_nft()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  IF NEW.evolution IS NOT DISTINCT FROM OLD.evolution AND NEW.level = OLD.level THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_item_id FROM public.nft_items
  WHERE collection_code = 'pet_genesis'
    AND owner_user_id = NEW.user_id
    AND source_ref = 'pet_' || NEW.id::text;

  IF v_item_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.nft_items
  SET traits = traits
        || jsonb_build_object('evolution', NEW.evolution::text, 'level', NEW.level, 'updated_at', now())
  WHERE id = v_item_id;

  IF NEW.evolution IS DISTINCT FROM OLD.evolution THEN
    INSERT INTO public.nft_pet_evolution_log(nft_item_id, pet_id, user_id, from_stage, to_stage, level_at_evolve)
    VALUES (v_item_id, NEW.id, NEW.user_id, OLD.evolution::text, NEW.evolution::text, NEW.level);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pet_evolution_nft_trigger ON public.pets;
CREATE TRIGGER pet_evolution_nft_trigger
AFTER UPDATE OF evolution, level ON public.pets
FOR EACH ROW EXECUTE FUNCTION public.trg_pet_evolution_nft();

-- 5) Backfill: cấp Pet Genesis cho các pet đã adopt trước đó
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.pets LOOP
    PERFORM public.enqueue_nft_mint(
      r.user_id, 'pet_genesis', 'pet_adopt', 'pet_' || r.id::text,
      jsonb_build_object(
        'pet_id', r.id, 'pet_name', r.name,
        'element', r.element::text, 'personality', r.personality::text,
        'evolution', r.evolution::text, 'level', r.level,
        'adopted_at', r.created_at, 'backfilled', true
      )
    );
  END LOOP;
END$$;