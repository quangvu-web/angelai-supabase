
-- Cron: 17:10 UTC = 00:10 Asia/Ho_Chi_Minh next day
SELECT cron.schedule(
  'cosmic-riddles-daily',
  '10 17 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/riddles-generate',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

-- Seed sample riddles for TODAY so users can play immediately
INSERT INTO public.cosmic_riddles (riddle_date, idx, theme, prompt, hint, meaning, expected_keywords, published)
VALUES
  ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 1,
   'ánh sáng nội tâm',
   'Có một ngọn đèn không cần dầu, không sợ gió, càng cho đi càng sáng. Đó là gì trong bạn?',
   'Thứ không mất đi khi được chia sẻ.',
   'Đó là tình yêu / lòng từ bi / ánh sáng bên trong — nguồn lực nội tại càng cho càng đầy.',
   ARRAY['tình yêu','lòng từ bi','ánh sáng','bên trong','cho đi','trái tim','tử tế'],
   true),
  ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 2,
   'lòng biết ơn',
   'Điều nhỏ nhất hôm nay khiến bạn muốn nói "cảm ơn" — và bạn nói với ai?',
   'Có thể là một người, một việc, hoặc chính bạn.',
   'Biết ơn cụ thể là chìa khoá mở dòng năng lượng tích cực. Càng cụ thể càng có sức chữa lành.',
   ARRAY['cảm ơn','biết ơn','hôm nay','vì','nhờ','người'],
   true),
  ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 3,
   'kết nối',
   'Hai trái tim ở hai đầu thành phố. Sợi dây nào nối họ mà không ai cắt được?',
   'Không phải dây vật chất.',
   'Sợi dây của lòng nhớ, niềm tin và yêu thương — vô hình nhưng bền chặt nhất.',
   ARRAY['yêu thương','niềm tin','nhớ','kết nối','tinh thần','vô hình'],
   true)
ON CONFLICT (riddle_date, idx) DO NOTHING;
