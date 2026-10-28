
DROP VIEW IF EXISTS public.user_actions;
DROP VIEW IF EXISTS public.pplp_validations;

CREATE VIEW public.user_actions
  WITH (security_invoker = on)
  AS SELECT * FROM public.pplp_actions;

CREATE VIEW public.pplp_validations
  WITH (security_invoker = on)
  AS SELECT * FROM public.pplp_scores;
