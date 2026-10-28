-- SECURITY inverse only. Never use this for data/version rollback.
-- Run only after explicit approval against an identified PREVIEW project.
DO $guard$ BEGIN
 IF current_setting('app.target_environment',true)<>'preview' OR current_setting('app.phase1a2_rollback_approved',true)<>'yes' THEN
  RAISE EXCEPTION 'ROLLBACK_PRECONDITION_FAILED';
 END IF;
END $guard$;
-- Restore authenticated retrieval only. Data, columns, tables and policies remain intact.
GRANT SELECT ON public.knowledge_documents,public.knowledge_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_knowledge_hybrid(vector,text,integer,double precision) TO authenticated,service_role;
-- Anonymous/public restoration is deliberately separated below and the bucket remains private.
