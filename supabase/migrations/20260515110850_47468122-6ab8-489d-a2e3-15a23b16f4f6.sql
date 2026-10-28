-- Phase 13 — Telegram Mini App audit + RPC
CREATE TABLE IF NOT EXISTS public.telegram_webapp_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  telegram_username text,
  fun_user_id uuid,
  action text NOT NULL,
  ok boolean NOT NULL DEFAULT true,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_webapp_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit admin only"
ON public.telegram_webapp_audit FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_tg_webapp_audit_tg_user ON public.telegram_webapp_audit(telegram_user_id, created_at DESC);

-- Quick summary RPC for the mini app (read-only, runs as service role from edge fn)
CREATE OR REPLACE FUNCTION public.get_telegram_webapp_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_streak record;
  v_quest_total int;
  v_quest_done int;
  v_box_unopened int;
  v_pet record;
  v_circle_id uuid;
BEGIN
  SELECT current_streak, longest_streak, multiplier
    INTO v_streak FROM public.user_quest_streaks WHERE user_id = p_user_id;

  SELECT count(*) FILTER (WHERE true), count(*) FILTER (WHERE status='claimed')
    INTO v_quest_total, v_quest_done
    FROM public.user_daily_quests
    WHERE user_id = p_user_id AND assigned_date = v_today;

  SELECT count(*) INTO v_box_unopened FROM public.box_tickets
    WHERE user_id = p_user_id AND status='unopened';

  SELECT name, level, xp, element INTO v_pet FROM public.pets WHERE user_id = p_user_id LIMIT 1;

  SELECT circle_id INTO v_circle_id FROM public.light_circle_members WHERE user_id = p_user_id LIMIT 1;

  RETURN jsonb_build_object(
    'streak', jsonb_build_object(
      'current', coalesce(v_streak.current_streak, 0),
      'longest', coalesce(v_streak.longest_streak, 0),
      'multiplier', coalesce(v_streak.multiplier, 1.0)
    ),
    'quest', jsonb_build_object('total', coalesce(v_quest_total,0), 'done', coalesce(v_quest_done,0)),
    'box_unopened', coalesce(v_box_unopened, 0),
    'pet', CASE WHEN v_pet.name IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_pet.name, 'level', v_pet.level, 'xp', v_pet.xp, 'element', v_pet.element
    ) END,
    'circle_id', v_circle_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_telegram_webapp_summary(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_telegram_webapp_summary(uuid) TO service_role;