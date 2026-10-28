
-- Function to notify GOV attesters when a new pending_sig request is created
CREATE OR REPLACE FUNCTION public.notify_gov_attesters_on_pending_sig()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gov_wallets text[] := ARRAY[
    '0xe32d50a0bade4cbd5b0d6120d3a5fd07f63694f1',
    '0xfd0da7a744245e7aceccd786d5a743ef9291a557',
    '0x02d5578173bd0db25462bb32a254cd4b2e6d9a0d',
    '0xca319fbc39f519822385f2d0a0114b14fa89a301',
    '0xdf8249159bb67804d718bc8186f95b75ce5ecbe8',
    '0x5102ecc4a458a1af76afa50d23359a712658a402',
    '0xe418a560611e80e4239f5513d41e583fc9ac2e6d',
    '0x67464df3082828b3cf10c5cb08fc24a28228efd1',
    '0x9ec8c51175526bebb1d04100256de71cf99b7ccc'
  ];
  gov_user_id uuid;
  actor_name text;
  notif_title text;
  notif_content text;
BEGIN
  -- Only fire on pending_sig inserts
  IF NEW.status <> 'pending_sig' THEN
    RETURN NEW;
  END IF;

  -- Get actor display name
  SELECT display_name INTO actor_name
  FROM profiles
  WHERE user_id = NEW.actor_id
  LIMIT 1;

  notif_title := '🔐 ' || COALESCE(NEW.amount::text, '0') || ' FUN cần ký xác nhận';
  notif_content := 'Yêu cầu mint ' || COALESCE(NEW.amount::text, '0') || ' FUN từ ' || COALESCE(actor_name, 'người dùng') || ' đang chờ chữ ký GOV 3/3. Vào Attester Panel để ký.';

  -- Find all users who have a GOV wallet saved
  FOR gov_user_id IN
    SELECT DISTINCT u.user_id
    FROM user_wallet_addresses u
    WHERE LOWER(u.wallet_address) = ANY(gov_wallets)
      AND u.user_id IS NOT NULL
      AND u.user_id <> NEW.actor_id  -- Don't notify the requester if they're also GOV
  LOOP
    INSERT INTO notifications (user_id, type, title, content, actor_id, reference_id, reference_type)
    VALUES (
      gov_user_id,
      'gov_signing_request',
      notif_title,
      notif_content,
      NEW.actor_id,
      NEW.id,
      'mint_request'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_notify_gov_on_pending_sig ON pplp_mint_requests;
CREATE TRIGGER trg_notify_gov_on_pending_sig
  AFTER INSERT ON pplp_mint_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending_sig')
  EXECUTE FUNCTION notify_gov_attesters_on_pending_sig();
