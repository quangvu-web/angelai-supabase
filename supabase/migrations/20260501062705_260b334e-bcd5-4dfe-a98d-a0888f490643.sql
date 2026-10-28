
-- ============================================================
-- HOTFIX A: Backfill features_user_day.daily_light_score for April 2026
-- from pplp_scores aggregates (per user, per day).
-- Idempotent: only updates rows where existing score < pplp aggregate.
-- ============================================================

WITH april_agg AS (
  SELECT a.actor_id AS user_id,
         (a.created_at AT TIME ZONE 'UTC')::date AS d,
         SUM(s.final_reward)::numeric AS reward_sum
  FROM public.pplp_scores s
  JOIN public.pplp_actions a ON a.id = s.action_id
  WHERE a.created_at >= '2026-04-01' AND a.created_at < '2026-05-01'
    AND s.final_reward IS NOT NULL AND s.final_reward > 0
  GROUP BY 1, 2
)
INSERT INTO public.features_user_day (user_id, date, daily_light_score, updated_at)
SELECT ag.user_id, ag.d, ag.reward_sum, now()
FROM april_agg ag
ON CONFLICT (user_id, date) DO UPDATE
SET daily_light_score = GREATEST(
      COALESCE(public.features_user_day.daily_light_score, 0),
      EXCLUDED.daily_light_score
    ),
    updated_at = now();

-- ============================================================
-- ROOT-CAUSE FIX B: compute_epoch_light_score uses SSoT
-- For each day in epoch, take MAX(features_user_day.daily_light_score,
-- SUM(pplp_scores.final_reward) for that day).
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_epoch_light_score(
  _user_id uuid, _epoch_start date, _epoch_end date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total NUMERIC;
BEGIN
  WITH fud AS (
    SELECT date AS d, COALESCE(daily_light_score, 0) AS s
    FROM features_user_day
    WHERE user_id = _user_id
      AND date >= _epoch_start AND date <= _epoch_end
  ),
  scored AS (
    SELECT (a.created_at AT TIME ZONE 'UTC')::date AS d,
           SUM(COALESCE(s.final_reward, 0))::numeric AS s
    FROM pplp_scores s
    JOIN pplp_actions a ON a.id = s.action_id
    WHERE a.actor_id = _user_id
      AND a.created_at >= _epoch_start::timestamptz
      AND a.created_at <  (_epoch_end + INTERVAL '1 day')::timestamptz
    GROUP BY 1
  ),
  merged AS (
    SELECT d, s FROM fud
    UNION ALL
    SELECT d, s FROM scored
  )
  SELECT COALESCE(SUM(per_day_max), 0) INTO v_total
  FROM (
    SELECT d, MAX(s) AS per_day_max
    FROM merged
    GROUP BY d
  ) x;

  RETURN ROUND(v_total, 4);
END;
$function$;
