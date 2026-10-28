
-- Error log for box functions
CREATE TABLE IF NOT EXISTS public.box_function_error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  user_id UUID,
  sqlstate TEXT,
  message TEXT NOT NULL,
  context JSONB,
  severity TEXT NOT NULL DEFAULT 'error',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bfel_created ON public.box_function_error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bfel_function ON public.box_function_error_log(function_name, created_at DESC);

ALTER TABLE public.box_function_error_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_box_err" ON public.box_function_error_log;
CREATE POLICY "admins_read_box_err" ON public.box_function_error_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Helper logger (SECURITY DEFINER so callers can insert regardless of RLS)
CREATE OR REPLACE FUNCTION public.log_box_function_error(
  p_function_name TEXT,
  p_user_id UUID,
  p_sqlstate TEXT,
  p_message TEXT,
  p_context JSONB DEFAULT NULL,
  p_severity TEXT DEFAULT 'error'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.box_function_error_log(function_name, user_id, sqlstate, message, context, severity)
  VALUES (p_function_name, p_user_id, p_sqlstate, p_message, p_context, p_severity);
  RAISE WARNING '[box_fn_error] %: % (sqlstate=%, user=%, ctx=%)',
    p_function_name, p_message, p_sqlstate, p_user_id, p_context;
EXCEPTION WHEN OTHERS THEN
  -- never let logging itself break the caller
  RAISE WARNING '[box_fn_error_log_failed] %: %', SQLSTATE, SQLERRM;
END;
$$;

-- Wrap grant_box_ticket
CREATE OR REPLACE FUNCTION public.grant_box_ticket(
  p_user_id uuid, p_tier_code text, p_source text, p_source_ref text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_id UUID;
  v_seed TEXT;
BEGIN
  BEGIN
    v_seed := encode(extensions.gen_random_bytes(16), 'hex');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_box_function_error('grant_box_ticket', p_user_id, SQLSTATE,
      'gen_random_bytes failed: ' || SQLERRM,
      jsonb_build_object('tier', p_tier_code, 'source', p_source, 'source_ref', p_source_ref, 'step', 'seed'),
      'critical');
    RAISE;
  END;

  BEGIN
    INSERT INTO public.box_tickets(user_id, tier_code, source, source_ref, server_seed)
    VALUES (p_user_id, p_tier_code, p_source, p_source_ref, v_seed)
    RETURNING id INTO v_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_box_function_error('grant_box_ticket', p_user_id, SQLSTATE,
      'insert box_tickets failed: ' || SQLERRM,
      jsonb_build_object('tier', p_tier_code, 'source', p_source, 'source_ref', p_source_ref, 'step', 'insert'),
      'error');
    RAISE;
  END;
  RETURN v_id;
END;
$function$;

-- Wrap reveal_box_ticket
CREATE OR REPLACE FUNCTION public.reveal_box_ticket(p_ticket_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_ticket RECORD;
  v_tier RECORD;
  v_user UUID;
  v_hash TEXT;
  v_roll NUMERIC;
  v_camly INT;
  v_nft_chance NUMERIC;
  v_inventory_id UUID;
  v_got_nft BOOLEAN := FALSE;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  SELECT * INTO v_ticket FROM public.box_tickets WHERE id = p_ticket_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF v_ticket.status <> 'unrevealed' THEN RAISE EXCEPTION 'ticket already %', v_ticket.status; END IF;
  IF v_ticket.expires_at < now() THEN
    UPDATE public.box_tickets SET status='expired' WHERE id=p_ticket_id;
    PERFORM public.log_box_function_error('reveal_box_ticket', v_user, 'P0001',
      'ticket expired',
      jsonb_build_object('ticket_id', p_ticket_id, 'tier', v_ticket.tier_code),
      'warning');
    RAISE EXCEPTION 'ticket expired';
  END IF;

  SELECT * INTO v_tier FROM public.box_tiers WHERE code = v_ticket.tier_code;

  BEGIN
    v_hash := encode(digest(v_ticket.server_seed || p_ticket_id::text || now()::text, 'sha256'), 'hex');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_box_function_error('reveal_box_ticket', v_user, SQLSTATE,
      'digest failed: ' || SQLERRM,
      jsonb_build_object('ticket_id', p_ticket_id, 'tier', v_ticket.tier_code, 'step', 'hash'),
      'critical');
    RAISE;
  END;

  v_roll := ('x' || substr(v_hash, 1, 8))::bit(32)::int::numeric / 4294967295.0;
  IF v_roll < 0 THEN v_roll := -v_roll; END IF;
  v_camly := v_tier.min_camly + floor(v_roll * (v_tier.max_camly - v_tier.min_camly + 1))::int;

  v_nft_chance := ('x' || substr(v_hash, 9, 8))::bit(32)::int::numeric / 4294967295.0;
  IF v_nft_chance < 0 THEN v_nft_chance := -v_nft_chance; END IF;

  IF v_nft_chance < v_tier.nft_chance THEN
    INSERT INTO public.user_inventory(user_id, item_type, item_name, rarity, source_ticket_id, metadata)
    VALUES (v_user, 'nft_skin', 'Light Spark — ' || v_tier.display_name, v_tier.code, p_ticket_id,
            jsonb_build_object('reveal_hash', v_hash, 'tier', v_tier.code))
    RETURNING id INTO v_inventory_id;
    v_got_nft := TRUE;
  END IF;

  BEGIN
    PERFORM public.add_camly_coins(v_user, v_camly::bigint, 'box_reveal'::coin_transaction_type,
      'Mystery Box ' || v_tier.display_name, NULL,
      jsonb_build_object('ticket_id', p_ticket_id, 'tier', v_tier.code, 'reveal_hash', v_hash));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_box_function_error('reveal_box_ticket', v_user, SQLSTATE,
      'add_camly_coins failed: ' || SQLERRM,
      jsonb_build_object('ticket_id', p_ticket_id, 'tier', v_tier.code, 'camly', v_camly, 'step', 'award_camly'),
      'error');
    RAISE;
  END;

  UPDATE public.box_tickets
     SET status='revealed', reveal_hash=v_hash, reward_camly=v_camly,
         reward_nft_id=v_inventory_id, revealed_at=now()
   WHERE id=p_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'tier', v_tier.code,
    'tier_name', v_tier.display_name,
    'camly', v_camly,
    'nft', v_got_nft,
    'nft_id', v_inventory_id,
    'reveal_hash', v_hash
  );
EXCEPTION WHEN OTHERS THEN
  -- catch-all so we never lose a failure signal
  IF SQLERRM NOT IN ('ticket expired','ticket not found','unauthorized') AND SQLERRM NOT LIKE 'ticket already %' THEN
    PERFORM public.log_box_function_error('reveal_box_ticket', v_user, SQLSTATE,
      SQLERRM,
      jsonb_build_object('ticket_id', p_ticket_id),
      'critical');
  END IF;
  RAISE;
END;
$function$;
