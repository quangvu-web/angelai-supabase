
-- Phase 10: Lamp Keeper NFT cho người góp >= 25% khi đèn hoàn thành

INSERT INTO public.nft_collections (code, name, description, supply_max, soulbound, image_url, traits_schema, active)
VALUES (
  'lamp_keeper',
  'Lamp Keeper',
  'Huy hiệu Soulbound dành cho những người đã góp >= 25% ánh sáng cho một ngọn đèn của Vòng Sáng. Trao tự động khi đèn đạt 100%.',
  NULL,
  true,
  NULL,
  '{"properties":{"lamp_id":{"type":"string"},"lamp_name":{"type":"string"},"circle_id":{"type":"string"},"share_pct":{"type":"number"},"contribution":{"type":"integer"},"completed_at":{"type":"string"}}}'::jsonb,
  true
)
ON CONFLICT (code) DO NOTHING;

-- Trigger: khi grant insert (chỉ xảy ra qua trigger Phase 9 SECURITY DEFINER), nếu share_pct >= 25 thì enqueue NFT
CREATE OR REPLACE FUNCTION public.tg_lamp_keeper_nft_on_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lamp RECORD;
BEGIN
  IF NEW.share_pct < 25 THEN
    RETURN NEW;
  END IF;

  SELECT id, name, circle_id, ends_at, current_light, target_light
    INTO v_lamp
  FROM public.light_circle_lamps
  WHERE id = NEW.lamp_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_nft_mint(
    NEW.user_id,
    'lamp_keeper',
    'circle_lamp',
    'lamp:' || NEW.lamp_id::text,
    jsonb_build_object(
      'lamp_id', NEW.lamp_id,
      'lamp_name', v_lamp.name,
      'circle_id', NEW.circle_id,
      'share_pct', NEW.share_pct,
      'contribution', NEW.contribution,
      'completed_at', now()
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Không chặn flow loot nếu enqueue lỗi
  RAISE WARNING 'lamp_keeper_nft_enqueue_failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lamp_keeper_nft_on_grant ON public.light_circle_lamp_loot_grants;
CREATE TRIGGER trg_lamp_keeper_nft_on_grant
AFTER INSERT ON public.light_circle_lamp_loot_grants
FOR EACH ROW
EXECUTE FUNCTION public.tg_lamp_keeper_nft_on_grant();

-- Backfill: cấp NFT cho các grant đã tồn tại có share_pct >= 25
DO $$
DECLARE
  r RECORD;
  v_lamp RECORD;
BEGIN
  FOR r IN
    SELECT g.* FROM public.light_circle_lamp_loot_grants g
    WHERE g.share_pct >= 25
  LOOP
    SELECT id, name FROM public.light_circle_lamps WHERE id = r.lamp_id INTO v_lamp;
    IF FOUND THEN
      PERFORM public.enqueue_nft_mint(
        r.user_id, 'lamp_keeper', 'circle_lamp', 'lamp:' || r.lamp_id::text,
        jsonb_build_object(
          'lamp_id', r.lamp_id, 'lamp_name', v_lamp.name,
          'circle_id', r.circle_id, 'share_pct', r.share_pct,
          'contribution', r.contribution, 'completed_at', r.created_at
        )
      );
    END IF;
  END LOOP;
END$$;
