import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Copy, Trash2, Paperclip, X, Image as ImageIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { stripMarkdown } from "@/lib/stripMarkdown";
import { extractImagesFromClipboard } from "@/lib/pasteImageHandler";
import { extractDocument, ACCEPT_ATTR, type ExtractedDoc } from "@/lib/documentExtractor";

type Turn = {
  id: string;
  prompt: string;
  reply: string;
  ts: number;
  images?: string[];
  docs?: { fileName: string }[];
};

const STORAGE_KEY = "camly_bridge_history_v1";
const MAX_IMAGES = 6;
const MAX_DOCS = 4;
const MAX_SIZE_MB = 10;

function loadHistory(): Turn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CamlyBridgePanel() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [pendingDocs, setPendingDocs] = useState<ExtractedDoc[]>([]);
  const [history, setHistory] = useState<Turn[]>(loadHistory());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const persist = (next: Turn[]) => {
    setHistory(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 20))); } catch {}
  };

  const stripEchoedPrompt = (reply: string, question: string): string => {
    let out = reply.trim();
    const q = question.trim();
    if (q && out.toLowerCase().startsWith(q.toLowerCase())) out = out.slice(q.length).trim();
    out = out.replace(/^(câu hỏi|bạn hỏi|prompt|question|q)\s*[:\-–].*?(\n|$)/i, "").trim();
    out = out.replace(/^["“”'`>]+[^"“”'`\n]{10,}["“”'`]*\s*\n+/, "").trim();
    out = out.replace(/^(trả lời|answer|reply)\s*[:\-–]\s*/i, "").trim();
    return out || reply;
  };

  const readImageAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const addImageFiles = async (files: File[]) => {
    const remaining = MAX_IMAGES - pendingImages.length;
    if (remaining <= 0) { toast.error(`Tối đa ${MAX_IMAGES} ảnh`); return; }
    const accepted: File[] = [];
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_SIZE_MB * 1024 * 1024) { toast.error(`Ảnh "${f.name}" vượt ${MAX_SIZE_MB}MB`); continue; }
      accepted.push(f);
    }
    if (accepted.length === 0) return;
    try {
      const urls = await Promise.all(accepted.map(readImageAsDataUrl));
      setPendingImages((prev) => [...prev, ...urls]);
    } catch { toast.error("Không đọc được một số ảnh"); }
  };

  const addDocFiles = async (files: File[]) => {
    const remaining = MAX_DOCS - pendingDocs.length;
    if (remaining <= 0) { toast.error(`Tối đa ${MAX_DOCS} tài liệu`); return; }
    const newDocs: ExtractedDoc[] = [];
    for (const f of files.slice(0, remaining)) {
      try {
        const doc = await extractDocument(f);
        newDocs.push(doc);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Không đọc được ${f.name}`);
      }
    }
    if (newDocs.length > 0) {
      setPendingDocs((prev) => [...prev, ...newDocs]);
      toast.success(`Đã đính kèm ${newDocs.length} tài liệu`);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addImageFiles(Array.from(e.target.files || []));
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addDocFiles(Array.from(e.target.files || []));
    if (docInputRef.current) docInputRef.current.value = "";
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = extractImagesFromClipboard(e);
    if (files.length === 0) return;
    e.preventDefault();
    await addImageFiles(files);
  };

  const analyzeImage = async (imageUrl: string, question: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("analyze-image", {
      body: { imageUrl, question: question || "Mô tả chi tiết hình ảnh này.", stream: false },
    });
    if (error) throw error;
    return (data as { content?: string })?.content || "";
  };

  const analyzeDocument = async (doc: ExtractedDoc, question: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("analyze-document", {
      body: {
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        textContent: doc.textContent,
        fileBase64: doc.fileBase64,
        question: question || `Tóm tắt nội dung file "${doc.fileName}".`,
      },
    });
    if (error) throw error;
    return (data as { content?: string })?.content || "";
  };

  const send = async () => {
    const text = prompt.trim();
    if ((!text && pendingImages.length === 0 && pendingDocs.length === 0) || loading || analyzing) return;
    setLoading(true);
    try {
      let combined = text;
      const blocks: string[] = [];

      if (pendingImages.length > 0 || pendingDocs.length > 0) {
        setAnalyzing(true);
        const imgPromises = pendingImages.map((url, i) =>
          analyzeImage(url, text)
            .then((d) => `[Ảnh ${i + 1} — Angel mô tả: ${d}]`)
            .catch(() => `[Ảnh ${i + 1} — không phân tích được]`)
        );
        const docPromises = pendingDocs.map((doc) =>
          analyzeDocument(doc, text)
            .then((d) => `[Tài liệu "${doc.fileName}" — Angel tóm tắt:\n${d}]`)
            .catch((e) => `[Tài liệu "${doc.fileName}" — không đọc được: ${e instanceof Error ? e.message : "lỗi"}]`)
        );
        const results = await Promise.all([...imgPromises, ...docPromises]);
        setAnalyzing(false);
        blocks.push(...results);
      }

      if (blocks.length > 0) combined = text ? `${text}\n\n${blocks.join("\n\n")}` : blocks.join("\n\n");

      const directive =
        "Trả lời trực tiếp, KHÔNG nhắc lại hoặc trích dẫn câu hỏi của mình. Bắt đầu ngay bằng nội dung trả lời.\n\n";
      const { data, error } = await supabase.functions.invoke("coordinator-chat", {
        body: {
          messages: [{ role: "user", content: directive + combined }],
          mode: "product_spec",
          ai_role: "product_architect",
          stream: false,
        },
      });
      if (error) throw error;

      const rawReply =
        data?.choices?.[0]?.message?.content ||
        data?.content ||
        data?.message ||
        "(Angel không trả về nội dung)";
      const reply = stripEchoedPrompt(stripMarkdown(rawReply), text || combined);

      const turn: Turn = {
        id: crypto.randomUUID(),
        prompt: text || "(Chỉ gửi đính kèm)",
        reply,
        ts: Date.now(),
        images: pendingImages.length > 0 ? [...pendingImages] : undefined,
        docs: pendingDocs.length > 0 ? pendingDocs.map((d) => ({ fileName: d.fileName })) : undefined,
      };
      persist([...history, turn]);
      setPrompt("");
      setPendingImages([]);
      setPendingDocs([]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Không gửi được prompt cho Angel");
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Đã sao chép"); };
  const clear = () => { persist([]); toast.success("Đã xoá lịch sử"); };

  const busy = loading || analyzing;
  const hasAttachments = pendingImages.length > 0 || pendingDocs.length > 0;

  return (
    <Card className="p-5 border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-r from-amber-50/60 to-yellow-50/40 dark:from-amber-950/15 dark:to-yellow-950/10">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h2 className="text-lg font-semibold">Camly → Angel Bridge</h2>
        <Badge variant="outline" className="ml-2">Strategic Workspace</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Camly và các Coordinator gửi prompt chiến lược qua đây để Angel AI Core trả lời. Hỗ trợ đính kèm ảnh + tài liệu (PDF, DOCX, XLSX, TXT, MD, JSON, code…).
      </p>

      <div className="space-y-2">
        {hasAttachments && (
          <div className="flex flex-wrap gap-2 p-2 rounded-md border border-dashed border-amber-300/60 bg-background/60">
            {pendingImages.map((url, i) => (
              <div key={`img-${i}`} className="relative">
                <img src={url} alt={`Ảnh ${i + 1}`} className="h-20 w-20 object-cover rounded-md border border-border" />
                <button type="button" onClick={() => setPendingImages((p) => p.filter((_, x) => x !== i))}
                  className="absolute -top-2 -right-2 p-0.5 bg-destructive text-destructive-foreground rounded-full shadow" aria-label="Gỡ ảnh">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {pendingDocs.map((doc, i) => (
              <div key={`doc-${i}`} className="relative flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background max-w-[260px]">
                <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{doc.fileName}</div>
                  <div className="text-[10px] text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB</div>
                </div>
                <button type="button" onClick={() => setPendingDocs((p) => p.filter((_, x) => x !== i))}
                  className="absolute -top-2 -right-2 p-0.5 bg-destructive text-destructive-foreground rounded-full shadow" aria-label="Gỡ tài liệu">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="text-[10px] text-muted-foreground w-full flex items-center gap-2">
              <ImageIcon className="h-3 w-3" /> {pendingImages.length}/{MAX_IMAGES} ảnh
              <span>·</span>
              <FileText className="h-3 w-3" /> {pendingDocs.length}/{MAX_DOCS} tài liệu
              <span>— Angel sẽ đọc từng đính kèm khi gửi</span>
            </div>
          </div>
        )}

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onPaste={handlePaste}
          placeholder="Vd: Phác thảo roadmap Q3... (Ctrl+V dán ảnh, đính kèm tài liệu để Angel phân tích)"
          rows={4}
          className="bg-background"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(); }}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter để gửi</span>
          <div className="flex gap-2 flex-wrap">
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
            <input ref={docInputRef} type="file" accept={ACCEPT_ATTR} multiple onChange={handleDocSelect} className="hidden" />
            <Button size="sm" variant="outline" onClick={() => imageInputRef.current?.click()}
              disabled={busy || pendingImages.length >= MAX_IMAGES} title="Đính kèm ảnh">
              <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Ảnh
            </Button>
            <Button size="sm" variant="outline" onClick={() => docInputRef.current?.click()}
              disabled={busy || pendingDocs.length >= MAX_DOCS} title="Đính kèm tài liệu (PDF, DOCX, XLSX, TXT…)">
              <Paperclip className="h-3.5 w-3.5 mr-1.5" /> Tài liệu
            </Button>
            {history.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clear} disabled={busy}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Xoá lịch sử
              </Button>
            )}
            <Button size="sm" onClick={send} disabled={busy || (!prompt.trim() && !hasAttachments)}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              {analyzing ? "Đang đọc đính kèm..." : "Gửi cho Angel"}
            </Button>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-5 space-y-3 max-h-[480px] overflow-y-auto">
          {history.map((t) => (
            <div key={t.id} className="rounded-lg border bg-background/70 p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-muted-foreground">Camly · {new Date(t.ts).toLocaleString("vi-VN")}</div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copy(t.prompt)} title="Sao chép câu hỏi">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {t.images && t.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {t.images.map((url, i) => (
                    <img key={i} src={url} alt={`Ảnh ${i + 1}`} className="h-16 w-16 object-cover rounded border border-border" />
                  ))}
                </div>
              )}
              {t.docs && t.docs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {t.docs.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-muted/50 text-xs">
                      <FileText className="h-3 w-3 text-amber-600" /> {d.fileName}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-sm font-medium whitespace-pre-wrap mb-2">{t.prompt}</div>
              <div className="border-t pt-2 mt-2">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Angel A.I.</div>
                <div className="text-sm whitespace-pre-wrap text-foreground/90">{stripMarkdown(t.reply)}</div>
                <div className="flex justify-end mt-2">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copy(stripMarkdown(t.reply))} title="Sao chép câu trả lời">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
