-- Add mint destination choice to mint requests
ALTER TABLE public.pplp_mint_requests 
ADD COLUMN IF NOT EXISTS mint_destination text NOT NULL DEFAULT 'angel_ai',
ADD COLUMN IF NOT EXISTS destination_note text,
ADD COLUMN IF NOT EXISTS fun_profile_sync_status text DEFAULT 'pending';

-- Add comment for documentation
COMMENT ON COLUMN public.pplp_mint_requests.mint_destination IS 'angel_ai = mint trực tiếp on-chain qua Angel AI multisig, fun_profile = chuyển tiếp sang FUN Profile epoch mint';
COMMENT ON COLUMN public.pplp_mint_requests.destination_note IS 'Ghi chú theo dõi cho admin/user về lý do chọn cổng mint';
COMMENT ON COLUMN public.pplp_mint_requests.fun_profile_sync_status IS 'Trạng thái sync khi mint_destination = fun_profile: pending, synced, failed';