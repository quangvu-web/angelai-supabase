// Public docs: /docs/knowledge-ingest-api
// Hướng dẫn cho FUN Profile / Telegram / Website … đẩy tài liệu vào RAG Angel AI.
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ENDPOINT =
  "https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/knowledge-external-ingest";

const CURL_UPSERT = `curl -X POST ${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <ANGEL_KNOWLEDGE_INGEST_KEY>" \\
  -d '{
    "action": "upsert",
    "documents": [
      {
        "source": "fun_profile",
        "source_ref": "post_1234",
        "title": "Bài viết ví dụ",
        "content": "Nội dung thuần text …",
        "url": "https://fun.rich/post/1234",
        "language": "vi",
        "folder": "FUN Profile / Posts",
        "metadata": { "author_id": "uuid", "tags": ["community"] }
      }
    ],
    "options": { "chunk_now": false }
  }'`;

const CURL_DELETE = `curl -X POST ${ENDPOINT} \\
  -H "x-api-key: <KEY>" -H "Content-Type: application/json" \\
  -d '{"action":"delete","source":"fun_profile","source_ref":"post_1234"}'`;

const CURL_STATUS = `curl -X POST ${ENDPOINT} \\
  -H "x-api-key: <KEY>" -H "Content-Type: application/json" \\
  -d '{"action":"status","source":"fun_profile","source_refs":["post_1234","post_5678"]}'`;

const JS_EXAMPLE = `await fetch("${ENDPOINT}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANGEL_KNOWLEDGE_INGEST_KEY!,
  },
  body: JSON.stringify({
    action: "upsert",
    documents: [{ source: "telegram", source_ref: "msg_98765",
      title: "Tin nhắn kênh chính", content: "…" }],
    options: { chunk_now: false },
  }),
});`;

function Block({ children }: { children: string }) {
  return (
    <pre className="bg-muted/50 border rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default function KnowledgeIngestApi() {
  useEffect(() => {
    document.title = "Knowledge Ingest API — Angel AI";
  }, []);
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="space-y-2">
        <Badge variant="outline">API v1 · Production</Badge>
        <h1 className="text-3xl font-bold">Knowledge Ingest API</h1>
        <p className="text-muted-foreground">
          Endpoint chuẩn để FUN Profile, Telegram bot, Facebook, YouTube, Website
          hoặc bất kỳ nguồn nào đồng bộ tài liệu vào RAG của Angel AI. Bên gửi
          KHÔNG cần chunk / embed / lưu vector — Angel AI tự làm hết.
        </p>
      </header>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">1. Endpoint & Xác thực</h2>
        <p className="text-sm"><b>URL:</b> <code className="bg-muted px-2 py-0.5 rounded">{ENDPOINT}</code></p>
        <p className="text-sm"><b>Method:</b> <code>POST</code> · <b>Content-Type:</b> <code>application/json</code></p>
        <p className="text-sm"><b>Header xác thực:</b> <code>x-api-key: &lt;ANGEL_KNOWLEDGE_INGEST_KEY&gt;</code></p>
        <p className="text-sm text-muted-foreground">
          Key do đội Angel AI cấp — liên hệ CTO để nhận. Có thể revoke độc lập,
          không dùng chung với các key khác.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">2. Action <code>upsert</code></h2>
        <p className="text-sm">Thêm mới hoặc cập nhật tài liệu. Upsert theo unique
          <code> (source, source_ref)</code>. Nếu <code>content</code> không đổi (so sánh sha256)
          → chỉ update metadata, KHÔNG re-embed (tiết kiệm token).</p>
        <Block>{CURL_UPSERT}</Block>

        <h3 className="font-semibold mt-4">Field bắt buộc</h3>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li><code>source</code> — vd: <code>fun_profile</code>, <code>telegram</code>, <code>facebook</code>, <code>youtube</code>, <code>website</code>, <code>file_upload</code>, <code>custom_*</code></li>
          <li><code>source_ref</code> — id ổn định để upsert (post id, message id…)</li>
          <li><code>title</code> — ≤ 300 ký tự</li>
          <li><code>content</code> — thuần text, ≤ 200 000 ký tự (~50k token)</li>
        </ul>
        <h3 className="font-semibold mt-4">Field tùy chọn</h3>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li><code>url</code> — link nguồn để citation</li>
          <li><code>language</code> — mặc định <code>"vi"</code></li>
          <li><code>folder</code> — tự tạo folder nếu chưa có</li>
          <li><code>metadata</code> — jsonb tùy do (author, tags, published_at…)</li>
        </ul>

        <h3 className="font-semibold mt-4">Options</h3>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li><code>chunk_now</code> (mặc định <code>false</code>) — <code>true</code>: chunk+embed đồng bộ trong request (chậm hơn nhưng biết ngay kết quả). <code>false</code>: xếp hàng, cron 10 phút xử lý nền (khuyến nghị cho batch lớn).</li>
        </ul>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">3. Action <code>delete</code></h2>
        <p className="text-sm">Xóa 1 doc theo <code>source + source_ref</code>, hoặc bỏ <code>source_ref</code> để xóa <b>toàn bộ</b> nguồn.</p>
        <Block>{CURL_DELETE}</Block>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">4. Action <code>status</code></h2>
        <p className="text-sm">Tra cứu trạng thái ingest theo danh sách <code>source_refs</code>.</p>
        <Block>{CURL_STATUS}</Block>
        <p className="text-sm text-muted-foreground">
          Response trả về: <code>ingest_status</code> ∈ <code>pending | processing | ready | failed</code>,
          <code> chunk_count</code>, <code>ingest_error</code>, <code>ingested_at</code>.
        </p>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">5. Quy trình xử lý (server làm hết)</h2>
        <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-x-auto">{`Client POST
  ↓ [1] Verify x-api-key + rate limit
  ↓ [2] Validate payload
  ↓ [3] UPSERT knowledge_documents ON (source, source_ref)
  ↓ [4] Chunk (~700 char, overlap 200) + Embed (openai/text-embedding-3-small, 1536d)
  ↓ [5] Xóa chunk cũ, insert chunk mới, cập nhật HNSW index
  ↓ [6] status = ready → Angel chat retrieve được ngay lập tức`}</pre>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">6. Giới hạn</h2>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>≤ <b>200 000 ký tự</b> / document (~50k token). Dài hơn phải tự split.</li>
          <li>≤ <b>200 documents</b> / request.</li>
          <li><b>60 request/phút</b> / API key. Vượt → <code>429 rate_limited</code>, retry sau 60s.</li>
          <li>Embedding model: <code>openai/text-embedding-3-small</code> (1536 dim, cosine).</li>
        </ul>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">7. Mã lỗi</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b"><th className="text-left p-2">HTTP</th><th className="text-left p-2">code</th><th className="text-left p-2">Ý nghĩa</th></tr>
          </thead>
          <tbody>
            <tr className="border-b"><td className="p-2">401</td><td><code>unauthorized</code></td><td>Thiếu/sai <code>x-api-key</code></td></tr>
            <tr className="border-b"><td className="p-2">400</td><td><code>invalid_payload</code></td><td>Thiếu field / action lạ</td></tr>
            <tr className="border-b"><td className="p-2">413</td><td><code>content_too_large</code></td><td>Vượt giới hạn size hoặc batch</td></tr>
            <tr className="border-b"><td className="p-2">429</td><td><code>rate_limited</code></td><td>Vượt 60 req/phút</td></tr>
            <tr className="border-b"><td className="p-2">422</td><td><code>embed_failed</code></td><td>Lỗi embed (chỉ khi <code>chunk_now=true</code>)</td></tr>
            <tr><td className="p-2">500</td><td><code>internal_error</code></td><td>Lỗi hệ thống</td></tr>
          </tbody>
        </table>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-semibold">8. Ví dụ tích hợp JS/TS</h2>
        <Block>{JS_EXAMPLE}</Block>
        <p className="text-sm text-muted-foreground">
          FUN Profile không cần lưu bản sao knowledge — gọi endpoint này khi có
          post/message mới. User xóa post → gọi <code>action:"delete"</code>.
        </p>
      </Card>
    </div>
  );
}
