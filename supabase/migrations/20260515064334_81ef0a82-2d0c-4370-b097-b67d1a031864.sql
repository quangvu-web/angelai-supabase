CREATE OR REPLACE FUNCTION public.retry_nft_mint(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_queue_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_item FROM public.nft_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;
  IF v_item.owner_user_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_item.mint_status NOT IN ('failed') THEN
    RAISE EXCEPTION 'not_retryable';
  END IF;

  -- Reset item về simulated để pipeline có thể pick lại
  UPDATE public.nft_items
     SET mint_status = 'simulated', tx_hash = NULL
   WHERE id = p_item_id;

  -- Reset / re-enqueue queue row
  UPDATE public.nft_mint_queue
     SET status = 'pending', last_error = NULL, updated_at = now()
   WHERE item_id = p_item_id
   RETURNING id INTO v_queue_id;

  IF v_queue_id IS NULL THEN
    INSERT INTO public.nft_mint_queue(item_id, status)
    VALUES (p_item_id, 'pending')
    RETURNING id INTO v_queue_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'queue_id', v_queue_id,
    'new_status', 'simulated'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_nft_mint(uuid) TO authenticated;