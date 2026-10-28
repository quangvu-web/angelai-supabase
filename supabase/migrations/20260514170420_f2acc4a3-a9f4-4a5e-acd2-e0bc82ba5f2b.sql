ALTER TABLE public.treasure_jackpot_claims REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.treasure_jackpot_claims;