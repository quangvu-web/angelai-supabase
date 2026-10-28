
-- Fix March 2026 epoch
UPDATE mint_epochs 
SET mint_pool_amount = 5000000, updated_at = now() 
WHERE epoch_label = '2026-03' AND mint_pool_amount = 0;

-- Recalculate March mint_allocations
WITH epoch_info AS (
  SELECT id FROM mint_epochs WHERE epoch_label = '2026-03'
),
total_eligible AS (
  SELECT SUM(light_score) as total_light
  FROM mint_allocations 
  WHERE epoch_id = (SELECT id FROM epoch_info) AND eligible = true AND light_score >= 10
),
new_values AS (
  SELECT ma.id,
    CASE 
      WHEN NOT ma.eligible OR ma.light_score < 10 THEN 0
      WHEN (ma.light_score / te.total_light) * 5000000 > 150000 THEN 150000
      ELSE ROUND((ma.light_score / te.total_light) * 5000000 / 100) * 100
    END as new_amount,
    CASE 
      WHEN NOT ma.eligible THEN 0
      ELSE ROUND((ma.light_score / te.total_light)::numeric, 4)
    END as new_ratio
  FROM mint_allocations ma
  CROSS JOIN total_eligible te
  WHERE ma.epoch_id = (SELECT id FROM epoch_info)
)
UPDATE mint_allocations ma
SET allocation_amount = nv.new_amount,
    contribution_ratio = nv.new_ratio
FROM new_values nv
WHERE ma.id = nv.id;

-- Fix April cycle
UPDATE pplp_mint_cycles 
SET total_mint_pool = 5000000, max_share_per_user = 0.03, updated_at = now()
WHERE cycle_number = 2 AND status = 'open';
