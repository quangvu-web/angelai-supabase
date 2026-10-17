import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Paperclip, X, Image as ImageIcon, FileText } from "lucide-react";
import { ChatMessage, PendingEvolve } from "@/hooks/useCoordinatorChat";
import { MODES } from "./ModeSelector";
import { ROLES } from "./RoleSelector";
import { cn } from "@/lib/utils";
import { EvolveCard } from "./EvolveCard";
import { stripToolCalls } from "@/lib/coordinatorToolParser";
import { extractImagesFromClipboard } from "@/lib/pasteImageHandler";
import { extractDocument, ACCEPT_ATTR, type ExtractedDoc } from "@/lib/documentExtractor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  mode: string;
  aiRole: string;
  onSend: (content: string) => void;
  pendingEvolve?: PendingEvolve | null;
  onApproveEvolve?: () => void;
  onRejectEvolve?: () => void;
}

const MAX_IMAGES = 6;
const MAX_DOCS = 4;
const MAX_IMG_MB = 10;

function stripToolJson(text: string): string {
  return stripToolCalls(text);
}

function renderContent(text: string) {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted/50 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-4 mb-2">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/\n/g, '<br/>');
}

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  product_spec: [
    "Generate full PRD for this platform",
    "Define target user personas",
    "Create feature prioritization matrix",
  ],
  smart_contract: [
    "Design token reward logic",
    "Review mint/burn security",
    "Audit checklist for this contract",
  ],
  tokenomics: [
    "Simulate token supply over 5 years",
    "Design reward sustainability model",
    "Analyze inflation risk",
  ],
  ux_flow: [
    "Map complete user onboarding journey",
    "Design earn flow user experience",
    "Create error handling patterns",
  ],
  growth: [
    "Design viral referral loop",
    "Plan launch strategy for first 1000 users",
    "Define key growth metrics",
  ],
  governance: [
    "Run PLP compliance check",
    "Evaluate token sustainability risk",
    "Check Light Constitution alignment",
  ],
};

export function CoordinatorChat({
  messages, isStreaming, streamingContent, mode, aiRole, onSend,
  pendingEvolve, onApproveEvolve, onRejectEvolve,
}: Props) {
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [pendingDocs, setPendingDocs] = useState<ExtractedDoc[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;
  const roleLabel = ROLES.find((r) => r.id === aiRole)?.label ?? aiRole;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent, pendingEvolve]);

  const readImageAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addImageFiles = async (files: File[]) => {
    const remaining = MAX_IMAGES - pendingImages.length;
    if (remaining <= 0) { toast.error(`Tối đa ${MAX_IMAGES} ảnh`); return; }
    const accepted: File[] = [];
    for (const f of files.slice(0, remaining)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > MAX_IMG_MB * 1024 * 1024) { toast.error(`Ảnh "${f.name}" vượt ${MAX_IMG_MB}MB`); continue; }
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
    toast.success("Đã dán ảnh — Angel sẽ phân tích khi bạn gửi");
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

  const hasAttachments = pendingImages.length > 0 || pendingDocs.length > 0;

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !hasAttachments) || isStreaming || isAnalyzing) return;

    if (hasAttachments) {
      setIsAnalyzing(true);
      try {
        const imgPromises = pendingImages.map((url, i) =>
          analyzeImage(url, trimmed)
            .then((d) => `[Ảnh ${i + 1} — Angel mô tả: ${d}]`)
            .catch(() => `[Ảnh ${i + 1} — không phân tích được]`)
        );
        const docPromises = pendingDocs.map((doc) =>
          analyzeDocument(doc, trimmed)
            .then((d) => `[Tài liệu "${doc.fileName}" — Angel tóm tắt:\n${d}]`)
            .catch((e) => `[Tài liệu "${doc.fileName}" — không đọc được: ${e instanceof Error ? e.message : "lỗi"}]`)
        );
        const results = await Promise.all([...imgPromises, ...docPromises]);
        const combined = trimmed ? `${trimmed}\n\n${results.join("\n\n")}` : results.join("\n\n");
        onSend(combined);
        setInput("");
        setPendingImages([]);
        setPendingDocs([]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không phân tích được đính kèm");
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }

    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const prompts = SUGGESTED_PROMPTS[mode] || SUGGESTED_PROMPTS.product_spec;
  const busy = isStreaming || isAnalyzing;

  return (
    <div className="flex flex-col h-full">
      {/* Active badges */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/50">
        <Badge variant="outline" className="text-xs">{modeLabel}</Badge>
        <Badge variant="secondary" className="text-xs">{roleLabel}</Badge>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground mb-4 text-sm">Start building with Angel AI. Try a prompt:</p>
            <div className="flex flex-col gap-2 max-w-md">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => { setInput(p); }}
                  className="text-left text-sm px-4 py-2.5 rounded-lg border border-border/60 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const displayContent = msg.role === "assistant" ? stripToolJson(msg.content) : msg.content;
          const showEvolveHere = pendingEvolve && pendingEvolve.messageIndex === i;
          return (
            <div key={i} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground",
                )}
              >
                {msg.role === "assistant" ? (
                  displayContent ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: renderContent(displayContent) }} />
                  ) : (
                    <span className="text-xs italic text-muted-foreground">(Đề xuất sửa code — xem thẻ bên dưới)</span>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              {showEvolveHere && pendingEvolve && onApproveEvolve && onRejectEvolve && (
                <div className="w-full max-w-[85%] mt-1">
                  <EvolveCard
                    args={pendingEvolve.args}
                    rationale={pendingEvolve.rationale}
                    originalContent={pendingEvolve.originalContent}
                    logId={pendingEvolve.logId}
                    isDispatching={pendingEvolve.isDispatching}
                    onApprove={onApproveEvolve}
                    onReject={onRejectEvolve}
                  />
                </div>
              )}
            </div>
          );
        })}

        {isStreaming && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-muted/60">
              <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: renderContent(stripToolJson(streamingContent) || "(Đang phân tích…)") }} />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-3 bg-muted/60 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-3 bg-muted/60 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang đọc đính kèm...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-3 space-y-2">
        {hasAttachments && (
          <div className="flex flex-wrap gap-2 p-2 rounded-md border border-dashed border-border bg-background/60">
            {pendingImages.map((url, i) => (
              <div key={`img-${i}`} className="relative">
                <img src={url} alt={`Ảnh ${i + 1}`} className="h-16 w-16 object-cover rounded-md border border-border" />
                <button
                  type="button"
                  onClick={() => setPendingImages((p) => p.filter((_, x) => x !== i))}
                  className="absolute -top-2 -right-2 p-0.5 bg-destructive text-destructive-foreground rounded-full shadow"
                  aria-label="Gỡ ảnh"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {pendingDocs.map((doc, i) => (
              <div key={`doc-${i}`} className="relative flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background max-w-[240px]">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{doc.fileName}</div>
                  <div className="text-[10px] text-muted-foreground">{(doc.size / 1024).toFixed(1)} KB</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingDocs((p) => p.filter((_, x) => x !== i))}
                  className="absolute -top-2 -right-2 p-0.5 bg-destructive text-destructive-foreground rounded-full shadow"
                  aria-label="Gỡ tài liệu"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="text-[10px] text-muted-foreground w-full flex items-center gap-2">
              <ImageIcon className="h-3 w-3" /> {pendingImages.length}/{MAX_IMAGES}
              <span>·</span>
              <FileText className="h-3 w-3" /> {pendingDocs.length}/{MAX_DOCS}
              <span>— Angel sẽ đọc từng đính kèm khi gửi</span>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
          <input ref={docInputRef} type="file" accept={ACCEPT_ATTR} multiple onChange={handleDocSelect} className="hidden" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 h-[44px] w-[44px]"
            onClick={() => imageInputRef.current?.click()}
            disabled={busy || pendingImages.length >= MAX_IMAGES}
            title="Đính kèm ảnh (hoặc Ctrl+V để dán)"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0 h-[44px] w-[44px]"
            onClick={() => docInputRef.current?.click()}
            disabled={busy || pendingDocs.length >= MAX_DOCS}
            title="Đính kèm tài liệu (PDF, DOCX, XLSX, TXT…)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask Angel AI... (Ctrl+V dán ảnh, đính kèm tài liệu)"
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
            disabled={busy}
          />
          <Button
            onClick={handleSend}
            disabled={(!input.trim() && !hasAttachments) || busy}
            size="icon"
            className="shrink-0 h-[44px] w-[44px]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

    </div>
  );
}
