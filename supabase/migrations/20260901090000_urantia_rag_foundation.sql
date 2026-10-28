-- Phase 1A.2: additive and rerunnable Urantia RAG foundation.
CREATE TABLE IF NOT EXISTS public.knowledge_collections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), corpus text NOT NULL, language text NOT NULL, edition text NOT NULL, source_version text NOT NULL,
 version_status text NOT NULL DEFAULT 'draft' CHECK(version_status IN('draft','parsing','parsed','embedding','evaluating','ready','active','failed','archived')),
 is_active boolean NOT NULL DEFAULT false, activated_at timestamptz, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(corpus,language,edition,source_version));
CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_collections_one_active ON public.knowledge_collections(corpus,language,edition) WHERE is_active;
CREATE TABLE IF NOT EXISTS public.knowledge_ingestion_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid NOT NULL REFERENCES public.knowledge_collections(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','parsing','parsed','embedding','evaluating','ready','failed','cancelled')),
 retry_count integer NOT NULL DEFAULT 0 CHECK(retry_count BETWEEN 0 AND 3), checkpoint jsonb NOT NULL DEFAULT '{}', manifest jsonb NOT NULL DEFAULT '{}',
 safe_error_code text, started_at timestamptz, completed_at timestamptz, created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.knowledge_collection_evaluations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid NOT NULL REFERENCES public.knowledge_collections(id),
 evaluation_type text NOT NULL CHECK(evaluation_type IN('completeness','citation','retrieval','security')), status text NOT NULL CHECK(status IN('passed','failed')),
 evidence_hash text NOT NULL CHECK(length(evidence_hash)>=32), evaluator_version text NOT NULL, evaluated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(collection_id,evaluation_type));
CREATE TABLE IF NOT EXISTS public.knowledge_collection_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid, collection_id uuid,
 action text NOT NULL CHECK(action IN('activation_attempted','activation_rejected','activation_succeeded','rollback_attempted','rollback_failed','rollback_succeeded')),
 reason_code text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.knowledge_documents ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.knowledge_collections(id), ADD COLUMN IF NOT EXISTS part_number integer,
 ADD COLUMN IF NOT EXISTS paper_number integer, ADD COLUMN IF NOT EXISTS paper_title text, ADD COLUMN IF NOT EXISTS source_name text, ADD COLUMN IF NOT EXISTS source_uri text,
 ADD COLUMN IF NOT EXISTS source_hash text, ADD COLUMN IF NOT EXISTS source_version text, ADD COLUMN IF NOT EXISTS ingestion_batch_id uuid REFERENCES public.knowledge_ingestion_batches(id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_urantia_paper ON public.knowledge_documents(collection_id,paper_number) WHERE collection_id IS NOT NULL AND paper_number IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_source_hash ON public.knowledge_documents(collection_id,source_hash) WHERE collection_id IS NOT NULL AND source_hash IS NOT NULL AND deleted_at IS NULL;
ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS section_number integer, ADD COLUMN IF NOT EXISTS section_title text, ADD COLUMN IF NOT EXISTS paragraph_start text,
 ADD COLUMN IF NOT EXISTS paragraph_end text, ADD COLUMN IF NOT EXISTS paragraph_ids text[] NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS chunk_content_hash text,
 ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES public.knowledge_collections(id), ADD COLUMN IF NOT EXISTS staging_status text NOT NULL DEFAULT 'active';
CREATE UNIQUE INDEX IF NOT EXISTS ux_knowledge_chunk_version_hash ON public.knowledge_chunks(document_id,version_id,chunk_content_hash) WHERE version_id IS NOT NULL AND chunk_content_hash IS NOT NULL;
ALTER TABLE public.knowledge_collections ENABLE ROW LEVEL SECURITY; ALTER TABLE public.knowledge_ingestion_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_collection_evaluations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.knowledge_collection_audit ENABLE ROW LEVEL SECURITY;
DO $policy$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='knowledge_collections' AND policyname='admins read knowledge collections') THEN CREATE POLICY "admins read knowledge collections" ON public.knowledge_collections FOR SELECT TO authenticated USING(public.is_admin()); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='knowledge_ingestion_batches' AND policyname='admins read knowledge batches') THEN CREATE POLICY "admins read knowledge batches" ON public.knowledge_ingestion_batches FOR SELECT TO authenticated USING(public.is_admin()); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='knowledge_collection_evaluations' AND policyname='admins read server evaluations') THEN CREATE POLICY "admins read server evaluations" ON public.knowledge_collection_evaluations FOR SELECT TO authenticated USING(public.is_admin()); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='knowledge_collection_audit' AND policyname='admins read knowledge audit') THEN CREATE POLICY "admins read knowledge audit" ON public.knowledge_collection_audit FOR SELECT TO authenticated USING(public.is_admin()); END IF;
END $policy$;
UPDATE storage.buckets SET public=false WHERE id='knowledge-documents';
REVOKE ALL ON public.knowledge_collections,public.knowledge_ingestion_batches,public.knowledge_collection_evaluations,public.knowledge_collection_audit FROM PUBLIC,anon,authenticated;
REVOKE SELECT ON public.knowledge_documents,public.knowledge_chunks FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.knowledge_collections,public.knowledge_ingestion_batches,public.knowledge_collection_evaluations,public.knowledge_collection_audit TO service_role;
GRANT SELECT ON public.knowledge_documents,public.knowledge_chunks TO service_role;

CREATE OR REPLACE FUNCTION public.activate_knowledge_collection(_collection_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE t public.knowledge_collections; actor uuid:=auth.uid(); code text; n integer;
BEGIN
 IF actor IS NULL OR NOT public.is_admin() THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_ADMIN'); END IF;
 INSERT INTO public.knowledge_collection_audit(actor_id,collection_id,action,reason_code) VALUES(actor,_collection_id,'activation_attempted','REQUESTED');
 SELECT * INTO t FROM public.knowledge_collections WHERE id=_collection_id FOR UPDATE;
 IF t.id IS NULL THEN code:='COLLECTION_NOT_FOUND'; ELSIF t.corpus<>'urantia' THEN code:='INVALID_CORPUS'; ELSIF t.version_status NOT IN('ready','archived') THEN code:='COLLECTION_NOT_READY'; ELSE
  PERFORM pg_advisory_xact_lock(hashtextextended(t.corpus||':'||t.language||':'||t.edition,0));
  SELECT count(*) INTO n FROM public.knowledge_documents d WHERE d.collection_id=t.id AND d.deleted_at IS NULL;
  IF n<>197 THEN code:='DOCUMENT_COUNT_INVALID'; END IF;
  IF code IS NULL AND (SELECT count(*) FROM public.knowledge_documents d WHERE d.collection_id=t.id AND d.deleted_at IS NULL AND d.paper_number=0)<>1 THEN code:='FOREWORD_MISSING'; END IF;
  IF code IS NULL AND (SELECT count(DISTINCT d.paper_number) FROM public.knowledge_documents d WHERE d.collection_id=t.id AND d.deleted_at IS NULL AND d.paper_number BETWEEN 1 AND 196)<>196 THEN code:='PAPER_SET_INCOMPLETE'; END IF;
  IF code IS NULL AND EXISTS(SELECT 1 FROM public.knowledge_documents d WHERE d.collection_id=t.id AND d.deleted_at IS NULL AND(d.ingest_status<>'ready' OR d.paper_number IS NULL OR d.source_hash IS NULL OR d.content_hash IS NULL)) THEN code:='DOCUMENT_INVALID'; END IF;
  IF code IS NULL AND (NOT EXISTS(SELECT 1 FROM public.knowledge_chunks c WHERE c.version_id=t.id) OR EXISTS(SELECT 1 FROM public.knowledge_chunks c WHERE c.version_id=t.id AND(c.staging_status<>'active' OR c.paragraph_start IS NULL OR c.paragraph_end IS NULL OR cardinality(c.paragraph_ids)=0 OR c.chunk_content_hash IS NULL))) THEN code:='CHUNK_INVALID'; END IF;
  IF code IS NULL AND EXISTS(SELECT 1 FROM public.knowledge_documents d WHERE d.collection_id=t.id AND d.deleted_at IS NULL GROUP BY d.source_hash HAVING count(*)>1) THEN code:='DUPLICATE_SOURCE_HASH'; END IF;
  IF code IS NULL AND EXISTS(SELECT 1 FROM public.knowledge_documents d WHERE d.collection_id=t.id AND d.deleted_at IS NULL GROUP BY d.content_hash HAVING count(*)>1) THEN code:='DUPLICATE_DOCUMENT_HASH'; END IF;
  IF code IS NULL AND EXISTS(SELECT 1 FROM public.knowledge_chunks c WHERE c.version_id=t.id GROUP BY c.chunk_content_hash HAVING count(*)>1) THEN code:='DUPLICATE_CHUNK_HASH'; END IF;
  IF code IS NULL AND (SELECT count(*) FROM public.knowledge_collection_evaluations e WHERE e.collection_id=t.id AND e.status='passed' AND e.evaluation_type IN('completeness','citation','retrieval','security') AND length(e.evidence_hash)>=32)<>4 THEN code:='EVALUATION_GATE_FAILED'; END IF;
 END IF;
 IF code IS NOT NULL THEN INSERT INTO public.knowledge_collection_audit(actor_id,collection_id,action,reason_code) VALUES(actor,t.id,'activation_rejected',code); RETURN jsonb_build_object('ok',false,'error_code',code); END IF;
 UPDATE public.knowledge_collections SET is_active=false,version_status='archived',updated_at=now() WHERE corpus=t.corpus AND language=t.language AND edition=t.edition AND is_active;
 UPDATE public.knowledge_collections SET is_active=true,version_status='active',activated_at=now(),updated_at=now() WHERE id=t.id;
 INSERT INTO public.knowledge_collection_audit(actor_id,collection_id,action,reason_code) VALUES(actor,t.id,'activation_succeeded','ACTIVATED'); RETURN jsonb_build_object('ok',true,'collection_id',t.id);
EXCEPTION WHEN OTHERS THEN INSERT INTO public.knowledge_collection_audit(actor_id,collection_id,action,reason_code) VALUES(actor,_collection_id,'activation_rejected','INTERNAL_ERROR'); RETURN jsonb_build_object('ok',false,'error_code','INTERNAL_ERROR'); END $fn$;
REVOKE ALL ON FUNCTION public.activate_knowledge_collection(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.activate_knowledge_collection(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.rollback_knowledge_collection(_previous_collection_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE actor uuid:=auth.uid(); result jsonb; BEGIN
 IF actor IS NULL OR NOT public.is_admin() THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_ADMIN'); END IF;
 INSERT INTO public.knowledge_collection_audit(actor_id,collection_id,action,reason_code) VALUES(actor,_previous_collection_id,'rollback_attempted','REQUESTED');
 result:=public.activate_knowledge_collection(_previous_collection_id);
 INSERT INTO public.knowledge_collection_audit(actor_id,collection_id,action,reason_code) VALUES(actor,_previous_collection_id,CASE WHEN(result->>'ok')::boolean THEN 'rollback_succeeded' ELSE 'rollback_failed' END,COALESCE(result->>'error_code','ROLLED_BACK')); RETURN result; END $fn$;
REVOKE ALL ON FUNCTION public.rollback_knowledge_collection(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.rollback_knowledge_collection(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_list_urantia_collections() RETURNS SETOF public.knowledge_collections LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$ BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF; RETURN QUERY SELECT * FROM public.knowledge_collections WHERE corpus='urantia' ORDER BY created_at DESC; END $fn$;
REVOKE ALL ON FUNCTION public.admin_list_urantia_collections() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.admin_list_urantia_collections() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.admin_list_urantia_batches() RETURNS SETOF public.knowledge_ingestion_batches LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $fn$ BEGIN IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF; RETURN QUERY SELECT * FROM public.knowledge_ingestion_batches ORDER BY created_at DESC LIMIT 20; END $fn$;
REVOKE ALL ON FUNCTION public.admin_list_urantia_batches() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.admin_list_urantia_batches() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.match_urantia_chunks(query_embedding vector,query_text text,requested_language text,match_count integer DEFAULT 8,min_similarity double precision DEFAULT .30)
RETURNS TABLE(chunk_id uuid,document_id uuid,version_id uuid,chunk_text text,similarity double precision,corpus text,language text,edition text,source_version text,part_number integer,paper_number integer,paper_title text,section_number integer,section_title text,paragraph_start text,paragraph_end text,paragraph_ids text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $fn$ SELECT c.id,c.document_id,c.version_id,c.chunk_text,1-(c.embedding<=>query_embedding),k.corpus,k.language,k.edition,k.source_version,d.part_number,d.paper_number,d.paper_title,c.section_number,c.section_title,c.paragraph_start,c.paragraph_end,c.paragraph_ids FROM public.knowledge_chunks c JOIN public.knowledge_documents d ON d.id=c.document_id JOIN public.knowledge_collections k ON k.id=c.version_id WHERE k.corpus='urantia' AND k.language=requested_language AND k.is_active AND k.version_status='active' AND d.deleted_at IS NULL AND d.ingest_status='ready' AND d.knowledge_status='active' AND c.staging_status='active' AND c.embedding IS NOT NULL AND c.paragraph_start IS NOT NULL AND c.paragraph_end IS NOT NULL AND cardinality(c.paragraph_ids)>0 AND 1-(c.embedding<=>query_embedding)>=min_similarity ORDER BY c.embedding<=>query_embedding LIMIT match_count $fn$;
REVOKE ALL ON FUNCTION public.match_urantia_chunks(vector,text,text,integer,double precision) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.match_urantia_chunks(vector,text,text,integer,double precision) TO service_role;
REVOKE EXECUTE ON FUNCTION public.match_knowledge_hybrid(vector,text,integer,double precision) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.match_knowledge_hybrid(vector,text,integer,double precision) TO service_role;
