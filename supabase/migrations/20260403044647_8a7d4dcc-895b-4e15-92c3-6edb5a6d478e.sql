
-- Fix trigger to only validate on INSERT or when recipient_address changes
CREATE OR REPLACE FUNCTION validate_mint_request_recipient()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.recipient_address IS DISTINCT FROM OLD.recipient_address THEN
    IF NEW.recipient_address IS NULL OR NEW.recipient_address = '0x0000000000000000000000000000000000000000' THEN
      RAISE EXCEPTION 'recipient_address cannot be zero address or null';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now fix the data: remove uppercase duplicates from multisig_completed_groups
UPDATE pplp_mint_requests
SET multisig_completed_groups = ARRAY(
  SELECT DISTINCT lower(g) FROM unnest(multisig_completed_groups) AS g
)
WHERE 'WILL' = ANY(multisig_completed_groups)
   OR 'WISDOM' = ANY(multisig_completed_groups)
   OR 'LOVE' = ANY(multisig_completed_groups);

-- Standardize multisig_required_groups to lowercase
UPDATE pplp_mint_requests
SET multisig_required_groups = ARRAY['will', 'wisdom', 'love']
WHERE multisig_required_groups @> ARRAY['WILL']
   OR multisig_required_groups @> ARRAY['WISDOM']
   OR multisig_required_groups @> ARRAY['LOVE'];

-- Remove uppercase keys from multisig_signatures jsonb
UPDATE pplp_mint_requests
SET multisig_signatures = multisig_signatures - 'WILL' - 'WISDOM' - 'LOVE'
WHERE multisig_signatures ? 'WILL'
   OR multisig_signatures ? 'WISDOM'
   OR multisig_signatures ? 'LOVE';
