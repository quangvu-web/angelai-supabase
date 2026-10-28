
-- Allow admins to view all mint allocations
CREATE POLICY "Admins can view all allocations"
ON public.pplp_mint_allocations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all features_user_day
CREATE POLICY "Admins can view all features"
ON public.features_user_day
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
