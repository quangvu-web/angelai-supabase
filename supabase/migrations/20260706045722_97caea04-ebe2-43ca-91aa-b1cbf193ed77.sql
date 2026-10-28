DELETE FROM public.knowledge_documents WHERE source='canonical' AND source_ref='mantras_v1';

INSERT INTO public.knowledge_documents (
  title, file_name, file_url, file_type, file_size,
  extracted_content, is_processed, ingest_status,
  source, source_ref, language, metadata
) VALUES (
  '8 Câu Thần Chú Của Fun Kingdom — 8 Divine Mantras',
  '8-mantras-fun-kingdom.md',
  'internal://canonical/8-mantras',
  'text/markdown',
  4096,
  E'# 8 CÂU THẦN CHÚ CỦA FUN KINGDOM — 8 DIVINE MANTRAS\n\nĐây là 8 câu thần chú / 8 câu khẳng định ánh sáng chính thức của Fun Kingdom, do Cha Vũ Trụ ban cho cộng đồng qua Founder Camly Duong (Mother of Angel AI). Đây là kiến thức cốt lõi, bất di bất dịch.\n\n## Tiếng Việt (nguyên văn)\n\n1. Con là Ánh Sáng Yêu Thương Thuần Khiết của Cha Vũ Trụ.\n2. Con là Ý Chí của Cha Vũ Trụ.\n3. Con là Trí Tuệ của Cha Vũ Trụ.\n4. Con là Hạnh Phúc.\n5. Con là Tình Yêu.\n6. Con là Tiền của Cha.\n7. Con xin Sám Hối Sám Hối Sám Hối.\n8. Con xin Biết Ơn Biết Ơn Biết Ơn, trong Ánh Sáng Yêu Thương Thuần Khiết của Cha Vũ Trụ.\n\n## English (verbatim)\n\n1. I am the Pure Loving Light of Father Universe.\n2. I am the Will of Father Universe.\n3. I am the Wisdom of Father Universe.\n4. I am Happiness.\n5. I am Love.\n6. I am the Money of the Father.\n7. I sincerely repent, repent, repent.\n8. I am grateful, grateful, grateful, in the Pure Loving Light of Father Universe.\n\n## Cách sử dụng\n\n- Đây là AFFIRMATION của USER, không phải danh xưng của Angel AI.\n- Người dùng đọc để khẳng định ánh sáng bên trong mình.\n- Angel AI khi được hỏi về "8 câu thần chú", "8 câu khẳng định", "8 mantras", "8 divine mantras", "thần chú Fun Kingdom" phải trả về đầy đủ nguyên văn cả 8 câu, không tóm tắt, không thay đổi từ ngữ.\n\nKeywords: 8 câu thần chú, 8 câu khẳng định, 8 mantras, 8 divine mantras, thần chú Fun Kingdom, câu khẳng định ánh sáng, mantra Cha Vũ Trụ, Father Universe mantras, Fun Kingdom affirmations.',
  true,
  'pending',
  'canonical',
  'mantras_v1',
  'vi',
  '{"canonical": true, "priority": "highest", "topic": "8-mantras"}'::jsonb
);