DO $$
DECLARE
  v_g_delta bigint := 0;
  v_p_delta bigint := 0;
  v_pa_delta bigint := 0;
  v_cnt int := 0;
BEGIN
  WITH may AS (
    SELECT id, user_amount,
      ROUND(user_amount * 10000.0 / 9900.0)::bigint AS new_total
    FROM fun_distribution_logs
    WHERE created_at >= '2026-05-01' AND created_at < '2026-06-01'
  ),
  calc AS (
    SELECT m.id, m.user_amount,
      l.genesis_amount AS old_g, l.platform_amount AS old_p, l.partners_amount AS old_pa,
      m.new_total,
      FLOOR((m.new_total - m.user_amount)/3.0)::bigint AS new_g,
      FLOOR((m.new_total - m.user_amount)/3.0)::bigint AS new_pa,
      (m.new_total - m.user_amount) - 2*FLOOR((m.new_total - m.user_amount)/3.0)::bigint AS new_p
    FROM may m
    JOIN fun_distribution_logs l ON l.id = m.id
  ),
  upd AS (
    UPDATE fun_distribution_logs l
    SET total_reward = c.new_total,
        genesis_amount = c.new_g,
        platform_amount = c.new_p,
        partners_amount = c.new_pa,
        user_percentage = 99.0,
        genesis_percentage = ROUND(c.new_g::numeric / NULLIF(c.new_total,0) * 100, 4),
        platform_percentage = ROUND(c.new_p::numeric / NULLIF(c.new_total,0) * 100, 4),
        partners_percentage = ROUND(c.new_pa::numeric / NULLIF(c.new_total,0) * 100, 4)
    FROM calc c
    WHERE l.id = c.id
    RETURNING c.old_g - c.new_g AS dg, c.old_p - c.new_p AS dp, c.old_pa - c.new_pa AS dpa
  )
  SELECT COALESCE(SUM(dg),0), COALESCE(SUM(dp),0), COALESCE(SUM(dpa),0), COUNT(*)
    INTO v_g_delta, v_p_delta, v_pa_delta, v_cnt
  FROM upd;

  RAISE NOTICE 'Hotfix updated % logs. Deltas g=% p=% pa=%', v_cnt, v_g_delta, v_p_delta, v_pa_delta;

  UPDATE treasury_vaults SET balance = balance - v_g_delta, updated_at = now() WHERE vault_name = 'reward_reserve';
  UPDATE treasury_vaults SET balance = balance - v_p_delta, updated_at = now() WHERE vault_name = 'infrastructure';
  UPDATE treasury_vaults SET balance = balance - v_pa_delta, updated_at = now() WHERE vault_name = 'community_growth';
END $$;