-- 1) Trigger tự set metadata.authoritative = true cho tài liệu khớp mẫu "Tài khoản Fun.Rich chính thức của bé ..."
CREATE OR REPLACE FUNCTION public.fn_auto_flag_authoritative_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text := lower(unaccent(COALESCE(NEW.title, '')));
BEGIN
  -- Match: "tài khoản" + ("chính thức" hoặc "fun.rich" / "fun rich") — bao phủ mọi biến thể
  IF t ~ 'tai khoan' AND (t ~ 'chinh thuc' OR t ~ 'fun\.?\s*rich') THEN
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
                    || jsonb_build_object('authoritative', true, 'auth_reason', 'auto_official_account_pattern');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_auto_flag_authoritative ON public.knowledge_documents;
CREATE TRIGGER tg_auto_flag_authoritative
BEFORE INSERT OR UPDATE OF title, metadata
ON public.knowledge_documents
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_flag_authoritative_account();

-- 2) Backfill: chạy lại một lần cho các tài liệu cũ chưa được gắn nhãn
UPDATE public.knowledge_documents
SET metadata = COALESCE(metadata, '{}'::jsonb)
               || jsonb_build_object('authoritative', true, 'auth_reason', 'backfill_2026_07_27')
WHERE deleted_at IS NULL
  AND lower(unaccent(COALESCE(title, ''))) ~ 'tai khoan'
  AND (
        lower(unaccent(COALESCE(title, ''))) ~ 'chinh thuc'
     OR lower(unaccent(COALESCE(title, ''))) ~ 'fun\.?\s*rich'
      )
  AND COALESCE((metadata->>'authoritative')::boolean, false) = false;

-- 3) Gộp trùng lặp bé Angel Thành Tính: giữ bản Google Doc (id 53f6dc94..., 236 ký tự), ẩn bản Telegram (id 27006f38..., 220 ký tự)
UPDATE public.knowledge_documents
SET deleted_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb)
               || jsonb_build_object('deleted_reason', 'duplicate_of_53f6dc94-43c3-4db9-9304-dbeddd1a48cf', 'deleted_by', 'merge_2026_07_27')
WHERE id = '27006f38-2c8c-4801-b721-ed8424115fee'
  AND deleted_at IS NULL;

-- Xoá luôn chunks của bản bị ẩn để RAG không kéo lên
DELETE FROM public.knowledge_chunks
WHERE document_id = '27006f38-2c8c-4801-b721-ed8424115fee';