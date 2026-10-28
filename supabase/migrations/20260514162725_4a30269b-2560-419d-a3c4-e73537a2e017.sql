CREATE OR REPLACE FUNCTION public.retry_nft_mint(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_qid uuid;
  v_status text;
  v_attempts int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT owner_user_id INTO v_owner FROM public.nft_items WHERE id = p_item_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'nft_not_found';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'not_owner';
  END IF;

  SELECT id, status, attempts INTO v_qid, v_status, v_attempts
  FROM public.nft_mint_queue WHERE item_id = p_item_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_qid IS NULL THEN
    RAISE EXCEPTION 'queue_not_found';
  END IF;
  IF v_status <> 'failed' THEN
    RAISE EXCEPTION 'not_failed_status';
  END IF;
  IF v_attempts >= 10 THEN
    RAISE EXCEPTION 'max_retries_reached';
  END IF;

  UPDATE public.nft_mint_queue
     SET status = 'queued',
         last_error = NULL,
         updated_at = now()
   WHERE id = v_qid;

  RETURN jsonb_build_object('ok', true, 'queue_id', v_qid, 'attempts', v_attempts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_nft_mint(uuid) TO authenticated;