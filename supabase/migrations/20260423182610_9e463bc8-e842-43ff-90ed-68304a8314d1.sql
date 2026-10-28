-- Mở rộng khung giờ Nhật Ký: 20:00 đến 04:00 sáng hôm sau (giờ Việt Nam)
-- Đếm theo "đêm" thay vì lịch ngày, để user vẫn viết tiếp được sau nửa đêm.
CREATE OR REPLACE FUNCTION public.get_daily_reward_status(_user_id uuid)
 RETURNS TABLE(questions_rewarded integer, questions_remaining integer, journals_rewarded integer, journals_remaining integer, can_write_journal boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tracking_today RECORD;
  _vn_now TIMESTAMP;
  _current_hour INTEGER;
  _journal_night_date DATE; -- ngày bắt đầu của "đêm" hiện tại
  _journal_count INTEGER;
  _can_write BOOLEAN;
BEGIN
  _vn_now := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh');
  _current_hour := EXTRACT(HOUR FROM _vn_now)::int;

  -- Khung mở: 20:00 → 03:59 sáng hôm sau
  _can_write := (_current_hour >= 20 OR _current_hour < 4);

  -- Tính ngày bắt đầu của "đêm hiện tại"
  -- - Nếu giờ < 4: đêm bắt đầu HÔM QUA (vn_now::date - 1)
  -- - Nếu giờ >= 20: đêm bắt đầu HÔM NAY
  -- - Ngoài khung: dùng hôm nay làm mốc đếm hiển thị
  IF _current_hour < 4 THEN
    _journal_night_date := (_vn_now::date - INTERVAL '1 day')::date;
  ELSE
    _journal_night_date := _vn_now::date;
  END IF;

  -- Tracking cho phần questions vẫn theo CURRENT_DATE (giữ nguyên hành vi cũ)
  SELECT * INTO _tracking_today
  FROM public.daily_reward_tracking
  WHERE user_id = _user_id AND reward_date = CURRENT_DATE;

  IF NOT FOUND THEN
    INSERT INTO public.daily_reward_tracking (user_id, reward_date)
    VALUES (_user_id, CURRENT_DATE)
    RETURNING * INTO _tracking_today;
  END IF;

  -- Đếm journals đã viết trong "đêm hiện tại" theo journal_date của bảng gratitude_journal
  SELECT COUNT(*)::int INTO _journal_count
  FROM public.gratitude_journal
  WHERE user_id = _user_id
    AND journal_date = _journal_night_date
    AND is_rewarded = TRUE;

  RETURN QUERY SELECT
    _tracking_today.questions_rewarded,
    GREATEST(0, 10 - _tracking_today.questions_rewarded)::INTEGER,
    _journal_count,
    GREATEST(0, 3 - _journal_count)::INTEGER,
    _can_write;
END;
$function$;