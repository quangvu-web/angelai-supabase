
-- FIX 1: user_light_scores
DROP POLICY IF EXISTS "Service role can manage light scores" ON public.user_light_scores;
CREATE POLICY "Service role can manage light scores"
ON public.user_light_scores FOR ALL TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- FIX 2: features_user_day
DROP POLICY IF EXISTS "Service can manage features" ON public.features_user_day;
CREATE POLICY "Service can manage features"
ON public.features_user_day FOR ALL TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- FIX 3: score_explanations
DROP POLICY IF EXISTS "Service can manage explanations" ON public.score_explanations;
CREATE POLICY "Service can manage explanations"
ON public.score_explanations FOR ALL TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- FIX 4: light_score_ledger
DROP POLICY IF EXISTS "Service can manage ledger" ON public.light_score_ledger;
CREATE POLICY "Service can manage ledger"
ON public.light_score_ledger FOR ALL TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- FIX 5: circle_members - broken self-join
DROP POLICY IF EXISTS "Circle members can view members" ON public.circle_members;
CREATE POLICY "Circle members can view members"
ON public.circle_members FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.circle_members cm
    WHERE cm.circle_id = circle_members.circle_id
      AND cm.user_id = auth.uid()
  )
);

-- FIX 6: user_suspensions - drop public exposure (existing owner policy retained)
DROP POLICY IF EXISTS "Public can view active suspensions for leaderboard" ON public.user_suspensions;

-- FIX 7: coin_withdrawals
DROP POLICY IF EXISTS "Anyone can view completed withdrawals" ON public.coin_withdrawals;

-- FIX 8: lixi_claims
DROP POLICY IF EXISTS "Anyone can view completed lixi claims" ON public.lixi_claims;

-- FIX 9: user_wallet_addresses
DROP POLICY IF EXISTS "Authenticated users can view wallet addresses for gifting" ON public.user_wallet_addresses;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_wallet_addresses'
      AND policyname = 'Users can view their own wallet addresses'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own wallet addresses"
      ON public.user_wallet_addresses FOR SELECT TO authenticated
      USING (auth.uid() = user_id)';
  END IF;
END $$;

-- FIX 10: pplp_mint_requests
DROP POLICY IF EXISTS "Attester can update multisig signatures" ON public.pplp_mint_requests;
CREATE POLICY "Attester can update multisig signatures"
ON public.pplp_mint_requests FOR UPDATE TO authenticated
USING (
  status = ANY (ARRAY['pending_sig', 'signing'])
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  status = ANY (ARRAY['pending_sig', 'signing', 'signed'])
  AND auth.uid() IS NOT NULL
);
