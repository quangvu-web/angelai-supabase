
-- Phần A.1 + A.3: mở rộng knowledge_ingest_audit + auto-flag low_content Google Doc

ALTER TABLE public.knowledge_ingest_audit
  ADD COLUMN IF NOT EXISTS created_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_content_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.knowledge_ingest_audit.created_count IS 'Số doc INSERT mới trong request';
COMMENT ON COLUMN public.knowledge_ingest_audit.updated_count IS 'Số doc UPDATE (content_hash đổi)';
COMMENT ON COLUMN public.knowledge_ingest_audit.duplicate_count IS 'Bỏ qua vì trùng content_hash (cùng hoặc khác source_ref)';
COMMENT ON COLUMN public.knowledge_ingest_audit.skipped_count IS 'Bỏ qua vì low_quality / paused / role';
COMMENT ON COLUMN public.knowledge_ingest_audit.low_content_count IS 'Doc lưu OK nhưng content < 500 ký tự (nghi bị fetch thiếu)';

-- A.3: trigger cảnh báo low_content cho Google Doc
CREATE OR REPLACE FUNCTION public.fn_flag_low_content_gdoc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clen integer;
BEGIN
  IF NEW.source = 'google_doc' THEN
    clen := COALESCE(char_length(NEW.extracted_content), 0);
    IF clen > 0 AND clen < 500 THEN
      -- gắn tag vào metadata
      NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
        || jsonb_build_object(
             'low_content', true,
             'low_content_len', clen,
             'low_content_flagged_at', now()
           );
      -- báo vào rag_health_events (best-effort)
      BEGIN
        INSERT INTO public.rag_health_events(status, detail)
        VALUES (
          'low_content_gdoc',
          jsonb_build_object(
            'document_id', NEW.id,
            'source_ref', NEW.source_ref,
            'title', LEFT(COALESCE(NEW.title, ''), 200),
            'content_length', clen,
            'threshold', 500
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_low_content_gdoc_ins ON public.knowledge_documents;
CREATE TRIGGER trg_flag_low_content_gdoc_ins
  BEFORE INSERT ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_flag_low_content_gdoc();

DROP TRIGGER IF EXISTS trg_flag_low_content_gdoc_upd ON public.knowledge_documents;
CREATE TRIGGER trg_flag_low_content_gdoc_upd
  BEFORE UPDATE OF extracted_content, source ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_flag_low_content_gdoc();
