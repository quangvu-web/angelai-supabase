-- EXTRA-HIGH-RISK inverse: separate explicit approval is mandatory. Do not run by default.
DO $guard$ BEGIN
 IF current_setting('app.target_environment',true)<>'preview' OR current_setting('app.public_access_rollback_approved',true)<>'yes' THEN
  RAISE EXCEPTION 'PUBLIC_ACCESS_ROLLBACK_PRECONDITION_FAILED';
 END IF;
END $guard$;
GRANT SELECT ON public.knowledge_documents,public.knowledge_chunks TO anon;
GRANT EXECUTE ON FUNCTION public.match_knowledge_hybrid(vector,text,integer,double precision) TO anon;
-- Storage remains private even in this separately approved rollback.
