REVOKE EXECUTE ON FUNCTION public.claim_connector_slot(UUID,TEXT,UUID,TEXT,TEXT,INT,TEXT,NUMERIC,BIGINT,INT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_connector_slot(UUID,TEXT,UUID,TEXT,TEXT,INT,TEXT,NUMERIC,BIGINT,INT,TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_connector_window() FROM PUBLIC, anon, authenticated;