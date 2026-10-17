import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseTextToSpeechReturn {
  isLoading: boolean;
  isPlaying: boolean;
  isDownloading: boolean;
  currentMessageId: string | null;
  playText: (text: string, messageId: string) => Promise<void>;
  stopAudio: () => void;
  togglePlayPause: () => void;
  downloadAudio: (text: string, filename?: string) => Promise<void>;
}

// 1x1 silent mp3 used to "unlock" audio playback inside the click gesture
const SILENT_MP3 =
  "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAADSAAAAEVj4b8LZ8mLTLMxSJgvvBWMWpxWtc2ykrjSlxdrMk7WEQlJMlfLQCEqEHwHnQlYLKY6BhkPJHIeGkYs3vJp0eBSlxLZmR1TnBBjMvNGRQXjNPfmp0dV3RwPFXOCzYcHhkeC8HAfDwfB4Hj4Zh4Hg8BwAA";

// Helper to clean text for TTS
const cleanTextForTTS = (text: string): string => {
  return (text || "")
    .replace(/```[\s\S]*?```/g, "") // Code blocks
    .replace(/`([^`]+)`/g, "$1") // Inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // Images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/<[^>]+>/g, " ") // HTML tags
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // Headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^\s*>\s?/gm, "") // Blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // Bullet lists
    .replace(/^\s*\d+[.)]\s+/gm, "") // Numbered lists
    .replace(/^\s*([-*_]\s*){3,}\s*$/gm, "") // Horizontal rules
    .replace(/\|/g, " ") // Table pipes
    .replace(/https?:\/\/\S+/g, "") // Raw URLs
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

// Browser fallback voice (free) when the TTS service is unavailable
const speakWithBrowser = (
  text: string,
  onEnd: () => void
): boolean => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 5000));
    utterance.lang = "vi-VN";
    utterance.rate = 1;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
};

// Helper to fetch audio from TTS API
const fetchTTSAudio = async (text: string): Promise<Blob> => {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "");
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Vui lòng đăng nhập để tạo giọng đọc");
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/elevenlabs-tts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as any));
    if (response.status === 429) {
      throw new Error("Bạn đã dùng hết lượt nghe hôm nay");
    }
    throw new Error(errorData.error || `TTS failed: ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error("Không nhận được dữ liệu âm thanh");
  return blob;
};

export function useTextToSpeech(): UseTextToSpeechReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setCurrentMessageId(null);
  }, []);

  const stopAudio = useCallback(() => {
    cleanupAudio();
  }, [cleanupAudio]);

  const playText = useCallback(async (text: string, messageId: string) => {
    // If same message is playing, toggle pause/play
    if (currentMessageId === messageId && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        void audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    // Stop any existing audio
    cleanupAudio();

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) {
      toast.error("Không có nội dung để đọc");
      return;
    }

    setIsLoading(true);
    setCurrentMessageId(messageId);

    // Create + unlock the audio element inside the user gesture so that
    // autoplay policies (especially inside preview iframes) don't block playback
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = SILENT_MP3;
    audioRef.current = audio;
    try {
      await audio.play();
      audio.pause();
    } catch {
      /* unlock attempt failed; we still try the real playback below */
    }

    try {
      const audioBlob = await fetchTTSAudio(cleanText);

      // Stopped while loading
      if (audioRef.current !== audio) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      audio.src = audioUrl;

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentMessageId(null);
      };

      audio.onerror = () => {
        toast.error("Lỗi phát audio");
        cleanupAudio();
      };

      await audio.play();
      setIsPlaying(true);
    } catch (error: any) {
      console.error("TTS Error:", error);
      // Fallback: read with the free browser voice so the button always works
      const started = speakWithBrowser(cleanText, () => {
        setIsPlaying(false);
        setCurrentMessageId(null);
      });
      if (started) {
        setIsPlaying(true);
        toast.info("Đang đọc bằng giọng trình duyệt", { duration: 2000 });
      } else {
        toast.error(error?.message || "Không thể tạo giọng đọc");
        cleanupAudio();
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentMessageId, isPlaying, cleanupAudio]);

  const togglePlayPause = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        void audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  const downloadAudio = useCallback(async (text: string, filename?: string) => {
    setIsDownloading(true);

    try {
      const cleanText = cleanTextForTTS(text);

      if (!cleanText) {
        toast.error("Không có nội dung để tải");
        return;
      }

      toast.info("Đang tạo file MP3...", { duration: 2000 });

      const audioBlob = await fetchTTSAudio(cleanText);
      
      // Create download link
      const downloadUrl = URL.createObjectURL(audioBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename || `angel-ai-audio-${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      toast.success("Đã tải file MP3 thành công!");
    } catch (error: any) {
      console.error("Download TTS Error:", error);
      toast.error(error.message || "Không thể tải file MP3");
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return {
    isLoading,
    isPlaying,
    isDownloading,
    currentMessageId,
    playText,
    stopAudio,
    togglePlayPause,
    downloadAudio,
  };
}
