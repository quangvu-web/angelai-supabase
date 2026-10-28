CREATE OR REPLACE FUNCTION public.forge_get_my_state() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_user uuid := auth.uid();
  v_recipes jsonb;
  v_tiers jsonb;
  v_today_burn integer;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.camly_cost), '[]'::jsonb) INTO v_recipes FROM public.light_forge_recipes r WHERE enabled = true;
  SELECT COALESCE(jsonb_object_agg(tier, cnt), '{}'::jsonb) INTO v_tiers FROM (SELECT (traits->>'tier') AS tier, count(*)::int AS cnt FROM public.nft_items WHERE owner_user_id = v_user AND (traits->>'tier') IS NOT NULL GROUP BY 1) t;
  SELECT COALESCE(SUM(camly_burned), 0)::int INTO v_today_burn FROM public.light_forge_log WHERE user_id = v_user AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh');
  RETURN jsonb_build_object('ok', true, 'recipes', v_recipes, 'tier_counts', v_tiers, 'today_burn', v_today_burn, 'daily_cap', 30000);
END;
$fn$;
REVOKE ALL ON FUNCTION public.forge_get_my_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forge_get_my_state() TO authenticated;