import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const ANALYZE_URL = `${(import.meta.env.VITE_SUPABASE_URL ?? "")}/functions/v1/analyze-image`;

function hasTextCorruption(text: string): boolean {
  if (text.includes("\uFFFD")) return true;
  return /[a-z]\?\?[a-z]/i.test(text);
}

export function useImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const analyzeImage = useCallback(async (
    imageUrl: string,
    question: string,
    onStream?: (text: string) => void,
    signal?: AbortSignal,
  ) => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Vui long dang nhap de phan tich hinh anh");
      }

      const resp = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ imageUrl, question, stream: false }),
        signal,
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || "Khong the phan tich hinh anh");
      }

      const fullText = data.content || "";
      if (hasTextCorruption(fullText)) {
        console.warn("Text corruption detected in image analysis response");
      }

      setAnalysisResult(fullText);
      onStream?.(fullText);
      return fullText;
    } catch (err: any) {
      if (err?.name === "AbortError") throw err;
      const errorMessage = err.message || "Khong the phan tich hinh anh";
      setError(errorMessage);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult("");
    setError(null);
  }, []);

  return {
    isAnalyzing,
    analysisResult,
    error,
    analyzeImage,
    clearAnalysis,
  };
}
