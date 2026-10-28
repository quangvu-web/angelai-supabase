
CREATE OR REPLACE FUNCTION public.register_device_fingerprint(_user_id UUID, _device_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing RECORD;
  v_other_users INTEGER;
  v_is_suspicious BOOLEAN := false;
  v_reason TEXT;
  v_is_whitelisted BOOLEAN := false;
BEGIN
  -- Check whitelist first
  SELECT EXISTS (
    SELECT 1 FROM fraud_whitelist WHERE user_id = _user_id
  ) INTO v_is_whitelisted;

  -- Check if this device hash is used by other users
  SELECT COUNT(DISTINCT user_id) INTO v_other_users
  FROM pplp_device_registry
  WHERE device_hash = _device_hash AND user_id != _user_id;
  
  IF v_other_users > 0 AND NOT v_is_whitelisted THEN
    v_is_suspicious := true;
    v_reason := 'Device hash matches ' || v_other_users || ' other user(s)';
    
    -- Create fraud signal only if NOT whitelisted
    INSERT INTO pplp_fraud_signals (actor_id, signal_type, severity, details, source)
    VALUES (
      _user_id,
      'SYBIL',
      CASE WHEN v_other_users > 2 THEN 4 ELSE 3 END,
      jsonb_build_object(
        'device_hash', _device_hash,
        'other_users_count', v_other_users,
        'reason', v_reason
      ),
      'SYSTEM'
    );
  END IF;
  
  -- Upsert device registry (vẫn giữ nguyên cho mọi user)
  INSERT INTO pplp_device_registry (device_hash, user_id, usage_count, is_flagged, flag_reason)
  VALUES (_device_hash, _user_id, 1, v_is_suspicious, v_reason)
  ON CONFLICT (device_hash, user_id) DO UPDATE SET
    last_seen = now(),
    usage_count = pplp_device_registry.usage_count + 1,
    is_flagged = CASE WHEN v_is_suspicious THEN true ELSE pplp_device_registry.is_flagged END,
    flag_reason = CASE WHEN v_is_suspicious THEN v_reason ELSE pplp_device_registry.flag_reason END;
  
  -- Update user tier record with device
  UPDATE pplp_user_tiers
  SET 
    last_device_hash = _device_hash,
    known_device_hashes = CASE 
      WHEN _device_hash = ANY(known_device_hashes) THEN known_device_hashes
      ELSE array_append(known_device_hashes, _device_hash)
    END,
    updated_at = now()
  WHERE user_id = _user_id;
  
  RETURN jsonb_build_object(
    'is_suspicious', v_is_suspicious,
    'is_whitelisted', v_is_whitelisted,
    'reason', v_reason,
    'other_users_count', v_other_users
  );
END;
$$;
