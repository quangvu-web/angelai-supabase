CREATE POLICY "teammates view claims" ON public.treasure_jackpot_claims
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.treasure_team_members me
    JOIN public.treasure_teams t ON t.id = me.team_id
    JOIN public.treasure_team_members other ON other.team_id = t.id
    WHERE me.user_id = auth.uid()
      AND t.event_id = treasure_jackpot_claims.event_id
      AND other.user_id = treasure_jackpot_claims.user_id
  )
);