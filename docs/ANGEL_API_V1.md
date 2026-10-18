# Angel API v1 — dịch vụ Angel AI độc lập cho các app trong hệ FUN

Endpoint (đang chạy thật, HTTP 200):

```
POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/angel-v1-chat
```

URL production mong muốn `https://angel.fun.rich/api/v1/angel/chat` cần một lớp proxy ở
tầng domain (Cloudflare Worker), vì angel.fun.rich là static SPA nên không tự route POST được:

```js
// Cloudflare Worker gắn route angel.fun.rich/api/v1/angel/*
export default {
  fetch: (req) => fetch(
    "https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/angel-v1-chat",
    { method: "POST", headers: req.headers, body: req.body },
  ),
};
```

## Xác thực

Header bắt buộc: `x-api-key: <ANGEL_API_KEY>` (server-to-server, không để lộ ra browser).

| Mã lỗi | HTTP | Ý nghĩa |
|---|---|---|
| `missing_api_key` / `not_found` | 401 | Thiếu hoặc sai key |
| `inactive` / `expired` | 403 | Key bị khoá / hết hạn |
| `rate_limited` | 429 | Vượt hạn mức ngày (trả kèm `dailyLimit`, `currentUsage`) |
| `invalid_request` | 400 | Thiếu `message` hoặc quá 8000 ký tự |
| `payment_required` / `upstream_error` | 402 / 503 | Sự cố nhà cung cấp AI |

## Request

```jsonc
{
  "message": "Theo đoạn văn đang đọc, Universal Father là ai?",
  "language": "vi",                       // tuỳ chọn, tự đoán nếu bỏ trống
  "conversation": [                        // tuỳ chọn, tối đa 12 lượt gần nhất
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "context": {                             // tuỳ chọn — chỉ là kiến thức BỔ SUNG
    "type": "urantia",                     // general | urantia | academy | social | game | other
    "book": "The Urantia Book",
    "part": "Part I",
    "paperNumber": 1,
    "paperTitle": "The Universal Father",
    "section": "1",
    "selectedText": "...",
    "relevantPassages": [
      { "paperNumber": 1, "paperTitle": "...", "section": "1",
        "url": "https://urantia.fun.rich/paper/1", "text": "..." }
    ]
  }
}
```

## Response

```jsonc
{
  "answer": "…",
  "sources": [ { "label": "Paper 1 — The Universal Father — § 1", "paperNumber": 1,
                 "paperTitle": "...", "part": null, "section": "1",
                 "url": "...", "excerpt": "..." } ],
  "relatedPapers": [ /* cùng shape, các paper khác trong passages */ ],
  "suggestions": ["...", "...", "..."],
  "meta": {
    "requestId": "…", "apiVersion": "v1", "contextType": "urantia", "language": "vi",
    "provider": "cloudflare", "angelKnowledgeUsed": true, "angelKnowledgeChunks": 5,
    "ragMode": "vector_only", "passagesProvided": 1, "passagesCited": 1,
    "unverifiedCitations": false, "unverifiedPapers": [], "latencyMs": 17446
  }
}
```

## Bảo đảm

- **Full Angel Intelligence** — dùng đúng core prompt, module, RAG nội bộ và AI gateway
  của angel.fun.rich/chat. Câu hỏi ngoài phạm vi sách (blockchain, kế hoạch kinh doanh,
  viết lách…) được trả lời đầy đủ, tuyệt đối không từ chối theo phạm vi.
- **Source Integrity** — `sources` do backend dựng từ chính `relevantPassages` client gửi;
  model không được phép tự sinh metadata nguồn. Nếu câu trả lời nhắc tới một Paper không
  có trong context, `meta.unverifiedCitations = true` và số paper đó nằm ở `unverifiedPapers`.
- **Độc lập workspace** — endpoint mới, không đụng `angel-chat` cũ; context của mỗi app
  chỉ sống trong đúng request đó.
