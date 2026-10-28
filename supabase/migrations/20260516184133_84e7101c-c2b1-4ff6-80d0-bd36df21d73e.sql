CREATE OR REPLACE FUNCTION public.get_my_light_circle()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_circle_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('in_circle', false); END IF;
  SELECT circle_id INTO v_circle_id FROM light_circle_members WHERE user_id=v_uid;
  IF v_circle_id IS NULL THEN RETURN jsonb_build_object('in_circle', false); END IF;

  SELECT jsonb_build_object(
    'in_circle', true,
    'circle', to_jsonb(c.*),
    'my_role', (SELECT role FROM light_circle_members WHERE circle_id=c.id AND user_id=v_uid),
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'joined_at', m.joined_at,
        'contributed_light', m.contributed_light,
        'display_name', COALESCE(p.display_name, p.handle, 'Người dùng'),
        'avatar_url', p.avatar_url,
        'handle', p.handle
      ) ORDER BY m.joined_at)
      FROM light_circle_members m
      LEFT JOIN profiles p ON p.user_id = m.user_id
      WHERE m.circle_id=c.id
    ), '[]'::jsonb),
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'user_id', x.user_id, 'body', x.body, 'created_at', x.created_at,
        'display_name', COALESCE(p.display_name, p.handle, 'Người dùng'),
        'avatar_url', p.avatar_url
      ) ORDER BY x.created_at)
      FROM (
        SELECT * FROM light_circle_chat_messages
         WHERE circle_id=c.id ORDER BY created_at DESC LIMIT 50
      ) x
      LEFT JOIN profiles p ON p.user_id = x.user_id
    ), '[]'::jsonb),
    'invites', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'code', i.code, 'expires_at', i.expires_at, 'uses_left', i.uses_left
      ) ORDER BY i.created_at DESC)
      FROM light_circle_invites i
      WHERE i.circle_id=c.id AND i.expires_at>now() AND i.uses_left>0
    ), '[]'::jsonb)
  ) INTO v_result
  FROM light_circles c WHERE c.id=v_circle_id;

  RETURN v_result;
END $function$;