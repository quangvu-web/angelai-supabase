CREATE OR REPLACE FUNCTION public.forge_combine(p_recipe_id uuid, p_nft_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_recipe public.light_forge_recipes%ROWTYPE;
  v_count integer;
  v_today_burn integer;
  v_balance bigint;
  v_new_item_id uuid;
  v_echo boolean := false;
  v_traits jsonb;
  v_log_id uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT * INTO v_recipe FROM public.light_forge_recipes WHERE id = p_recipe_id AND enabled = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'recipe_not_found'); END IF;
  IF array_length(p_nft_ids, 1) IS DISTINCT FROM v_recipe.input_count THEN RETURN jsonb_build_object('ok', false, 'reason', 'wrong_input_count', 'need', v_recipe.input_count); END IF;
  SELECT count(*) INTO v_count FROM public.nft_items WHERE id = ANY(p_nft_ids) AND owner_user_id = v_user AND (traits->>'tier') = v_recipe.input_tier;
  IF v_count <> v_recipe.input_count OR array_length(p_nft_ids, 1) <> (SELECT count(DISTINCT x) FROM unnest(p_nft_ids) x) THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_inputs'); END IF;
  SELECT COALESCE(SUM(camly_burned), 0) INTO v_today_burn FROM public.light_forge_log WHERE user_id = v_user AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh');
  IF v_today_burn + v_recipe.camly_cost > 30000 THEN RETURN jsonb_build_object('ok', false, 'reason', 'daily_burn_cap', 'cap', 30000, 'used', v_today_burn); END IF;
  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_camly_coins WHERE user_id = v_user;
  IF v_balance < v_recipe.camly_cost THEN RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_camly', 'need', v_recipe.camly_cost, 'have', v_balance); END IF;
  PERFORM public.add_camly_coins(v_user, (-v_recipe.camly_cost)::bigint, 'forge_burn'::coin_transaction_type, 'Light Forge ' || v_recipe.input_tier || ' to ' || v_recipe.output_tier, NULL, jsonb_build_object('recipe_id', v_recipe.id, 'tier_in', v_recipe.input_tier, 'tier_out', v_recipe.output_tier));
  DELETE FROM public.nft_items WHERE id = ANY(p_nft_ids) AND owner_user_id = v_user;
  v_traits := public.fn_random_nft_traits(v_recipe.output_collection) || jsonb_build_object('tier', v_recipe.output_tier, 'forged_from', v_recipe.input_tier);
  v_new_item_id := public.enqueue_nft_mint(v_user, v_recipe.output_collection, 'forge', 'forge:' || v_recipe.id::text || ':' || gen_random_uuid()::text, v_traits);
  IF random() < v_recipe.echo_chance THEN
    v_echo := true;
    PERFORM public.grant_box_ticket(v_user, 'cosmic', 'forge_echo', 'forge:' || v_new_item_id::text);
  END IF;
  PERFORM public.add_mastery_xp(v_user, 'forge', v_new_item_id::text, v_recipe.xp_reward);
  INSERT INTO public.light_forge_log (user_id, recipe_id, input_nft_ids, output_nft_id, echo_granted, camly_burned, xp_awarded) VALUES (v_user, v_recipe.id, p_nft_ids, v_new_item_id, v_echo, v_recipe.camly_cost, v_recipe.xp_reward) RETURNING id INTO v_log_id;
  RETURN jsonb_build_object('ok', true, 'output_nft_id', v_new_item_id, 'output_tier', v_recipe.output_tier, 'camly_burned', v_recipe.camly_cost, 'xp_awarded', v_recipe.xp_reward, 'echo_granted', v_echo, 'log_id', v_log_id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.forge_combine(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forge_combine(uuid, uuid[]) TO authenticated;