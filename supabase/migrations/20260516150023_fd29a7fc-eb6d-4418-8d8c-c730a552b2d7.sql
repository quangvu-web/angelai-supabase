CREATE OR REPLACE FUNCTION public.smoke_test_box_flow()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ticket uuid;
  v_reveal jsonb;
  v_grant_ok boolean := false;
  v_reveal_ok boolean := false;
  v_error text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Step 1: grant_box_ticket exercises extensions.gen_random_bytes
  BEGIN
    v_ticket := public.grant_box_ticket(v_uid, 'common', 'smoke_test', 'smoke-' || gen_random_uuid()::text);
    v_grant_ok := true;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'step', 'grant_box_ticket',
      'error', SQLERRM
    );
  END;

  -- Step 2: reveal_box_ticket exercises extensions.digest
  BEGIN
    v_reveal := public.reveal_box_ticket(v_ticket);
    v_reveal_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
  END;

  -- Cleanup: drop ephemeral inventory + ticket so test doesn't pollute user data
  DELETE FROM public.user_inventory WHERE source_ticket_id = v_ticket;
  DELETE FROM public.box_tickets WHERE id = v_ticket AND source = 'smoke_test';

  IF NOT v_reveal_ok THEN
    RETURN jsonb_build_object(
      'success', false,
      'step', 'reveal_box_ticket',
      'grant_ok', v_grant_ok,
      'error', v_error
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'grant_ok', v_grant_ok,
    'reveal_ok', v_reveal_ok,
    'reveal', v_reveal,
    'ticket_id', v_ticket,
    'checked_at', now()
  );
END;
$$;