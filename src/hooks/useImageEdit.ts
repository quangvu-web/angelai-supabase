import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EditedImage {
  imageUrl: string;
  description: string;
  instruction: string;
}

export function useImageEdit() {
  const [isEditing, setIsEditing] = useState(false);
  const [editedImage, setEditedImage] = useState<EditedImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editImage = useCallback(async (
    imageUrl: string, 
    instruction: string, 
    style: "spiritual" | "realistic" | "artistic" = "spiritual"
  ) => {
    setIsEditing(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Vui long dang nhap de chinh sua hinh anh");
      }

      const resp = await fetch(`${(import.meta.env.VITE_SUPABASE_URL ?? "")}/functions/v1/edit-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ imageUrl, instruction, style }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `edit-image failed: ${resp.status}`);
      if (data?.error) {
        throw new Error(data.error);
      }

      setEditedImage(data);
      return data;
    } catch (err: any) {
      const errorMessage = err.message || "Không thể chỉnh sửa hình ảnh";
      setError(errorMessage);
      throw err;
    } finally {
      setIsEditing(false);
    }
  }, []);

  const clearEdit = useCallback(() => {
    setEditedImage(null);
    setError(null);
  }, []);

  return {
    isEditing,
    editedImage,
    error,
    editImage,
    clearEdit
  };
}
