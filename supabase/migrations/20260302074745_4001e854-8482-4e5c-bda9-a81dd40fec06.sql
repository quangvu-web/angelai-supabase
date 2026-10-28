ALTER TABLE pplp_mint_requests DROP CONSTRAINT pplp_mint_requests_status_check;
ALTER TABLE pplp_mint_requests ADD CONSTRAINT pplp_mint_requests_status_check 
  CHECK (status = ANY (ARRAY[
    'pending', 'pending_sig', 'signing', 'signed', 
    'submitted', 'confirmed', 'minted', 'expired', 'rejected', 'failed'
  ]));