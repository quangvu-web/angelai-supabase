-- Fix corrupted multisig_completed_groups: normalize to lowercase and deduplicate
-- Step 1: Fix requests with uppercase duplicates like [WILL, will, wisdom] → [will, wisdom]
UPDATE pplp_mint_requests
SET multisig_completed_groups = (
  SELECT array_agg(DISTINCT lower(g))
  FROM unnest(multisig_completed_groups) AS g
),
updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM unnest(multisig_completed_groups) AS g WHERE g != lower(g)
);

-- Step 2: Fix status for requests that show 'signing' but actually have all 3 groups
UPDATE pplp_mint_requests
SET status = 'signed', updated_at = now()
WHERE status = 'signing'
AND (
  SELECT count(DISTINCT lower(g))
  FROM unnest(multisig_completed_groups) AS g
) >= 3
AND multisig_signatures ? 'will'
AND multisig_signatures ? 'wisdom'
AND multisig_signatures ? 'love';