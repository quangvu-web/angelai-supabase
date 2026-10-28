CREATE OR REPLACE FUNCTION public.claim_boss_loot(p_boss_id uuid, p_loot_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_boss RECORD;
  v_loot RECORD;
  v_my_pct NUMERIC := 0;
  v_my_dmg BIGINT := 0;
  v_count INT := 1;
  i INT;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_boss FROM public.raid_bosses WHERE id = p_boss_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','boss_not_found'); END IF;
  IF v_boss.status NOT IN ('defeated','expired') THEN
    RETURN jsonb_build_object('success',false,'error','boss_alive');
  END IF;

  SELECT * INTO v_loot FROM public.raid_loot_table WHERE id = p_loot_id AND boss_id = p_boss_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','loot_not_found'); END IF;

  IF v_boss.status = 'expired' AND NOT v_loot.expired_eligible THEN
    RETURN jsonb_build_object('success',false,'error','tier_locked_on_expire');
  END IF;

  SELECT total_damage INTO v_my_dmg FROM public.raid_contributions
    WHERE boss_id = p_boss_id AND user_id = v_user;
  v_my_dmg := COALESCE(v_my_dmg, 0);
  IF v_boss.total_hp > 0 THEN
    v_my_pct := (v_my_dmg::numeric / v_boss.total_hp::numeric) * 100;
  END IF;

  IF v_my_pct < v_loot.min_contribution_pct THEN
    RETURN jsonb_build_object('success',false,'error','insufficient_contribution',
                              'my_pct', v_my_pct, 'required_pct', v_loot.min_contribution_pct);
  END IF;

  BEGIN
    INSERT INTO public.raid_loot_claims (boss_id, user_id, loot_id)
      VALUES (p_boss_id, v_user, p_loot_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success',false,'error','already_claimed');
  END;

  v_count := GREATEST(1, COALESCE((v_loot.reward_value->>'count')::int, 1));

  IF v_loot.reward_type = 'camly' THEN
    PERFORM public.add_camly_coins(v_user, COALESCE((v_loot.reward_value->>'amount')::int, 0), 'raid_loot', p_loot_id::text);
  ELSIF v_loot.reward_type = 'box_ticket' THEN
    FOR i IN 1..v_count LOOP
      PERFORM public.grant_box_ticket(
        v_user,
        COALESCE(v_loot.reward_value->>'tier','common'),
        'raid_loot:' || p_loot_id::text || ':' || i::text
      );
    END LOOP;
  ELSIF v_loot.reward_type = 'pet_xp' THEN
    PERFORM public.pet_gain_xp(v_user, COALESCE((v_loot.reward_value->>'amount')::int,0), 'raid_loot:' || p_loot_id::text);
  ELSIF v_loot.reward_type = 'season_xp' THEN
    PERFORM public.add_season_xp('raid_loot', p_loot_id::text, COALESCE((v_loot.reward_value->>'amount')::int,0));
  ELSIF v_loot.reward_type = 'nft' THEN
    PERFORM public.enqueue_nft_mint(
      v_user,
      v_loot.reward_value->>'collection_code',
      'raid_loot:' || p_loot_id::text,
      v_loot.reward_value
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'reward_type', v_loot.reward_type, 'reward_value', v_loot.reward_value, 'count', v_count);
END;
$function$;