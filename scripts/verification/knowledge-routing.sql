-- Run through the authorized database query tool; all fixtures roll back.
BEGIN;
DO $test$
DECLARE
  doc_id uuid := gen_random_uuid();
  alias_id uuid := gen_random_uuid();
  unknown_id uuid := gen_random_uuid();
  actual_id uuid;
  original_content text := 'Routing verification only: nội dung không bị thay đổi.';
  stored_content text;
  stored_status text;
  chunks_before bigint;
BEGIN
  SELECT count(*) INTO chunks_before FROM public.knowledge_chunks;
  IF public.canonical_knowledge_folder_name('SÁCH URANTIA') IS DISTINCT FROM 'Sách Urantia' THEN
    RAISE EXCEPTION 'Canonical name rule failed';
  END IF;
  IF public.canonical_knowledge_folder_name('Du hành vũ trụ') IS DISTINCT FROM 'Các bài dẫn thiền' THEN
    RAISE EXCEPTION 'Approved alias rule failed';
  END IF;
  IF public.canonical_knowledge_folder_name('Unknown Telegram source') IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown name must not be guessed';
  END IF;

  INSERT INTO public.knowledge_documents(id,title,file_name,file_url,file_type,file_size,extracted_content,ingest_status)
  VALUES(doc_id,'FATHER INSIDE & FATHER PARADISE CÙNG CHUNG MỘT HƯỚNG','routing-test.txt','test://routing','text/plain',64,original_content,'pending')
  RETURNING folder_id,extracted_content INTO actual_id,stored_content;
  IF actual_id IS DISTINCT FROM (SELECT id FROM public.knowledge_folders WHERE name='Các tài liệu khác') THEN
    RAISE EXCEPTION 'Missing selection must use default, not infer from title';
  END IF;
  IF stored_content IS DISTINCT FROM original_content THEN RAISE EXCEPTION 'Content changed'; END IF;

  INSERT INTO public.knowledge_folders(id,name) VALUES(alias_id,'Du hành vũ trụ');
  INSERT INTO public.knowledge_documents(title,file_name,file_url,file_type,file_size,folder_id)
  VALUES('Routing alias test','routing-test.txt','test://routing','text/plain',64,alias_id)
  RETURNING folder_id INTO actual_id;
  IF actual_id IS DISTINCT FROM (SELECT id FROM public.knowledge_folders WHERE name='Các bài dẫn thiền') THEN
    RAISE EXCEPTION 'Alias folder must route into canonical destination';
  END IF;

  INSERT INTO public.knowledge_folders(id,name) VALUES(unknown_id,'Routing verification unknown folder');
  INSERT INTO public.knowledge_documents(title,file_name,file_url,file_type,file_size,folder_id)
  VALUES('FUN Money test','routing-test.txt','test://routing','text/plain',64,unknown_id)
  RETURNING folder_id INTO actual_id;
  IF actual_id IS DISTINCT FROM unknown_id THEN RAISE EXCEPTION 'Unknown explicit folder changed'; END IF;

  INSERT INTO public.knowledge_documents(title,file_name,file_url,file_type,file_size,source)
  VALUES('Source routing test','routing-test.txt','test://routing','text/plain',64,'fun_profile')
  RETURNING folder_id INTO actual_id;
  IF actual_id IS DISTINCT FROM (SELECT id FROM public.knowledge_folders WHERE name='FUN Profile') THEN
    RAISE EXCEPTION 'Existing source routing not respected';
  END IF;

  UPDATE public.knowledge_documents SET folder_id=unknown_id WHERE id=doc_id
  RETURNING folder_id,extracted_content,ingest_status INTO actual_id,stored_content,stored_status;
  IF actual_id IS DISTINCT FROM unknown_id OR stored_content IS DISTINCT FROM original_content OR stored_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Insert-only routing must not interfere with later manual moves';
  END IF;
  IF (SELECT count(*) FROM public.knowledge_chunks) <> chunks_before THEN RAISE EXCEPTION 'Existing chunks changed'; END IF;
  RAISE NOTICE 'PASS: canonical names, aliases, no guessing, default/source routing, insert-only, content/chunk preservation';
END;
$test$;
ROLLBACK;
