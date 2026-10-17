import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "@/lib/router-compat";
import { angelChatUrl } from "@/lib/angelEndpoint";

type Msg = { role: "user" | "assistant"; text: string; imageUrl?: string };

function decodeToken(token: string | null): { exp?: number; client_id?: string } | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const b = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(b);
  } catch {
    return null;
  }
}

const FN_URL = angelChatUrl((import.meta.env.VITE_SUPABASE_URL ?? ""));
const ANALYZE_URL = `${(import.meta.env.VITE_SUPABASE_URL ?? "")}/functions/v1/analyze-image`;
const PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "");

export default function EmbedChat() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const decoded = decodeToken(token);
  const valid = !!decoded?.exp && decoded.exp * 1000 > Date.now();

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.parent?.postMessage({ type: "angel:ready" }, "*");
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      window.parent?.postMessage(
        { type: "angel:resize", height: wrapRef.current!.scrollHeight },
        "*",
      );
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  function readImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Ảnh tối đa 10MB nhé.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPendingImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          readImageFile(f);
          return;
        }
      }
    }
  }

  async function sendImage() {
    if (!pendingImage || busy) return;
    const question = input.trim() || "Hãy mô tả và phân tích hình ảnh này giúp mình nhé.";
    const imageUrl = pendingImage;
    setPendingImage(null);
    setInput("");
    setMessages((p) => [...p, { role: "user", text: question, imageUrl }, { role: "assistant", text: "…" }]);
    setBusy(true);
    try {
      const res = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ imageUrl, question, stream: false }),
      });
      const data = await res.json();
      const reply = data.content || data.error || "Mình chưa đọc được ảnh này.";
      setMessages((prev) => {
        const c = [...prev];
        c[c.length - 1] = { role: "assistant", text: reply };
        return c;
      });
      window.parent?.postMessage({ type: "angel:message", role: "assistant", text: reply }, "*");
    } catch (e: any) {
      setMessages((prev) => {
        const c = [...prev];
        c[c.length - 1] = { role: "assistant", text: "⚠️ Lỗi phân tích ảnh: " + (e?.message ?? "") };
        return c;
      });
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (pendingImage) return sendImage();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, text }];
    setMessages([...next, { role: "assistant", text: "…" }]);
    setInput("");
    setBusy(true);
    window.parent?.postMessage({ type: "angel:message", role: "user", text }, "*");

    try {
      const res = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.text })),
          stream: true,
        }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no_stream");
      const dec = new TextDecoder();
      let acc = "";
      let sseBuffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += dec.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line.trim() === "data: [DONE]") continue;
          try {
            const data = JSON.parse(line.slice(6));
            const piece = data.choices?.[0]?.delta?.content;
            if (piece) {
            acc += piece;
            setMessages((prev) => {
              const c = [...prev];
              c[c.length - 1] = { role: "assistant", text: acc };
              return c;
            });
            }
          } catch { /* ignore non-JSON SSE metadata */ }
        }
      }
      window.parent?.postMessage({ type: "angel:message", role: "assistant", text: acc }, "*");
    } catch (e: any) {
      setMessages((prev) => {
        const c = [...prev];
        c[c.length - 1] = { role: "assistant", text: "⚠️ Lỗi: " + (e?.message ?? "không kết nối được") };
        return c;
      });
    } finally {
      setBusy(false);
    }
  }

  if (!valid) {
    return (
      <div className="p-6 font-sans text-sm text-center text-red-600">
        Token không hợp lệ hoặc đã hết hạn. Vui lòng tải lại widget.
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="flex flex-col h-screen w-full bg-gradient-to-b from-amber-50 to-white"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
      onPaste={onPaste}
    >
      <div className="px-3 py-2 border-b bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] text-black font-bold text-sm flex items-center justify-between">
        <span>✦ Angel A.I.</span>
        <button
          onClick={() => window.parent?.postMessage({ type: "angel:close" }, "*")}
          className="text-black/70 hover:text-black px-2"
          aria-label="Close"
        >✕</button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-8">
            Chào bạn ✨ Mình là Angel A.I. Bạn có thể nhắn hỏi, hoặc dán/đính kèm ảnh để mình phân tích nhé.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : "text-left"}`}>
            <div
              className={`inline-block px-3 py-2 rounded-2xl max-w-[85%] whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-amber-500 text-white"
                  : "bg-white border border-amber-200 text-gray-900"
              }`}
            >
              {m.imageUrl && (
                <img src={m.imageUrl} alt="" className="max-w-full rounded-lg mb-1" />
              )}
              {m.text}
            </div>
          </div>
        ))}
      </div>
      {pendingImage && (
        <div className="px-3 py-2 border-t bg-amber-50 flex items-center gap-2">
          <img src={pendingImage} alt="paste" className="h-12 w-12 object-cover rounded-md border border-amber-300" />
          <span className="text-xs text-gray-700 flex-1">Ảnh sẵn sàng. Nhập câu hỏi (tuỳ chọn) rồi Gửi để Angel phân tích.</span>
          <button onClick={() => setPendingImage(null)} className="text-xs text-red-600 hover:underline">Bỏ</button>
        </div>
      )}
      <div className="border-t p-2 flex gap-2 bg-white items-center">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-2 py-2 text-sm rounded-full hover:bg-amber-100"
          title="Đính kèm ảnh"
          aria-label="Đính kèm ảnh"
        >📎</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readImageFile(f);
            e.target.value = "";
          }}
        />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          onPaste={onPaste}
          placeholder={pendingImage ? "Hỏi gì về ảnh này…" : "Nhắn cho Angel… (dán ảnh để phân tích)"}
          className="flex-1 px-3 py-2 text-sm border rounded-full outline-none focus:border-amber-500"
          disabled={busy}
        />
        <button
          onClick={send}
          disabled={busy || (!input.trim() && !pendingImage)}
          className="px-4 py-2 text-sm font-semibold rounded-full bg-gradient-to-r from-[#b8860b] to-[#ffd700] text-black disabled:opacity-50"
        >
          {busy ? "…" : "Gửi"}
        </button>
      </div>
    </div>
  );
}
