
-- Re-apply with explicit search_path (fix linter warnings)
ALTER FUNCTION public.register_org_or_validator(text,text,text,text,text,text) SET search_path = public;
ALTER FUNCTION public.stake_for_validator(numeric) SET search_path = public;
ALTER FUNCTION public.unstake_validator(uuid) SET search_path = public;
ALTER FUNCTION public.get_org_by_did(text) SET search_path = public;
ALTER FUNCTION public.get_top_validators(integer) SET search_path = public;
