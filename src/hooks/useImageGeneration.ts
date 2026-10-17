import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GeneratedImage {
  imageUrl: string;
  description: string;
  prompt: string;
  mode?: "fast" | "spiritual";
}

export type ImageGenerationMode = "fast" | "spiritual";

export type ImageSize = "square" | "landscape" | "portrait" | "wide";

export const IMAGE_SIZE_OPTIONS: Record<ImageSize, { width: number; height: number; label: string; icon: string }> = {
  square: { width: 1024, height: 1024, label: "1:1", icon: "⬜" },
  landscape: { width: 1344, height: 768, label: "16:9", icon: "🖼️" },
  portrait: { width: 768, height: 1344, label: "9:16", icon: "📱" },
  wide: { width: 1536, height: 640, label: "21:9", icon: "🎬" },
};

export function useImageGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateImage = useCallback(async (
    prompt: string,
    style: "spiritual" | "realistic" | "artistic" = "spiritual",
    mode: ImageGenerationMode = "fast",
    size: ImageSize = "square"
  ) => {
    setIsGenerating(true);
    setError(null);

    const sizeConfig = IMAGE_SIZE_OPTIONS[size];

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Vui long dang nhap de tao hinh anh");
      }

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ prompt, style, mode, image_width: sizeConfig.width, image_height: sizeConfig.height }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `generate-image failed: ${resp.status}`);
      if (data?.error) {
        throw new Error(data.error);
      }

      setGeneratedImage(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || "Không thể tạo hình ảnh";
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const clearImage = useCallback(() => {
    setGeneratedImage(null);
    setError(null);
  }, []);

  return {
    isGenerating,
    generatedImage,
    error,
    generateImage,
    clearImage
  };
}
