-- Add validation trigger to prevent zero address in mint requests
CREATE OR REPLACE FUNCTION public.validate_mint_request_recipient()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recipient_address IS NULL OR NEW.recipient_address = '0x0000000000000000000000000000000000000000' THEN
    RAISE EXCEPTION 'recipient_address cannot be zero address or null';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_mint_recipient
BEFORE INSERT OR UPDATE ON public.pplp_mint_requests
FOR EACH ROW
EXECUTE FUNCTION public.validate_mint_request_recipient();