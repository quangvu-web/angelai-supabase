ALTER FUNCTION public.reveal_box_ticket(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.issue_sbt(uuid, text, text, text, text, numeric, jsonb) SET search_path = public, extensions;
ALTER FUNCTION public.compute_dib_vault_hashes(uuid) SET search_path = public, extensions;