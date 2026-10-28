
DELETE FROM public.cached_responses
WHERE question_normalized ~* '(tình\s*yêu|ánh\s*sáng|trí\s*tuệ|thuần\s*khiết|biết\s*ơn|bình\s*an|hạnh\s*phúc|yêu\s*thương|giác\s*ngộ|linh\s*hồn|tâm\s*linh|buông\s*bỏ)'
   OR EXISTS (
     SELECT 1 FROM unnest(question_keywords) AS kw
     WHERE kw ~* '^(tình|yêu|ánh|sáng|trí|tuệ|thuần|khiết|biết|ơn|bình|an|hạnh|phúc)$'
   );
