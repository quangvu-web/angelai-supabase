CREATE OR REPLACE FUNCTION public.get_active_boss()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_boss RECORD;
  v_user UUID := auth.uid();
  v_my_dmg BIGINT := 0;
  v_my_pct NUMERIC := 0;
  v_top JSONB;
BEGIN
  SELECT * INTO v_boss FROM public.raid_bosses
   WHERE status IN ('active','defeated')
   ORDER BY (status='active') DESC, starts_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  IF v_user IS NOT NULL THEN
    SELECT total_damage INTO v_my_dmg FROM public.raid_contributions
      WHERE boss_id = v_boss.id AND user_id = v_user;
    v_my_dmg := COALESCE(v_my_dmg, 0);
    IF v_boss.total_hp > 0 THEN
      v_my_pct := ROUND((v_my_dmg::numeric / v_boss.total_hp::numeric) * 100, 4);
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', rc.user_id,
      'display_name', COALESCE(p.display_name, p.handle, 'Ẩn danh'),
      'handle', p.handle,
      'avatar_url', p.avatar_url,
      'pct', ROUND((rc.total_damage::numeric / v_boss.total_hp::numeric) * 100, 3)
    )), '[]'::jsonb)
  INTO v_top
  FROM (
    SELECT user_id, total_damage FROM public.raid_contributions
    WHERE boss_id = v_boss.id ORDER BY total_damage DESC LIMIT 10
  ) rc
  LEFT JOIN public.profiles p ON p.user_id = rc.user_id;

  RETURN jsonb_build_object(
    'active', true,
    'boss', jsonb_build_object(
      'id', v_boss.id,
      'code', v_boss.code,
      'name', v_boss.name,
      'lore', v_boss.lore,
      'art_url', v_boss.art_url,
      'total_hp', v_boss.total_hp,
      'current_hp', v_boss.current_hp,
      'hp_pct', ROUND((v_boss.current_hp::numeric / v_boss.total_hp::numeric) * 100, 2),
      'status', v_boss.status,
      'starts_at', v_boss.starts_at,
      'ends_at', v_boss.ends_at,
      'defeated_at', v_boss.defeated_at
    ),
    'me', jsonb_build_object(
      'damage', v_my_dmg,
      'pct', v_my_pct,
      'authenticated', v_user IS NOT NULL
    ),
    'top_contributors', v_top
  );
END;
$function$;