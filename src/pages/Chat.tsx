import { useState, useRef, useEffect, useCallback } from "react";
import { smartBack } from "@/lib/smartBack";
import { stripMarkdown } from "@/lib/stripMarkdown";
import { getPlainTextForClipboard, isInlineImageSrc } from "@/lib/clipboardText";

import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, Send, Square, Sparkles, Lock, Coins, Heart, Copy, Share2, 
  ImagePlus, Camera, Wand2, X, Download, Loader2, MessageSquare,
  History, FolderOpen, Plus, Volume2, Image, Menu, Pencil, ArrowDown,
  Paperclip, BookmarkPlus
} from "lucide-react";

import { MessageFeedback } from "@/components/chat/MessageFeedback";
import { TimeoutMessage } from "@/components/TimeoutMessage";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import angelAvatar from "@/assets/angel-avatar.png";
import angelAiLogo from "@/assets/angel-ai-logo.png";
import ChatRewardNotification from "@/components/ChatRewardNotification";
import ChatShareDialog from "@/components/ChatShareDialog";
import EarlyAdopterRewardPopup from "@/components/EarlyAdopterRewardPopup";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatSessionsSidebar } from "@/components/chat/ChatSessionsSidebar";
import { ImageHistorySidebar } from "@/components/chat/ImageHistorySidebar";
import { AudioButton } from "@/components/chat/AudioButton";
import { useCamlyCoin } from "@/hooks/useCamlyCoin";
import { useExtendedRewardStatus } from "@/hooks/useExtendedRewardStatus";
import { useImageGeneration, IMAGE_SIZE_OPTIONS, type ImageSize } from "@/hooks/useImageGeneration";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { useImageEdit } from "@/hooks/useImageEdit";
import { useEarlyAdopterReward } from "@/hooks/useEarlyAdopterReward";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useChatFolders } from "@/hooks/useChatFolders";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useImageHistory } from "@/hooks/useImageHistory";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileAttachmentPreview, FileMessageCard, type AttachedFile } from "@/components/chat/FileAttachmentPreview";
import { SignupPromptDialog } from "@/components/SignupPromptDialog";
import {
  MAX_CHAT_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_TOTAL_BYTES,
  type ChatImage,
  makeImageId,
  readFileAsDataUrl,
  uploadChatImage,
} from "@/lib/chatImageUpload";
import { angelChatUrl } from "@/lib/angelEndpoint";
import { formatUrantiaCitations } from "@/lib/urantia/citation";
import type { UrantiaCitation } from "@/lib/urantia/types";
interface Message {
  role: "user" | "assistant";
  content: string;
  type?: "text" | "image" | "image-analysis";
  imageUrl?: string;
  imageUrls?: string[];
  attachment?: AttachedFile;
  meta?: {
    continued?: boolean;
    truncated?: boolean;
    canContinue?: boolean;
    part?: number;
    maxParts?: number;
    continueDeclined?: boolean;
  };

}

interface RewardData {
  coins: number;
  purityScore: number;
  message: string;
  questionsRemaining: number;
}

interface ShareDialogState {
  isOpen: boolean;
  question: string;
  answer: string;
}

type ChatMode = "chat" | "generate-image" | "analyze-image" | "edit-image";

const CHAT_URL = angelChatUrl(import.meta.env.VITE_SUPABASE_URL);

const Chat = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, session, isLoading: authLoading, isAdmin } = useAuth();
  const { t } = useLanguage();
  const { dailyStatus, refreshBalance } = useCamlyCoin();
  const { sharesRewarded, sharesRemaining, refreshStatus: refreshExtendedStatus } = useExtendedRewardStatus();
  const { 
    showRewardPopup: showEarlyAdopterPopup, 
    rewardResult: earlyAdopterResult, 
    incrementQuestionCount, 
    dismissRewardPopup: dismissEarlyAdopterPopup 
  } = useEarlyAdopterReward();
  const { saveToHistory: saveToChatHistory } = useChatHistory();
  
  // Chat sessions & folders
  const {
    sessions,
    currentSession,
    sessionMessages,
    createSession,
    updateSession,
    deleteSession,
    selectSession,
    endCurrentSession,
    fetchSessionMessages,
  } = useChatSessions();
  
  const {
    folders,
    createFolder,
    updateFolder,
    deleteFolder,
  } = useChatFolders();

  // Image history
  const {
    history: imageHistory,
    isLoading: imageHistoryLoading,
    saveToHistory: saveToImageHistory,
    deleteFromHistory: deleteFromImageHistory,
  } = useImageHistory();

  // Sidebar states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showImageHistorySidebar, setShowImageHistorySidebar] = useState(false);
  
  const [hasAgreed, setHasAgreed] = useState<boolean | null>(null);
  const [userResponseStyle, setUserResponseStyle] = useState<string>("detailed");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: t("chat.welcome"),
      type: "text"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentReward, setCurrentReward] = useState<RewardData | null>(null);
  const [hasProcessedQuery, setHasProcessedQuery] = useState(false);
  const [shareDialog, setShareDialog] = useState<ShareDialogState>({
    isOpen: false,
    question: "",
    answer: ""
  });
  const [chatMode, setChatMode] = useState<ChatMode>("chat");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState<"spiritual" | "realistic" | "artistic">("spiritual");
  const [imageMode, setImageMode] = useState<"fast" | "spiritual">("fast");
  const [imageSize, setImageSize] = useState<ImageSize>("square");
  const [showImageActionDialog, setShowImageActionDialog] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  // Multi-image attachment (up to MAX_CHAT_IMAGES) for chat mode
  const [chatImages, setChatImages] = useState<ChatImage[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const { isGenerating, generateImage } = useImageGeneration();
  const { isAnalyzing, analyzeImage } = useImageAnalysis();
  const { isEditing, editImage } = useImageEdit();
  const { isLoading: ttsLoading, isPlaying: ttsPlaying, currentMessageId: ttsMessageId, playText, stopAudio } = useTextToSpeech();

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  }, []);

  // Track scroll position to show/hide scroll-to-bottom button
  const recomputeShowScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const overflowing = scrollHeight - clientHeight > 40;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollToBottom(overflowing && distanceFromBottom > 200);
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    let raf = 0;
    const handleScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recomputeShowScroll);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(raf);
    };
  }, [recomputeShowScroll]);



  // Helper to find the question for an assistant message
  const getQuestionForAnswer = (answerIndex: number): string => {
    for (let i = answerIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return messages[i].content;
      }
    }
    return "";
  };

  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to convert blob to data URL"));
      reader.readAsDataURL(blob);
    });

  const loadImage = (src: string, crossOrigin?: "anonymous") =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new window.Image();
      if (crossOrigin) image.crossOrigin = crossOrigin;
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = src;
    });

  const toInlineImageSrc = async (src: string) => {
    if (!src) return "";
    if (src.startsWith("data:")) return src;

    try {
      const image = await loadImage(src, "anonymous");
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Failed to create image canvas");
      ctx.drawImage(image, 0, 0);
      return canvas.toDataURL("image/png");
    } catch {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("Failed to fetch image source");
        const blob = await response.blob();
        return await blobToDataUrl(blob);
      } catch {
        return src;
      }
    }
  };

  const createBrandedClipboardPng = async (message: Message, cleanText: string) => {
    if (typeof ClipboardItem === "undefined") return null;

    try {
      const logoSrc = angelAiLogo;
      const logoImg = await loadImage(logoSrc, "anonymous");

      const maxWidth = 1080;
      const padding = 44;
      const contentWidth = maxWidth - padding * 2;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const text = cleanText || "Angel AI";
      ctx.font = "500 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

      const lines: string[] = [];
      text.split("\n").forEach((paragraph) => {
        if (!paragraph.trim()) {
          lines.push("");
          return;
        }
        const words = paragraph.split(" ");
        let current = "";
        for (const word of words) {
          const test = current ? `${current} ${word}` : word;
          if (ctx.measureText(test).width > contentWidth && current) {
            lines.push(current);
            current = word;
          } else {
            current = test;
          }
        }
        if (current) lines.push(current);
      });

      const lineHeight = 48;
      const textHeight = Math.max(lines.length * lineHeight, 52);

      let generatedImage: HTMLImageElement | null = null;
      if (message.imageUrl) {
        try {
          generatedImage = await loadImage(
            message.imageUrl,
            message.imageUrl.startsWith("data:") ? undefined : "anonymous"
          );
        } catch {
          generatedImage = null;
        }
      }

      const imageHeight = generatedImage
        ? Math.min(620, (generatedImage.naturalHeight / generatedImage.naturalWidth) * contentWidth)
        : 0;

      const headerHeight = 86;
      const footerHeight = 92;
      const spacing = 24;
      const totalHeight = Math.ceil(
        padding + headerHeight + textHeight + (imageHeight ? spacing + imageHeight : 0) + spacing + footerHeight + padding
      );

      canvas.width = maxWidth;
      canvas.height = totalHeight;

      // Background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Main content
      let y = padding + 16;
      ctx.fillStyle = "#1f2937";
      ctx.font = "500 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      for (const line of lines) {
        if (!line) {
          y += lineHeight * 0.55;
        } else {
          ctx.fillText(line, padding, y + lineHeight * 0.75);
          y += lineHeight;
        }
      }

      if (generatedImage && imageHeight > 0) {
        y += 8;
        ctx.save();
        ctx.beginPath();
        const radius = 24;
        const imageY = y;
        ctx.moveTo(padding + radius, imageY);
        ctx.lineTo(padding + contentWidth - radius, imageY);
        ctx.quadraticCurveTo(padding + contentWidth, imageY, padding + contentWidth, imageY + radius);
        ctx.lineTo(padding + contentWidth, imageY + imageHeight - radius);
        ctx.quadraticCurveTo(padding + contentWidth, imageY + imageHeight, padding + contentWidth - radius, imageY + imageHeight);
        ctx.lineTo(padding + radius, imageY + imageHeight);
        ctx.quadraticCurveTo(padding, imageY + imageHeight, padding, imageY + imageHeight - radius);
        ctx.lineTo(padding, imageY + radius);
        ctx.quadraticCurveTo(padding, imageY, padding + radius, imageY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(generatedImage, padding, imageY, contentWidth, imageHeight);
        ctx.restore();
        y += imageHeight;
      }

      y += spacing;

      // Divider
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + contentWidth, y);
      ctx.stroke();

      // Signature
      y += 22;
      const logoSize = 40;
      ctx.save();
      ctx.beginPath();
      ctx.arc(padding + logoSize / 2, y + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(padding, y, logoSize, logoSize);
      ctx.drawImage(logoImg, padding, y, logoSize, logoSize);
      ctx.restore();

      ctx.fillStyle = "#b58400";
      ctx.font = "700 24px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText("Angel AI", padding + logoSize + 12, y + 18);
      ctx.fillStyle = "#6b7280";
      ctx.font = "500 17px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText("FUN Ecosystem", padding + logoSize + 12, y + 40);

      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    } catch {
      return null;
    }
  };

  // iOS-friendly fallback: works on Safari mobile where Clipboard API is restricted
  const legacyCopy = (text: string): boolean => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.contentEditable = "true";
      // Keep on-screen but invisible — iOS won't select offscreen elements
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "1px";
      textarea.style.height = "1px";
      textarea.style.padding = "0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);

      // iOS-specific selection
      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      textarea.setSelectionRange(0, text.length);

      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      selection?.removeAllRanges();
      return ok;
    } catch {
      return false;
    }
  };

  const isMobileDevice = () =>
    isMobile ||
    (typeof navigator !== "undefined" &&
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

  const handleSaveToKnowledge = async (message: Message, index: number) => {
    if (!isAdmin) return;
    const answer = (message.content || "").trim();
    if (!answer || answer.length < 40) {
      toast.error("Câu trả lời quá ngắn để lưu (≥40 ký tự).");
      return;
    }
    const question = getQuestionForAnswer(index);
    const toastId = toast.loading("Đang lưu vào knowledge…");
    try {
      const { data, error } = await supabase.functions.invoke("knowledge-save-chat", {
        body: { question, answer, language: "vi" },
      });
      if (error) throw error;
      if (data?.duplicate) toast.info("Đã có trong knowledge (dedup).", { id: toastId });
      else toast.success(`Đã lưu: ${data?.title ?? "OK"}`, { id: toastId });
    } catch (e: any) {
      toast.error(`Lỗi lưu: ${e?.message ?? "unknown"}`, { id: toastId });
    }
  };

  const handleCopyMessage = async (message: Message) => {
    const signatureText = "🌟 Angel AI — FUN Ecosystem";
    const cleanText = stripMarkdown(message.content || "").trim();
    // Never inline base64/blob images into the clipboard payload.
    const hasCopyImage = !!message.imageUrl && !isInlineImageSrc(message.imageUrl);
    const plainText = getPlainTextForClipboard(message, { signature: signatureText });


    // 1) Mobile path — go straight for plain text within user gesture.
    //    Rich HTML copy via ClipboardItem requires async image fetching,
    //    which loses user-activation on iOS Safari and silently fails.
    if (isMobileDevice()) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(plainText);
          toast.success(t("chat.copied"));
          return;
        }
      } catch {
        // fall through to legacy
      }
      if (legacyCopy(plainText)) {
        toast.success(t("chat.copied"));
      } else {
        toast.error(t("chat.copyError"));
      }
      return;
    }

    // 2) Desktop path — try rich HTML copy for assistant messages
    try {
      if (message.role === "assistant" && typeof ClipboardItem !== "undefined") {
        try {
          const logoSource = angelAiLogo;
          const [inlineLogoSrc, inlineMessageImageSrc] = await Promise.all([
            toInlineImageSrc(logoSource),
            hasCopyImage && message.imageUrl ? toInlineImageSrc(message.imageUrl) : Promise.resolve(""),
          ]);

          const textHtml = cleanText
            ? `<p style="white-space:pre-wrap;margin:0 0 12px 0;">${escapeHtml(cleanText).replace(/\n/g, "<br>")}</p>`
            : "";
          const imageHtml = inlineMessageImageSrc
            ? `<div style="margin:0 0 12px 0;"><img src="${inlineMessageImageSrc}" alt="Angel AI Generated" style="max-width:100%;border-radius:12px;display:block;" /></div>`
            : "";

          const htmlContent = `
            <div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#333;">
              ${textHtml}
              ${imageHtml}
              <table cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e5e5;padding-top:8px;margin-top:8px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <div style="width:28px;height:28px;border-radius:9999px;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #f1f1f1;">
                      <img src="${inlineLogoSrc}" alt="Angel AI" width="28" height="28" style="display:block;background:#ffffff;" />
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <strong style="color:#d4a017;font-size:13px;">Angel AI</strong>
                    <br><span style="color:#888;font-size:11px;">FUN Ecosystem</span>
                  </td>
                </tr>
              </table>
            </div>`;

          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([htmlContent], { type: "text/html" }),
              "text/plain": new Blob([plainText], { type: "text/plain" }),
            }),
          ]);
          toast.success(t("chat.copied"));
          return;
        } catch {
          // fall through to plain text
        }
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(plainText);
      } else if (!legacyCopy(plainText)) {
        throw new Error("Clipboard unavailable");
      }
      toast.success(t("chat.copied"));
    } catch {
      if (legacyCopy(plainText)) {
        toast.success(t("chat.copied"));
      } else {
        toast.error(t("chat.copyError"));
      }
    }
  };

  const handleOpenShare = (answerIndex: number, answerContent: string) => {
    const question = getQuestionForAnswer(answerIndex);
    setShareDialog({
      isOpen: true,
      question,
      answer: answerContent,
    });
  };

  // Add multiple files to the chatImages preview strip (chat mode) with upload
  const addChatImageFiles = useCallback(async (rawFiles: File[]) => {
    const imageFiles = rawFiles.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error(t("chat.fileImageOnly") || "Chỉ hỗ trợ tệp ảnh");
      return;
    }

    // Enforce total slot count
    const currentCount = chatImages.length;
    const availableSlots = MAX_CHAT_IMAGES - currentCount;
    if (availableSlots <= 0) {
      toast.error(`Tối đa ${MAX_CHAT_IMAGES} ảnh / tin nhắn`);
      return;
    }

    const accepted: File[] = [];
    let totalBytes = chatImages.reduce((sum) => sum, 0); // preview strip bytes unknown; just enforce per-file
    for (const f of imageFiles) {
      if (f.size > MAX_IMAGE_BYTES) {
        toast.error(`"${f.name}" vượt quá 10MB — bỏ qua`);
        continue;
      }
      totalBytes += f.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        toast.error(`Tổng dung lượng vượt 50MB — bỏ qua các ảnh còn lại`);
        break;
      }
      accepted.push(f);
      if (accepted.length >= availableSlots) break;
    }

    if (imageFiles.length > accepted.length) {
      toast.message(`Đã thêm ${accepted.length} ảnh, giới hạn ${MAX_CHAT_IMAGES}/tin nhắn`);
    }

    // Insert placeholders with local preview
    const newItems: ChatImage[] = [];
    for (const f of accepted) {
      const previewUrl = await readFileAsDataUrl(f);
      newItems.push({
        id: makeImageId(),
        previewUrl,
        status: "uploading",
        fileName: f.name,
      });
    }
    setChatImages((prev) => [...prev, ...newItems]);

    // Upload in parallel with per-image status updates
    await Promise.all(
      accepted.map(async (file, idx) => {
        const item = newItems[idx];
        try {
          const publicUrl = await uploadChatImage(file, user?.id);
          setChatImages((prev) =>
            prev.map((ci) => (ci.id === item.id ? { ...ci, status: "ready", url: publicUrl } : ci)),
          );
        } catch (err: any) {
          console.error("Chat image upload failed:", err);
          setChatImages((prev) =>
            prev.map((ci) =>
              ci.id === item.id ? { ...ci, status: "error", error: err?.message || "upload_failed" } : ci,
            ),
          );
          toast.error(`Không tải được ảnh "${file.name}"`);
        }
      }),
    );
  }, [chatImages, t, user?.id]);

  const removeChatImage = useCallback((id: string) => {
    setChatImages((prev) => prev.filter((ci) => ci.id !== id));
  }, []);

  const clearChatImages = useCallback(() => setChatImages([]), []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    // Multi-image path: only when in default chat mode
    if (chatMode === "chat" && (files.length > 1 || chatImages.length > 0)) {
      addChatImageFiles(files);
      return;
    }

    // Single-image path (analyze / edit dialog)
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      toast.error(t("chat.fileImageOnly"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("chat.fileTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPendingImage(dataUrl);
      setShowImageActionDialog(true);
    };
    reader.readAsDataURL(file);
  };

  // Xử lý paste ảnh vào ô chat (Ctrl/Cmd+V) — hỗ trợ nhiều ảnh trong 1 lần paste
  const handlePasteImage = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length === 0) return;
    e.preventDefault();

    // In chat mode → append to multi-image strip
    if (chatMode === "chat") {
      addChatImageFiles(files);
      toast.success(files.length > 1 ? `Đã dán ${files.length} ảnh ✨` : "Đã dán ảnh ✨");
      return;
    }

    // Otherwise keep the single-image dialog behavior
    const file = files[0];
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(t("chat.fileTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPendingImage(dataUrl);
      setShowImageActionDialog(true);
      toast.success("Đã dán ảnh — chọn hành động bạn nhé ✨");
    };
    reader.readAsDataURL(file);
  };

  // Kéo-thả nhiều ảnh vào khung tin nhắn (chỉ ở chế độ chat)
  const handleDropImages = (e: React.DragEvent) => {
    if (chatMode !== "chat") return;
    const files = Array.from(e.dataTransfer?.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    e.preventDefault();
    addChatImageFiles(files);
  };


  const ACCEPTED_FILE_TYPES = "image/*,audio/*,video/mp4,video/webm,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.js,.ts,.tsx,.jsx,.py,.html,.css,.json,.md,.sol,.yaml,.yml,.xml,.go,.rs,.java,.c,.cpp,.h,.swift,.kt,.rb,.php,.sh,.sql";
  
  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = file.type.startsWith("video/") ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(file.type.startsWith("video/") ? "Video không được vượt quá 50MB" : "File không được vượt quá 20MB");
      e.target.value = "";
      return;
    }

    setIsUploadingAttachment(true);
    
    // Create preview for images
    let previewUrl: string | undefined;
    if (file.type.startsWith("image/")) {
      previewUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    try {
      if (!user?.id) {
        throw new Error("auth_required_for_chat_attachment");
      }
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("chat-attachments")
        .getPublicUrl(fileName);

      setAttachedFile({
        name: file.name,
        type: file.type,
        size: file.size,
        url: publicUrl,
        previewUrl,
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Lỗi khi tải file lên. Vui lòng thử lại.");
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const handleSelectImageAction = (action: "analyze" | "edit") => {
    if (!pendingImage) return;

    setUploadedImage(pendingImage);
    setChatMode(action === "analyze" ? "analyze-image" : "edit-image");
    setShowImageActionDialog(false);
    setPendingImage(null);
  };

  const handleDownloadImage = async (imageUrl: string) => {
    try {
      // Always render through canvas so watermark is burned into exported image
      const [img, watermarkImg] = await Promise.all([
        loadImage(imageUrl, imageUrl.startsWith("data:") ? undefined : "anonymous"),
        loadImage(angelAiLogo, "anonymous"),
      ]);

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Cannot create canvas context");

      ctx.drawImage(img, 0, 0);

      // Draw watermark — adaptive to all aspect ratios
      const shortSide = Math.min(img.naturalWidth, img.naturalHeight);
      const wmSize = Math.max(28, Math.floor(shortSide * 0.05));
      const fontSize = Math.max(14, Math.floor(wmSize * 0.6));
      const padding = Math.floor(wmSize * 0.5);
      const gap = Math.floor(wmSize * 0.3);

      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      const textWidth = ctx.measureText("Angel AI").width;

      const pillH = wmSize + 12;
      const pillW = wmSize + gap + textWidth + padding * 2;
      const pillX = img.naturalWidth - pillW - padding;
      const pillY = img.naturalHeight - pillH - padding;

      // Semi-transparent pill background
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();

      // Logo (circular clip)
      const logoX = pillX + padding;
      const logoY = pillY + (pillH - wmSize) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + wmSize / 2, logoY + wmSize / 2, wmSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(watermarkImg, logoX, logoY, wmSize, wmSize);
      ctx.restore();

      // Text
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText("Angel AI", logoX + wmSize + gap, pillY + pillH / 2);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error("Cannot create blob"));
            return;
          }
          resolve(result);
        }, "image/png");
      });

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `angel-ai-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast.success("Đã tải hình ảnh thành công!");
    } catch (error) {
      console.error("Download error:", error);
      try {
        window.open(imageUrl, "_blank");
        toast.info("Hình ảnh đã mở trong tab mới. Nhấn giữ để lưu về thiết bị.");
      } catch {
        toast.error("Không thể tải hình ảnh. Vui lòng thử lại.");
      }
    }
  };

  // Check if user has agreed to Light Law and fetch response style
  useEffect(() => {
    const checkAgreementAndProfile = async () => {
      if (!user) {
        setHasAgreed(false);
        return;
      }
      
      // Create timeout promise for fallback
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 10000)
      );
      
      try {
        // Race agreement check with timeout
        const agreementResult = await Promise.race([
          supabase
            .from("user_light_agreements")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle(),
          timeoutPromise
        ]);
        
        setHasAgreed(!!(agreementResult as any)?.data);
        
        // Fetch user's response style preference (non-blocking)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("response_style")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profileData?.response_style) {
          setUserResponseStyle(profileData.response_style);
          console.log("User response style:", profileData.response_style);
        }
      } catch (error) {
        console.error("Agreement check failed/timeout:", error);
        // Fallback: allow access, user will be asked to agree if needed
        setHasAgreed(false);
      }
    };

    if (!authLoading) {
      checkAgreementAndProfile();
    }
  }, [user, authLoading]);

  // Track scroll behavior around new messages:
  // - New user message → scroll to bottom
  // - While streaming → follow bottom only if user is already near bottom
  // - When assistant finishes → scroll to the START of the newest assistant reply
  const prevMessagesLength = useRef(messages.length);
  const prevIsLoading = useRef(isLoading);
  const streamingAssistantIndex = useRef<number | null>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;
    const lastIndex = messages.length - 1;
    const last = messages[lastIndex];
    const grew = messages.length > prevMessagesLength.current;

    if (grew && last?.role === "user") {
      scrollToBottom("smooth");
    } else if (grew && last?.role === "assistant") {
      streamingAssistantIndex.current = lastIndex;
    } else if (container && last?.role === "assistant" && (isLoading || isGenerating || isAnalyzing)) {
      // Follow stream only if user is already near bottom
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 120) {
        scrollToBottom("auto");
      }
    }

    prevMessagesLength.current = messages.length;
  }, [messages, isLoading, isGenerating, isAnalyzing, scrollToBottom]);

  // When generation finishes → scroll to the start of the latest assistant reply
  useEffect(() => {
    const busy = isLoading || isGenerating || isAnalyzing;
    if (prevIsLoading.current && !busy) {
      const targetIndex = streamingAssistantIndex.current;
      if (targetIndex != null) {
        // Wait for DOM to finalize
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(
            `[data-message-index="${targetIndex}"]`
          );
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          streamingAssistantIndex.current = null;
        });
      }
    }
    prevIsLoading.current = busy;
    // Recompute button visibility after messages settle
    requestAnimationFrame(recomputeShowScroll);
  }, [isLoading, isGenerating, isAnalyzing, messages.length, currentSession?.id, recomputeShowScroll]);



  // Load session messages when session changes
  useEffect(() => {
    if (currentSession && sessionMessages.length > 0) {
      const loadedMessages: Message[] = [
        { role: "assistant", content: t("chat.welcome"), type: "text" }
      ];
      
      sessionMessages.forEach(msg => {
        loadedMessages.push({ role: "user", content: msg.question_text, type: "text" });
        loadedMessages.push({ role: "assistant", content: msg.answer_text, type: "text" });
      });
      
      setMessages(loadedMessages);
    } else if (!currentSession) {
      // Reset to welcome message when no session
      setMessages([{ role: "assistant", content: t("chat.welcome"), type: "text" }]);
    }
  }, [currentSession, sessionMessages, t]);

  // Handle new session creation
  const handleNewSession = async () => {
    await endCurrentSession();
    setMessages([{ role: "assistant", content: t("chat.welcome"), type: "text" }]);
    toast.success("Bắt đầu cuộc trò chuyện mới");
  };

  // Handle save session title
  const handleSaveTitle = async () => {
    if (!currentSession || !editingTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }
    const trimmed = editingTitle.trim();
    if (trimmed === currentSession.title) {
      setIsEditingTitle(false);
      return;
    }
    const success = await updateSession(currentSession.id, { title: trimmed });
    if (success) {
      toast.success("Đã cập nhật tiêu đề");
    } else {
      toast.error("Không thể cập nhật tiêu đề");
    }
    setIsEditingTitle(false);
  };
  // Auto-focus title input when editing
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);


  const streamChat = async (
    userMessages: Message[],
    userResponseStyle?: string,
    attachment?: AttachedFile,
    imageUrls?: string[],
    continueOpts?: { continueFrom: string; continuePart: number },
  ): Promise<string> => {
    const showCitationsPref = typeof window !== "undefined" && localStorage.getItem("angel_show_citations") === "true";
    const body: any = { 
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
      responseStyle: userResponseStyle || 'detailed',
      showCitations: showCitationsPref,
      // Không tự nối tiếp âm thầm — hỏi người dùng bằng nút bấm
      askBeforeContinue: true,
    };
    if (continueOpts) {
      body.continueFrom = continueOpts.continueFrom;
      body.continuePart = continueOpts.continuePart;
    }

    if (attachment?.url) {
      body.attachment = { url: attachment.url, type: attachment.type, name: attachment.name };
    }
    if (imageUrls && imageUrls.length > 0) {
      body.imageUrls = imageUrls.slice(0, MAX_CHAT_IMAGES);
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      if (resp.status === 429) {
        throw new Error(errorData.error || t("common.error"));
      }
      if (resp.status === 402) {
        throw new Error(errorData.error || t("common.error"));
      }
      throw new Error(errorData.error || t("common.error"));
    }

    if (!resp.body) throw new Error(t("common.error"));

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";
    let streamMeta: Message["meta"] = {};

    setMessages(prev => [...prev, { role: "assistant", content: "", type: "text", meta: continueOpts ? { part: continueOpts.continuePart } : undefined }]);


    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "validated_citations") {
              const rendered = formatUrantiaCitations((parsed.validated_citations || []) as UrantiaCitation[]);
              if (rendered.length) assistantContent = `${assistantContent.replace(/\[\[[A-Za-z0-9_-]+\]\]/g, "").replace(/\[(?:Paper \d+|Foreword) · Section [^\]]+\]/g, "").trim()}\n\n${rendered.join(" ")}`;
              setMessages(prev => {
                const updated=[...prev];
                updated[updated.length-1]={role:"assistant",content:assistantContent,type:"text",meta:streamMeta};
                return updated;
              });
              continue;
            }
            // Server-side continuation marker (sent at end of stream)
            if (parsed.truncated !== undefined || parsed.continued !== undefined || parsed.canContinue !== undefined) {
              streamMeta = {
                continued: parsed.continued,
                truncated: parsed.truncated,
                canContinue: parsed.canContinue === true,
                part: parsed.part ?? continueOpts?.continuePart,
                maxParts: parsed.maxParts,
              };
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              // Do NOT strip U+FFFD — keep raw for corruption detection
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent, type: "text", meta: streamMeta };
                return updated;
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        // User stopped the stream — keep partial content, skip corruption fallback
        if (!assistantContent) {
          setMessages(prev => prev.slice(0, -1));
        }
        return assistantContent;
      }
      throw err;
    }
    
    // Apply final meta to the last message
    setMessages(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === "assistant") {
        updated[updated.length - 1] = { ...last, content: assistantContent, meta: streamMeta };
      }
      return updated;
    });
    
    // Corruption detection: fallback to non-stream if needed
    const hasCorruption = assistantContent.includes('\uFFFD') || /[a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]\?\?[a-zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(assistantContent);
    
    if (hasCorruption) {
      console.warn("⚠️ Corruption detected in chat stream — falling back to non-stream");
      try {
        const fallbackResp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            messages: userMessages.map(m => ({ role: m.role, content: m.content })),
            responseStyle: userResponseStyle || 'detailed',
            showCitations: showCitationsPref,
            stream: false,
            askBeforeContinue: true,
            ...(continueOpts ? { continueFrom: continueOpts.continueFrom, continuePart: continueOpts.continuePart } : {}),
          }),
        });
        if (fallbackResp.ok) {
          const fallbackData = await fallbackResp.json();
          if (fallbackData.content) {
            assistantContent = fallbackData.content;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: assistantContent,
                type: "text",
                meta: {
                  continued: fallbackData.continued,
                  truncated: fallbackData.truncated,
                  canContinue: fallbackData.canContinue === true,
                  part: fallbackData.part ?? continueOpts?.continuePart,
                  maxParts: fallbackData.maxParts,
                },
              };
              return updated;
            });
          }
        }

      } catch (fallbackErr) {
        console.error("Non-stream fallback failed:", fallbackErr);
      }
    }

    return assistantContent;
  };

  // ===== Gửi tiếp phần còn lại (có xác nhận của người dùng) =====
  const continuingRef = useRef(false);

  const clearPendingContinue = useCallback(() => {
    setMessages(prev =>
      prev.some(m => m.meta?.canContinue)
        ? prev.map(m => (m.meta?.canContinue ? { ...m, meta: { ...m.meta, canContinue: false } } : m))
        : prev,
    );
  }, []);

  const handleContinue = useCallback(async () => {
    if (isLoading || continuingRef.current) return;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (!last || last.role !== "assistant" || !last.meta?.canContinue || !last.content) return;

    continuingRef.current = true;
    const nextPart = (last.meta.part ?? 1) + 1;
    // Ẩn khối xác nhận ngay lập tức (chống double-click)
    setMessages(prev => prev.map((m, i) => (i === lastIdx ? { ...m, meta: { ...m.meta, canContinue: false } } : m)));
    setIsLoading(true);
    try {
      const history = messages.slice(0, lastIdx);
      await streamChat(history, userResponseStyle, undefined, undefined, {
        continueFrom: last.content,
        continuePart: nextPart,
      });
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Continue error:", error);
        toast.error(error instanceof Error ? error.message : t("common.error"));
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      continuingRef.current = false;
    }
  }, [messages, isLoading, userResponseStyle, t]);

  const handleDeclineContinue = useCallback(() => {
    setMessages(prev =>
      prev.map((m, i) =>
        i === prev.length - 1 && m.role === "assistant"
          ? { ...m, meta: { ...m.meta, canContinue: false, continueDeclined: true } }
          : m,
      ),
    );
    toast.message("Cảm ơn bạn 💛 Khi cần phần còn lại, bạn nhắn “tiếp” nhé.");
  }, []);



  const analyzeAndReward = useCallback(async (questionText: string, aiResponse: string) => {
    if (!user) return;
    
    const maxRetries = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[analyzeAndReward] Attempt ${attempt}/${maxRetries} for question:`, questionText.substring(0, 50));
        
        const { data, error } = await supabase.functions.invoke("analyze-reward-question", {
          body: { questionText, aiResponse },
        });
        
        if (error) {
          console.error(`[analyzeAndReward] Function error on attempt ${attempt}:`, error);
          throw error;
        }
        
        console.log(`[analyzeAndReward] Response received:`, data);
        
        // Handle response recycling detection
        if (data?.isResponseRecycled) {
          toast.info(data.message, {
            duration: 8000,
            icon: "💫",
            style: {
              background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
              border: "1px solid #f59e0b",
              color: "#92400e",
            }
          });
          // Still update remaining questions count
          if (data.questionsRemaining !== undefined) {
            setCurrentReward({
              coins: 0,
              purityScore: 0,
              message: data.message,
              questionsRemaining: data.questionsRemaining,
            });
          }
          return;
        }
        
        if (data?.rewarded) {
          setCurrentReward({
            coins: data.coins,
            purityScore: data.purityScore,
            message: data.message,
            questionsRemaining: data.questionsRemaining,
          });
          refreshBalance();
          
          // Early adopter count is now incremented server-side in analyze-reward-question
          // Just refresh the status to get updated count
          if (!data.isGreeting && !data.isSpam && !data.isDuplicate) {
            // Status will be refreshed through the hook's subscription
          }
        } else if (data?.reason) {
          // Show info for non-rewarded cases (greeting, spam, daily limit, etc.)
          console.log(`[analyzeAndReward] Not rewarded - reason: ${data.reason}`);
        }
        
        // Success - exit retry loop
        return;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`[analyzeAndReward] Attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait 2 seconds before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    // All retries exhausted
    console.error("[analyzeAndReward] All retry attempts failed:", lastError);
    toast.error("Không thể xử lý thưởng. Vui lòng thử lại sau.", {
      duration: 5000,
    });
  }, [user, refreshBalance]);

  // Image generation - saves to IMAGE history (separate from chat history)
  const handleGenerateImage = async (prompt: string) => {
    setMessages(prev => [...prev, { role: "user", content: `🎨 ${t("chat.createImage")} ${prompt}`, type: "text" }]);
    setMessages(prev => [...prev, { role: "assistant", content: t("chat.creatingImage"), type: "text" }]);
    
    try {
      const result = await generateImage(prompt, imageStyle, imageMode, imageSize);
      
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: result.description || t("chat.imageCreated"),
          type: "image",
          imageUrl: result.imageUrl
        };
        return updated;
      });
      
      // Save to IMAGE history (not chat history)
      if (user && result.imageUrl) {
        saveToImageHistory('generated', prompt, result.imageUrl, result.description, imageStyle);
      }
      
      toast.success(t("chat.imageCreated"));
    } catch (error: any) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `${t("chat.imageError")} ${error.message}`,
          type: "text"
        };
        return updated;
      });
      toast.error(error.message || t("chat.imageError"));
    }
  };

  // Image analysis - saves to IMAGE history (separate from chat history)
  const handleAnalyzeImage = async (question: string) => {
    if (!uploadedImage) return;
    
    const imageToAnalyze = uploadedImage; // Store before clearing

    setMessages(prev => [...prev, { 
      role: "user", 
      content: question || t("chat.analyzeDefault"), 
      type: "image-analysis",
      imageUrl: imageToAnalyze
    }]);
    setMessages(prev => [...prev, { role: "assistant", content: "", type: "text" }]);

    let analysisResult = "";
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await analyzeImage(imageToAnalyze, question, (text) => {
        analysisResult = text;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: text, type: "text" };
          return updated;
        });
      }, controller.signal);
      
      // Save to IMAGE history (not chat history)
      if (user && analysisResult) {
        saveToImageHistory('analyzed', question || t("chat.analyzeDefault"), imageToAnalyze, analysisResult);
      }
      
      setUploadedImage(null);
      setChatMode("chat");
    } catch (error: any) {
      if (error?.name === "AbortError") {
        // User stopped — keep partial content, drop empty assistant bubble
        if (!analysisResult) {
          setMessages(prev => prev.slice(0, -1));
        }
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `${t("chat.analyzeError")} ${error.message}`,
            type: "text"
          };
          return updated;
        });
        toast.error(error.message || t("chat.analyzeError"));
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Image editing - saves to IMAGE history (separate from chat history)
  const handleEditImage = async (instruction: string) => {
    if (!uploadedImage) return;
    
    const imageToEdit = uploadedImage; // Store before clearing

    setMessages(prev => [...prev, { 
      role: "user", 
      content: `✏️ ${t("chat.editImage")}: ${instruction}`, 
      type: "image-analysis",
      imageUrl: imageToEdit
    }]);
    setMessages(prev => [...prev, { role: "assistant", content: t("chat.editingImage"), type: "text" }]);

    try {
      const result = await editImage(imageToEdit, instruction, imageStyle);
      
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: result.description || t("chat.imageEdited"),
          type: "image",
          imageUrl: result.imageUrl
        };
        return updated;
      });
      
      // Save to IMAGE history (not chat history)
      if (user && result.imageUrl) {
        saveToImageHistory('generated', instruction, result.imageUrl, result.description, imageStyle);
      }
      
      setUploadedImage(null);
      setChatMode("chat");
      toast.success(t("chat.imageEdited"));
    } catch (error: any) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `${t("chat.editError")} ${error.message}`,
          type: "text"
        };
        return updated;
      });
      toast.error(error.message || t("chat.editError"));
    }
  };

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = messageText.trim();

    // Gõ "tiếp" khi đang có phần còn lại → đi qua đúng handler nối tiếp
    if (chatMode === "chat") {
      const lastMsg = messages[messages.length - 1];
      const wantsContinue = /^(tiếp|tiep|tiếp tục|tiep tuc|gửi tiếp|gui tiep|continue|go on)[.!\s]*$/i.test(userMessage);
      if (wantsContinue && lastMsg?.role === "assistant" && lastMsg.meta?.canContinue) {
        setInput("");
        await handleContinue();
        return;
      }
    }
    // Người dùng hỏi câu mới → khối "Gửi tiếp/Hủy" tự ẩn
    clearPendingContinue();



    if (chatMode === "generate-image") {
      setIsLoading(true);
      await handleGenerateImage(userMessage);
      setIsLoading(false);
      setChatMode("chat");
      return;
    }

    if (chatMode === "analyze-image" && uploadedImage) {
      setIsLoading(true);
      await handleAnalyzeImage(userMessage);
      setIsLoading(false);
      return;
    }

    if (chatMode === "edit-image" && uploadedImage) {
      setIsLoading(true);
      await handleEditImage(userMessage);
      setIsLoading(false);
      return;
    }
    
    // Guard against still-uploading images
    if (chatImages.some((ci) => ci.status === "uploading")) {
      toast.message("Đang tải ảnh lên — chờ chút bạn nhé ✨");
      return;
    }
    // Capture and clear attached file + images before sending
    const currentAttachment = attachedFile;
    const readyImages = chatImages.filter((ci) => ci.status === "ready" && ci.url);
    const imageUrls = readyImages.map((ci) => ci.url!) as string[];
    const previewUrls = readyImages.map((ci) => ci.url!);
    setAttachedFile(null);
    setChatImages([]);

    const userMsg: Message = {
      role: "user",
      content: userMessage,
      type: "text",
      attachment: currentAttachment || undefined,
      imageUrls: imageUrls.length > 0 ? previewUrls : undefined,
    };
    const newMessages: Message[] = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const assistantResponse = await streamChat(
        newMessages,
        userResponseStyle,
        currentAttachment || undefined,
        imageUrls,
      );
      
      // Create session if first message in new conversation
      let activeSessionId = currentSession?.id;
      if (!activeSessionId && user) {
        const newSession = await createSession(userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : ""));
        activeSessionId = newSession?.id;
      }
      
      // Save to chat history with session
      if (user && assistantResponse) {
        saveToChatHistory(userMessage, assistantResponse, {
          sessionId: activeSessionId,
        });
      }
      
      // Analyze and reward
      setTimeout(() => {
        analyzeAndReward(userMessage, assistantResponse);
      }, 500);
    } catch (error: any) {
      if (error?.name === "AbortError") {
        // User stopped — silent
      } else {
        console.error("Chat error:", error);
        toast.error(error instanceof Error ? error.message : t("common.error"));
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [messages, isLoading, chatMode, uploadedImage, attachedFile, chatImages, analyzeAndReward, t, user, userResponseStyle, currentSession, createSession, saveToChatHistory, handleContinue, clearPendingContinue]);


  useEffect(() => {
    const questionFromQuery = searchParams.get("q");
    const isSearchQuery = searchParams.get("isSearch") === "true";
    
    if (questionFromQuery && hasAgreed && !hasProcessedQuery && !isLoading) {
      setHasProcessedQuery(true);
      setSearchParams({}, { replace: true });
      
      // Add marker for edge function to detect search intent
      const finalMessage = isSearchQuery 
        ? `[SEARCH_INTENT] ${questionFromQuery}`
        : questionFromQuery;
        
      setTimeout(() => {
        sendMessage(finalMessage);
      }, 300);
    }
  }, [searchParams, hasAgreed, hasProcessedQuery, isLoading, sendMessage, setSearchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      // Guest chat: allow 5 messages, then show signup prompt
      const GUEST_KEY = "angel_ai_guest_chat_count";
      const count = parseInt(localStorage.getItem(GUEST_KEY) || "0", 10);
      if (count >= 5) {
        setShowSignupPrompt(true);
        return;
      }
      localStorage.setItem(GUEST_KEY, String(count + 1));
    }
    const hasImages = chatImages.length > 0;
    if ((!input.trim() && !hasImages) || isLoading || isGenerating || isAnalyzing) return;

    const userMessage = input.trim() || (hasImages ? "Hãy xem giúp mình những ảnh này nhé." : "");
    setInput("");
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    // Auto-clear image previews immediately upon send.
    // sendMessage's closure still captures the pre-clear chatImages/uploadedImage,
    // so the outgoing payload is unaffected.
    if (chatImages.length > 0) setChatImages([]);
    if (uploadedImage) setUploadedImage(null);
    await sendMessage(userMessage);
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  };

  // Access restricted - only if logged in but hasn't agreed to Light Law
  if (!authLoading && user && hasAgreed === false) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-pale via-background to-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-divine-gold/30 rounded-full blur-xl animate-pulse-divine" />
            <div className="relative w-24 h-24 rounded-full bg-divine-gold/10 flex items-center justify-center">
              <Lock className="w-12 h-12 text-divine-gold" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold bg-gradient-to-r from-divine-gold via-divine-light to-divine-gold bg-clip-text text-transparent">
            {t("chat.accessRestricted")}
          </h1>
          
          <p className="text-foreground-muted leading-relaxed">
            {t("chat.accessDescription")} <strong className="text-divine-gold">{t("chat.lawOfLight")}</strong>.
          </p>
          
          <div className="flex flex-col gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-sapphire-gradient text-primary-foreground font-medium shadow-sacred hover:shadow-divine transition-all duration-300"
            >
              <Sparkles className="w-5 h-5" />
              {t("chat.enterPortal")}
            </Link>
            
            <button onClick={() => smartBack(navigate)} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-foreground-muted hover:text-primary transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t("chat.backHome")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state with timeout message
  if (authLoading || hasAgreed === null) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-pale via-background to-background flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-divine-gold animate-pulse" />
          <span className="text-foreground-muted">{t("chat.connecting")}</span>
        </div>
        <TimeoutMessage 
          delay={10000}
          message="Kết nối đang chậm. Vui lòng đợi hoặc refresh trang."
        />
      </div>
    );
  }

  return (
    <>
    <div className="h-[100dvh] flex bg-gradient-to-b from-primary-pale via-background to-background overflow-hidden">
      <ChatRewardNotification 
        reward={currentReward} 
        onDismiss={() => setCurrentReward(null)} 
      />

      {/* Desktop Sidebar - Persistent */}
      <ChatSidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        sessions={sessions}
        folders={folders}
        currentSession={currentSession}
        onSelectSession={selectSession}
        onNewSession={handleNewSession}
        onDeleteSession={deleteSession}
        onUpdateSession={updateSession}
        imageHistoryCount={imageHistory.length}
        onOpenImageHistory={() => setShowImageHistorySidebar(true)}
      />

      {/* Mobile Sidebar Overlay */}
      <ChatSessionsSidebar
        isOpen={showMobileSidebar}
        onClose={() => setShowMobileSidebar(false)}
        sessions={sessions}
        folders={folders}
        currentSession={currentSession}
        onSelectSession={selectSession}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        onUpdateSession={updateSession}
        onCreateFolder={createFolder}
        onDeleteFolder={deleteFolder}
        onUpdateFolder={updateFolder}
      />

      {/* Image History Sidebar */}
      <ImageHistorySidebar
        isOpen={showImageHistorySidebar}
        onClose={() => setShowImageHistorySidebar(false)}
        history={imageHistory}
        isLoading={imageHistoryLoading}
        onDelete={deleteFromImageHistory}
      />

      {/* Early Adopter Reward Popup */}
      <EarlyAdopterRewardPopup
        isOpen={showEarlyAdopterPopup}
        coinsAwarded={earlyAdopterResult?.coinsAwarded || 0}
        userRank={earlyAdopterResult?.userRank || 0}
        onClose={dismissEarlyAdopterPopup}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Compact for mobile */}
        <header className="flex-shrink-0 bg-background-pure/90 backdrop-blur-lg border-b border-primary-pale shadow-soft safe-area-top">
          <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Mobile back button */}
                <button 
                  onClick={() => smartBack(navigate)}
                  className="lg:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-primary-pale hover:scale-110 active:scale-95 transition-all duration-300 group"
                >
                  <ArrowLeft className="w-5 h-5 text-primary group-hover:text-primary-deep group-hover:-translate-x-0.5 transition-all duration-300" />
                </button>

                {/* Mobile menu button */}
                <button 
                  onClick={() => setShowMobileSidebar(true)}
                  className="lg:hidden p-1.5 sm:p-2 rounded-full hover:bg-primary-pale hover:scale-110 active:scale-95 transition-all duration-300"
                >
                  <Menu className="w-5 h-5 text-primary" />
                </button>
                
                {/* Back button - desktop only when sidebar collapsed */}
                {sidebarCollapsed && !isMobile && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => navigate("/")}
                        className="p-1.5 sm:p-2 rounded-full hover:bg-primary-pale hover:scale-110 active:scale-95 transition-all duration-300 group"
                      >
                        <ArrowLeft className="w-5 h-5 text-primary group-hover:text-primary-deep group-hover:-translate-x-0.5 transition-all duration-300" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-primary-deep text-white">
                      <p>Về trang chủ</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                
                {/* Image gallery - mobile only */}
                <button 
                  onClick={() => setShowImageHistorySidebar(true)}
                  className="lg:hidden p-1.5 sm:p-2 rounded-full hover:bg-primary-pale hover:scale-110 active:scale-95 transition-all duration-300 group relative"
                >
                  <Image className="w-5 h-5 text-primary group-hover:text-primary-deep transition-all duration-300" />
                  {imageHistory.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-divine-gold text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {imageHistory.length > 99 ? '99+' : imageHistory.length}
                    </span>
                  )}
                </button>

                {/* Avatar and title */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="relative">
                    <img src={angelAvatar} alt="Angel AI" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-soft" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 border-2 border-white rounded-full"></span>
                  </div>
                  <div>
                    {currentSession && isEditingTitle ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={titleInputRef}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle();
                            if (e.key === 'Escape') setIsEditingTitle(false);
                          }}
                          onBlur={handleSaveTitle}
                          className="font-serif text-sm sm:text-base font-semibold text-primary-deep bg-primary-pale/50 border border-primary/30 rounded-md px-2 py-0.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 w-40 sm:w-64 max-w-[300px]"
                          maxLength={100}
                        />
                        <button onMouseDown={(e) => { e.preventDefault(); handleSaveTitle(); }} className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button onMouseDown={(e) => { e.preventDefault(); setIsEditingTitle(false); }} className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer flex items-center gap-1.5 group/title"
                        onClick={() => {
                          if (currentSession) {
                            setEditingTitle(currentSession.title);
                            setIsEditingTitle(true);
                          }
                        }}
                      >
                        <h1 className="font-serif text-sm sm:text-lg font-semibold text-primary-deep truncate max-w-[120px] sm:max-w-[250px]">
                          {currentSession ? currentSession.title : "Angel AI"}
                        </h1>
                        {currentSession && (
                          <Pencil className="w-3.5 h-3.5 text-primary/60 opacity-40 group-hover/title:opacity-100 transition-all duration-200 flex-shrink-0" />
                        )}
                      </div>
                    )}
                    <p className="hidden sm:block text-[10px] sm:text-xs text-foreground-muted">
                      {currentSession ? "Đang tiếp tục chủ đề" : t("chat.subtitle")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* New chat button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleNewSession}
                      className="p-1.5 sm:p-2 rounded-full hover:bg-primary-pale hover:scale-110 active:scale-95 transition-all duration-300 group"
                    >
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-primary group-hover:text-primary-deep transition-all duration-300" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-primary-deep text-white">
                    <p>Cuộc trò chuyện mới</p>
                  </TooltipContent>
                </Tooltip>
                {dailyStatus && (
                  <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-50 rounded-full border border-amber-200/50">
                    <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                    <span className="text-[10px] sm:text-xs text-amber-700 font-medium">{dailyStatus.questionsRemaining}/10</span>
                  </div>
                )}
                <Link to="/community" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-pink-50 rounded-full border border-pink-200/50 hover:bg-pink-100 transition-colors">
                  <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-500" />
                  <span className="text-[10px] sm:text-xs text-pink-700 font-medium hidden sm:inline">{t("chat.community")}</span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Messages - Scrollable area with wider container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain px-2 sm:px-4 lg:px-8 py-4 sm:py-6 relative"
          onDragOver={(e) => { if (chatMode === "chat") e.preventDefault(); }}
          onDrop={handleDropImages}
        >
          <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                data-message-index={index}
                className={`flex gap-2 sm:gap-3 ${message.role === "user" ? "flex-row-reverse" : ""} animate-fade-in scroll-mt-4`}
              >

                {message.role === "assistant" && (
                  <img src={angelAvatar} alt="Angel AI" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-soft flex-shrink-0" />
                )}
                <div className="flex flex-col gap-2 max-w-[95%] sm:max-w-[92%] lg:max-w-[88%]">
                  {/* File attachment in message */}
                  {message.attachment?.url && (
                    <FileMessageCard
                      name={message.attachment.name}
                      type={message.attachment.type}
                      size={message.attachment.size}
                      url={message.attachment.url}
                    />
                  )}
                  {/* Image in message */}
                  {message.imageUrl && message.type === "image-analysis" && (
                    <div 
                      className="rounded-xl overflow-hidden cursor-pointer"
                      onClick={() => { setSelectedImage(message.imageUrl!); setShowImageDialog(true); }}
                    >
                      <img src={message.imageUrl} alt="Uploaded" className="max-w-xs rounded-xl" />
                    </div>
                  )}
                  {/* Multi-image gallery in a chat message */}
                  {message.imageUrls && message.imageUrls.length > 0 && (
                    <div
                      className={`grid gap-1.5 max-w-md ${
                        message.imageUrls.length === 1
                          ? "grid-cols-1"
                          : message.imageUrls.length === 2
                          ? "grid-cols-2"
                          : message.imageUrls.length <= 4
                          ? "grid-cols-2"
                          : "grid-cols-3"
                      }`}
                    >
                      {message.imageUrls.map((url, i) => (
                        <button
                          type="button"
                          key={`${index}-img-${i}`}
                          onClick={() => { setSelectedImage(url); setShowImageDialog(true); }}
                          className="relative overflow-hidden rounded-lg aspect-square bg-muted"
                        >
                          <img src={url} alt={`Ảnh ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  
                  <div
                    className={`rounded-2xl px-3 sm:px-5 py-3 sm:py-4 ${
                      message.role === "user"
                        ? "bg-sapphire-gradient text-white rounded-br-md shadow-sacred"
                        : "bg-white border border-primary-pale/50 text-foreground rounded-bl-md shadow-soft"
                    }`}
                  >
                    <p className="text-base sm:text-lg leading-relaxed whitespace-pre-wrap break-words message-content">
                      {message.role === "assistant" ? stripMarkdown(message.content) : (message.content || (isLoading && index === messages.length - 1 ? "" : message.content))}
                    </p>
                    {(isLoading || isGenerating || isAnalyzing) && message.role === "assistant" && !message.content && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        <span className="text-xs sm:text-sm text-foreground-muted">
                          {isGenerating ? t("chat.generating") : isAnalyzing ? t("chat.analyzing") : t("chat.thinking")}
                        </span>
                      </div>
                    )}
                    {/* Angel AI Signature inside bubble */}
                    {message.role === "assistant" && message.content && index > 0 && !(isLoading || isGenerating || isAnalyzing) && (
                      <div className="mt-2 pt-1.5 border-t border-dashed border-foreground/10 flex items-center gap-1.5 opacity-50">
                        <img src={angelAiLogo} alt="Angel AI" className="w-3.5 h-3.5 rounded-full" />
                        <span className="text-[10px] text-muted-foreground">🌟 Angel AI — FUN Ecosystem</span>
                      </div>
                    )}
                    {/* Continuation indicator */}
                    {message.role === "assistant" && message.meta?.continued && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-600">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{t("chat.cont.auto")}</span>
                      </div>
                    )}
                    {message.role === "assistant" && message.meta?.canContinue && index === messages.length - 1 && (
                      <div className="mt-3 rounded-xl border border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/20 p-3">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          {t("chat.cont.prompt", { part: message.meta?.part && message.meta.part > 1 ? t("chat.cont.part", { n: message.meta.part }) : "" })}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={handleContinue} disabled={isLoading} className="h-8 px-4 bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold hover:opacity-90">
                            {t("chat.cont.send")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleDeclineContinue} disabled={isLoading} className="h-8 px-4">
                            {t("chat.cont.cancel")}
                          </Button>
                        </div>
                      </div>
                    )}
                    {message.role === "assistant" && message.meta?.truncated && !message.meta?.canContinue && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-600">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <span>{message.meta?.continueDeclined ? t("chat.cont.declined") : t("chat.cont.truncated")}</span>
                      </div>
                    )}

                  </div>

                  {/* Generated image with watermark */}
                  {message.type === "image" && message.imageUrl && (
                    <div className="relative group" data-image-container={index}>
                      <img 
                        src={message.imageUrl} 
                        alt="Generated" 
                        className="max-w-full rounded-xl shadow-lg cursor-pointer"
                        onClick={() => { setSelectedImage(message.imageUrl!); setShowImageDialog(true); }}
                      />
                      {/* Angel AI watermark */}
                      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
                        <img src={angelAiLogo} alt="Angel AI" className="w-5 h-5 rounded-full" />
                        <span className="text-[10px] font-medium text-white/90">Angel AI</span>
                      </div>
                      <button
                        onClick={() => handleDownloadImage(message.imageUrl!)}
                        className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  {/* Action buttons for user messages */}
                  {message.role === "user" && message.content && (
                    <div className="flex items-center gap-2 mr-1 justify-end">
                      <button
                        onClick={() => handleCopyMessage(message)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary-pale/50 rounded-md transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{t("chat.copy")}</span>
                      </button>
                    </div>
                  )}
                  
                  {/* Action buttons for assistant messages */}
                  {message.role === "assistant" && (message.content || message.imageUrl) && !(isLoading || isGenerating || isAnalyzing) && (
                    <div className="flex items-center gap-1 sm:gap-2 ml-1 flex-wrap">
                      {/* Like/Dislike Feedback - Grok style */}
                      <MessageFeedback 
                        messageIndex={index}
                        questionText={getQuestionForAnswer(index)}
                        answerText={message.content}
                      />
                      
                      <div className="w-px h-4 bg-border mx-1 hidden sm:block" />
                      
                      {/* Audio Button */}
                      <AudioButton
                        isLoading={ttsLoading}
                        isPlaying={ttsPlaying}
                        isCurrentMessage={ttsMessageId === `msg-${index}`}
                        onPlay={() => playText(message.content, `msg-${index}`)}
                        onStop={stopAudio}
                      />
                      <button
                        onClick={() => handleCopyMessage(message)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary-pale/50 rounded-md transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span className="hidden sm:inline">{t("chat.copy")}</span>
                      </button>
                      <button
                        onClick={() => handleOpenShare(index, message.content)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                      >
                        <Share2 className="w-3 h-3" />
                        <span className="hidden sm:inline">{t("chat.share")}</span>
                      </button>
                      {isAdmin && message.content && (
                        <button
                          onClick={() => handleSaveToKnowledge(message, index)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          title="Lưu câu trả lời này vào Knowledge (admin)"
                        >
                          <BookmarkPlus className="w-3 h-3" />
                          <span className="hidden sm:inline">{t("chat.saveKnowledge")}</span>
                        </button>
                      )}

                    </div>
                  )}

                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom floating arrow button */}
          {showScrollToBottom && (
            <button
              type="button"
              aria-label="Cuộn xuống tin nhắn mới nhất"
              onClick={() => scrollToBottom("smooth")}
              className="sticky bottom-4 ml-auto mr-2 sm:mr-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm border border-primary/20 text-primary shadow-lg hover:bg-primary hover:text-primary-foreground transition-all animate-fade-in"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
          )}

        </div>

        {/* Uploaded Image Preview */}
        {uploadedImage && (
          <div className="flex-shrink-0 px-3 sm:px-4 lg:px-8 py-2 bg-muted/50 border-t border-border">
            <div className="mx-auto max-w-6xl flex items-center gap-2 sm:gap-3">
              <div className="relative flex-shrink-0">
                <img src={uploadedImage} alt="To process" className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover" />
                <button
                  onClick={() => { setUploadedImage(null); setChatMode("chat"); }}
                  className="absolute -top-1.5 -right-1.5 p-0.5 sm:p-1 bg-destructive text-destructive-foreground rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {chatMode === "edit-image" ? t("chat.editInstruction") : t("chat.askAboutImage")}
                </p>
                {chatMode === "edit-image" && (
                  <select
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value as any)}
                    className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white dark:bg-gray-800 border border-border w-fit"
                  >
                    <option value="spiritual">{t("chat.styleSpiritual")}</option>
                    <option value="realistic">{t("chat.styleRealistic")}</option>
                    <option value="artistic">{t("chat.styleArtistic")}</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mode Indicator - for generate-image only */}
        {chatMode === "generate-image" && !uploadedImage && (
          <div className="flex-shrink-0 px-3 sm:px-4 lg:px-8 py-2 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-t border-border">
            <div className="mx-auto max-w-6xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => setChatMode("chat")}
                  className="p-1.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors group"
                  title="Quay lại chat"
                >
                  <ArrowLeft className="w-4 h-4 text-purple-600 group-hover:text-purple-800 dark:group-hover:text-purple-300" />
                </button>
                <Wand2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-300">
                  {t("chat.mode.image")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-border rounded px-1 py-0.5">
                  <button
                    onClick={() => setImageMode("fast")}
                    className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded transition-colors ${imageMode === "fast" ? "bg-purple-500 text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    ⚡ Siêu tốc
                  </button>
                  <button
                    onClick={() => setImageMode("spiritual")}
                    className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded transition-colors ${imageMode === "spiritual" ? "bg-purple-500 text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    🔮 Tâm linh
                  </button>
                </div>
                {/* Image Size Selector */}
                <div className="flex items-center gap-0.5 bg-white dark:bg-gray-800 border border-border rounded px-1 py-0.5">
                  {(Object.entries(IMAGE_SIZE_OPTIONS) as [ImageSize, typeof IMAGE_SIZE_OPTIONS[ImageSize]][]).map(([key, opt]) => (
                    <button
                      key={key}
                      onClick={() => setImageSize(key)}
                      className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded transition-colors ${imageSize === key ? "bg-purple-500 text-white" : "text-muted-foreground hover:text-foreground"}`}
                      title={`${opt.label} (${opt.width}×${opt.height})`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
                {imageMode === "spiritual" && (
                  <select
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value as any)}
                    className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-white dark:bg-gray-800 border border-border"
                  >
                    <option value="spiritual">{t("chat.styleSpiritual")}</option>
                    <option value="realistic">{t("chat.styleRealistic")}</option>
                    <option value="artistic">{t("chat.styleArtistic")}</option>
                  </select>
                )}
                <button
                  onClick={() => setChatMode("chat")}
                  className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground px-1.5 sm:px-2 py-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                >
                  {t("chat.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multi-image preview strip (up to MAX_CHAT_IMAGES) */}
        {chatImages.length > 0 && (
          <div className="flex-shrink-0 px-3 sm:px-4 lg:px-8 py-2 bg-muted/40 border-t border-border">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] sm:text-xs text-foreground-muted">
                  {chatImages.length}/{MAX_CHAT_IMAGES} ảnh
                  {chatImages.length >= 5 && (
                    <span className="ml-2 text-amber-700">
                      · Nhiều ảnh sẽ tốn nhiều tín dụng hơn — hãy chọn ảnh liên quan trực tiếp
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={clearChatImages}
                  className="text-[11px] sm:text-xs text-destructive hover:underline"
                >
                  Xoá tất cả
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-thin py-1">
                {chatImages.map((ci) => (
                  <div key={ci.id} className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted">
                      <img src={ci.previewUrl} alt="preview" className="w-full h-full object-cover" />
                    </div>
                    {ci.status === "uploading" && (
                      <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                    {ci.status === "error" && (
                      <div className="absolute inset-0 rounded-lg bg-destructive/70 flex items-center justify-center" title={ci.error}>
                        <X className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeChatImage(ci.id)}
                      className="absolute -top-1.5 -right-1.5 p-0.5 bg-destructive text-destructive-foreground rounded-full shadow"
                      aria-label="Xoá ảnh"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* File attachment preview */}
        {(attachedFile || isUploadingAttachment) && (
          <div className="flex-shrink-0 px-3 sm:px-4 lg:px-8 py-2 bg-muted/50 border-t border-border">
            <div className="mx-auto max-w-6xl">
              {attachedFile && (
                <FileAttachmentPreview
                  file={attachedFile}
                  onRemove={() => setAttachedFile(null)}
                  isUploading={isUploadingAttachment}
                />
              )}
            </div>
          </div>
        )}

        {/* Input - Fixed at bottom with safe area padding */}
        <div className="flex-shrink-0 bg-background-pure/95 backdrop-blur-lg border-t border-primary-pale px-3 sm:px-4 lg:px-8 py-2 sm:py-3 safe-area-bottom">
          <form onSubmit={handleSubmit} className="mx-auto max-w-6xl">
            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              {/* Mode buttons - Compact on mobile */}
              <div className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-thin -mx-1 px-1 sm:mx-0 sm:px-0">
                <button
                  type="button"
                  onClick={() => setChatMode("chat")}
                  className={`p-1.5 sm:p-2 rounded-full transition-colors ${chatMode === "chat" ? "bg-primary text-primary-foreground" : "hover:bg-primary-pale"}`}
                  title={t("chat.mode.chat")}
                >
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setChatMode("generate-image")}
                  className={`p-1.5 sm:p-2 rounded-full transition-colors ${chatMode === "generate-image" ? "bg-purple-500 text-white" : "hover:bg-purple-100"}`}
                  title={t("chat.generateImage")}
                >
                  <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                {/* Nút đính kèm file */}
                <button
                  type="button"
                  onClick={() => attachInputRef.current?.click()}
                  disabled={isUploadingAttachment}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-amber-100 transition-colors"
                  title="Đính kèm file (PDF, DOC, MP3, MP4...)"
                >
                  <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                </button>
                {/* Nút chọn ảnh từ thư viện */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-green-100 transition-colors"
                  title={t("chat.selectFromGallery") || "Chọn ảnh từ thư viện"}
                >
                  <ImagePlus className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </button>
                {/* Nút mở camera trực tiếp */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-blue-100 transition-colors"
                  title={t("chat.capturePhoto") || "Chụp ảnh mới"}
                >
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </button>
                {/* File attachment input */}
                <input
                  ref={attachInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileAttach}
                  className="hidden"
                />
                {/* Camera input - mở camera trực tiếp trên mobile */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {/* Gallery input - chọn từ thư viện ảnh (tối đa MAX_CHAT_IMAGES ảnh) */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />

              </div>

              <div className="flex-1 relative flex items-end gap-1.5 sm:gap-2 bg-white rounded-2xl border border-primary-pale focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all duration-300 px-3 sm:px-4 py-2 sm:py-2.5 min-h-[44px]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-resize
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() || chatImages.length > 0) handleSubmit(e as any);
                    }
                  }}
                  onPaste={handlePasteImage}
                  placeholder={
                    chatMode === "generate-image"
                      ? t("chat.placeholderImage")
                      : chatMode === "analyze-image"
                      ? t("chat.placeholderAnalyze")
                      : chatMode === "edit-image"
                      ? t("chat.placeholderEdit")
                      : t("chat.placeholder")
                  }
                  disabled={isLoading || isGenerating || isAnalyzing || isEditing}
                  autoComplete="off"
                  autoCorrect="off"
                  rows={1}
                  className="flex-1 resize-none bg-transparent outline-none text-sm sm:text-base placeholder:text-muted-foreground disabled:opacity-50 leading-relaxed py-0.5 max-h-[200px] overflow-y-auto scrollbar-thin"
                  style={{ height: "auto" }}
                />
                {(() => {
                  const isBusy = isLoading || isGenerating || isAnalyzing || isEditing;
                  // Only chat + analyze-image streams are cancellable via AbortController.
                  const canStop = isBusy && abortControllerRef.current !== null;
                  if (isBusy) {
                    return (
                      <button
                        key="stop"
                        type="button"
                        onClick={canStop ? handleStop : undefined}
                        disabled={!canStop}
                        title={canStop ? "Dừng" : "Đang xử lý..."}
                        aria-label={canStop ? "Dừng" : "Đang xử lý"}
                        className="flex-shrink-0 self-end mb-0.5 p-1.5 sm:p-2 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {canStop ? (
                          <Square className="w-4 h-4" fill="currentColor" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                      </button>
                    );
                  }
                  return (
                    <button
                      key="send"
                      type="submit"
                      disabled={!input.trim() && chatImages.length === 0}
                      title="Gửi"
                      aria-label="Gửi"
                      className="flex-shrink-0 self-end mb-0.5 p-1.5 sm:p-2 rounded-full bg-sapphire-gradient text-white hover:shadow-sacred transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  );
                })()}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Share Dialog */}
      <ChatShareDialog 
        isOpen={shareDialog.isOpen}
        onClose={() => setShareDialog({ isOpen: false, question: "", answer: "" })}
        question={shareDialog.question}
        answer={shareDialog.answer}
        onShareSuccess={() => refreshExtendedStatus()}
      />

      {/* Image Preview Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("chat.viewImage")}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="flex flex-col items-center gap-4">
              <img src={selectedImage} alt="Preview" className="max-h-[70vh] rounded-lg" />
              <button
                onClick={() => handleDownloadImage(selectedImage)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
              >
                <Download className="w-4 h-4" />
                {t("chat.download")}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Action Selection Dialog */}
      <Dialog open={showImageActionDialog} onOpenChange={(open) => {
        if (!open) {
          setPendingImage(null);
        }
        setShowImageActionDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat.selectImageAction")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            {pendingImage && (
              <div className="mx-auto mb-2">
                <img src={pendingImage} alt="Selected" className="max-h-32 rounded-lg object-cover" />
              </div>
            )}
            <button
              onClick={() => handleSelectImageAction("analyze")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Image className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground group-hover:text-blue-700">{t("chat.mode.analyze")}</p>
                <p className="text-xs text-muted-foreground">{t("chat.analyzeDescription")}</p>
              </div>
            </button>
            <button
              onClick={() => handleSelectImageAction("edit")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground group-hover:text-orange-700">{t("chat.mode.edit")}</p>
                <p className="text-xs text-muted-foreground">{t("chat.editDescription")}</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>

    <SignupPromptDialog open={showSignupPrompt} onOpenChange={setShowSignupPrompt} />
    </>
  );
};

export default Chat;
