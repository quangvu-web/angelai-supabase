
-- ===== PART 1: Lock function search_path =====
ALTER FUNCTION public.compute_light_tier(numeric) SET search_path = public;
ALTER FUNCTION public.compute_policy_hash(jsonb) SET search_path = public;
ALTER FUNCTION public.validate_mint_request_recipient() SET search_path = public;

-- ===== PART 2: Tighten "always true" RLS policies =====

-- epoch_snapshots
DROP POLICY IF EXISTS "Service role manages epoch snapshots" ON public.epoch_snapshots;
CREATE POLICY "Service role manages epoch snapshots"
ON public.epoch_snapshots FOR ALL TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- inflation_health_metrics
DROP POLICY IF EXISTS "Service role manages health metrics" ON public.inflation_health_metrics;
CREATE POLICY "Service role manages health metrics"
ON public.inflation_health_metrics FOR ALL TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- pplp_events
DROP POLICY IF EXISTS "Service role can insert events" ON public.pplp_events;
CREATE POLICY "Service role can insert events"
ON public.pplp_events FOR INSERT TO public
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- pplp_parameter_config
DROP POLICY IF EXISTS "Only service role can manage parameters" ON public.pplp_parameter_config;
CREATE POLICY "Only service role can manage parameters"
ON public.pplp_parameter_config FOR ALL TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- profile_view_events: require authenticated user to log a view
DROP POLICY IF EXISTS "Anyone can insert view events" ON public.profile_view_events;
CREATE POLICY "Authenticated users can insert view events"
ON public.profile_view_events FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- trust_history
DROP POLICY IF EXISTS "System insert trust history" ON public.trust_history;
CREATE POLICY "System insert trust history"
ON public.trust_history FOR INSERT TO public
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- user_dimension_scores
DROP POLICY IF EXISTS "Service role can manage dimension scores" ON public.user_dimension_scores;
CREATE POLICY "Service role can manage dimension scores"
ON public.user_dimension_scores FOR ALL TO public
USING ((auth.jwt() ->> 'role') = 'service_role')
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');
