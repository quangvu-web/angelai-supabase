WITH season AS (
  SELECT id FROM public.game_seasons WHERE name = 'Cosmic Summer 2026' LIMIT 1
)
UPDATE public.season_pass_rewards r
SET reward_value = jsonb_set(
  r.reward_value,
  '{amount}',
  to_jsonb(
    ROUND(
      (20000 + (30000 - 20000) * (r.level - 1) / 28.0) / 100.0
    )::int * 100
  )
)
FROM season
WHERE r.season_id = season.id
  AND r.track = 'free'
  AND r.reward_type = 'camly';