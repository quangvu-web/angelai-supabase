import { useState, useRef, useEffect } from "react";
import { Image, Send, X, Loader2, Plus, Smile, Video, Play, CheckCircle2, Shield, Upload, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import angelAvatar from "@/assets/angel-avatar.png";
import { motion, AnimatePresence } from "framer-motion";
import { fullContentCheck, checkImageFilename } from "@/lib/contentModeration";
import { ContentModerationDialog } from "./ContentModerationDialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { extractImagesFromClipboard } from "@/lib/pasteImageHandler";

const MAX_IMAGES = 30;
const MAX_VIDEO_SIZE_MB = 250;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"];

interface CollapsibleCreatePostProps {
  userAvatar?: string | null;
  userName?: string;
  onSubmit: (content: string, imageUrls?: string[], videoUrl?: string) => Promise<{ success: boolean; message: string }>;
}

export function CollapsibleCreatePost({ userAvatar, userName, onSubmit }: CollapsibleCreatePostProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading_images' | 'uploading_video' | 'moderating' | 'publishing'>('idle');
  const [uploadLabel, setUploadLabel] = useState("");
  const [moderationDialogOpen, setModerationDialogOpen] = useState(false);
  const [moderationMessage, setModerationMessage] = useState("");
  const [moderationBlockedItems, setModerationBlockedItems] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  // Close on click outside (only if no content)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        !content.trim() &&
        imageFiles.length === 0 &&
        !videoFile &&
        !isSubmitting &&
        uploadStep === 'idle'
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded, content, imageFiles.length, videoFile, isSubmitting, uploadStep]);

  const addImageFiles = (files: File[]) => {
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - imageFiles.length;
    if (remainingSlots <= 0) {
      alert(`Đã đạt giới hạn ${MAX_IMAGES} ảnh.`);
      return;
    }
    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      alert(`Chỉ thêm được ${remainingSlots} ảnh nữa (tối đa ${MAX_IMAGES} ảnh).`);
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of filesToProcess) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`Ảnh "${file.name}" vượt quá 5MB`);
        continue;
      }

      const imageCheck = checkImageFilename(file.name);
      if (!imageCheck.isAllowed) {
        setModerationMessage(imageCheck.gentleReminder);
        setModerationBlockedItems(imageCheck.blockedItems || []);
        setModerationDialogOpen(true);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        newPreviews.push(reader.result as string);
        if (newPreviews.length === validFiles.length) {
          setImagePreviews((prev) => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setImageFiles((prev) => [...prev, ...validFiles]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addImageFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedImages = extractImagesFromClipboard(e);
    if (pastedImages.length > 0) {
      e.preventDefault();
      addImageFiles(pastedImages);
      if (!isExpanded) setIsExpanded(true);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      alert("Định dạng video không được hỗ trợ. Vui lòng chọn MP4, WebM, MOV, AVI hoặc MKV.");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      alert(`Video vuot qua ${MAX_VIDEO_SIZE_MB}MB. Vui long chon video nho hon.`);
      return;
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);

    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoFile(null);
    setVideoPreview(null);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        setUploadLabel(`Đang tải ảnh ${i + 1}/${files.length}...`);

        const { error: uploadError } = await supabase.storage
          .from("community")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("community")
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }

      return uploadedUrls;
    } catch (error) {
      console.error("Error uploading images:", error);
      return uploadedUrls;
    }
  };

  const uploadVideo = async (file: File): Promise<{ publicUrl: string; path: string } | null> => {
    try {
      const fileExt = file.name.split(".").pop() || "mp4";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      const fileSizeMB = file.size / (1024 * 1024);

      // Use resumable upload for files > 50MB via tus protocol
      if (fileSizeMB > 50) {
        setUploadLabel(`Đang tải video (${(fileSizeMB / 1024).toFixed(1)}GB)...`);
        
        const { data, error } = await supabase.storage
          .from("community")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            // Supabase JS SDK handles chunked upload automatically for large files
          });

        if (error) {
          console.error("Video upload error:", error);
          return null;
        }
      } else {
        setUploadLabel("Đang tải video...");
        const { error } = await supabase.storage
          .from("community")
          .upload(filePath, file);

        if (error) {
          console.error("Video upload error:", error);
          return null;
        }
      }

      const { data: urlData } = supabase.storage
        .from("community")
        .getPublicUrl(filePath);

      return { publicUrl: urlData.publicUrl, path: filePath };
    } catch (error) {
      console.error("Error uploading video:", error);
      return null;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
    return `${(bytes / 1024).toFixed(0)}KB`;
  };

  const handleSubmit = async () => {
    if (!content.trim() && imageFiles.length === 0 && !videoFile) return;

    // Content moderation check before submitting
    const moderationResult = fullContentCheck(content.trim(), imageFiles);
    if (!moderationResult.isAllowed) {
      setModerationMessage(moderationResult.gentleReminder);
      setModerationBlockedItems(moderationResult.blockedItems || []);
      setModerationDialogOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrls: string[] | undefined;
      let videoUrl: string | undefined;
      let uploadedVideoPath: string | undefined;

      // Step 1: Upload images
      if (imageFiles.length > 0) {
        setUploadStep('uploading_images');
        setUploadLabel(t("community.uploadingImages"));
        imageUrls = await uploadImages(imageFiles);
        if (imageUrls.length === 0) {
          console.error("Failed to upload images");
        }
      }

      // Step 2: Upload video
      if (videoFile) {
        setUploadStep('uploading_video');
        const fileSizeMB = videoFile.size / (1024 * 1024);
        setUploadLabel(`Đang tải video (${formatFileSize(videoFile.size)})...`);
        const uploadedVideo = await uploadVideo(videoFile);
        if (uploadedVideo) {
          videoUrl = uploadedVideo.publicUrl;
          uploadedVideoPath = uploadedVideo.path;
        } else {
          alert("Không thể tải video lên. Vui lòng thử lại.");
          setUploadStep('idle');
          setIsSubmitting(false);
          return;
        }
      }

      // Step 3: Moderating (for video posts)
      if (videoUrl) {
        setUploadStep('moderating');
        setUploadLabel("Đang kiểm duyệt nội dung...");
      }

      // Step 4: Publishing
      setUploadStep('publishing');
      setUploadLabel("Đang xuất bản bài viết...");
      
      const result = await onSubmit(content.trim(), imageUrls, videoUrl);

      if (result.success) {
        setContent("");
        setImageFiles([]);
        setImagePreviews([]);
        removeVideo();
        setIsExpanded(false);
      } else if ((result as any).reason === "video_moderation_failed") {
        if (uploadedVideoPath) {
          const { error: removeError } = await supabase.storage.from("community").remove([uploadedVideoPath]);
          if (removeError) console.error("Failed to delete rejected video:", removeError);
        }
        setModerationMessage(result.message);
        setModerationBlockedItems((result as any).moderationReason ? [(result as any).moderationReason] : []);
        setModerationDialogOpen(true);
        removeVideo();
      } else if (uploadedVideoPath) {
        const { error: removeError } = await supabase.storage.from("community").remove([uploadedVideoPath]);
        if (removeError) console.error("Failed to delete unpublished video:", removeError);
      }
    } finally {
      setIsSubmitting(false);
      setUploadStep('idle');
      setUploadLabel("");
    }
  };

  return (
    <Card 
      ref={containerRef}
      className="border-primary/10 bg-white/90 backdrop-blur-sm w-full max-w-full overflow-hidden shadow-sm relative z-30"
    >
      <CardContent className="p-3 sm:p-4">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            // Collapsed state - single line
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setIsExpanded(true)}
            >
              <Avatar className="w-10 h-10 border-2 border-primary/20 shrink-0">
                <AvatarImage src={userAvatar || angelAvatar} alt={userName} />
                <AvatarFallback>{userName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="bg-muted/50 hover:bg-muted/70 transition-colors rounded-full px-4 py-2.5 text-foreground-muted text-sm sm:text-base">
                  {t("community.sharePlaceholder")}
                </div>
              </div>
            </motion.div>
          ) : (
            // Expanded state - full form
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Header with close button */}
              <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border-2 border-primary/20 shrink-0">
                    <AvatarImage src={userAvatar || angelAvatar} alt={userName} />
                    <AvatarFallback>{userName?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm text-foreground">{userName || t("common.you")}</p>
                    <p className="text-xs text-foreground-muted">{t("community.creatingPost")}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-foreground-muted hover:text-foreground"
                  onClick={() => {
                    if (!content.trim() && imageFiles.length === 0 && !videoFile) {
                      setIsExpanded(false);
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Textarea */}
              <Textarea
                ref={textareaRef}
                placeholder={t("community.sharePlaceholder")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                className="min-h-[120px] sm:min-h-[150px] resize-none border-0 focus-visible:ring-0 text-base sm:text-lg leading-relaxed p-0 placeholder:text-foreground-muted/60"
              />

              {/* Video Preview */}
              {videoPreview && videoFile && (
                <div className="relative rounded-xl overflow-hidden bg-black/5 border border-primary/10">
                  <video
                    src={videoPreview}
                    className="w-full max-h-[300px] object-contain rounded-xl"
                    controls
                    preload="metadata"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-md"
                    onClick={removeVideo}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 text-white rounded-md text-xs">
                    <Video className="w-3 h-3" />
                    <span>{videoFile.name.length > 20 ? videoFile.name.slice(0, 20) + "..." : videoFile.name}</span>
                    <span className="opacity-70">({formatFileSize(videoFile.size)})</span>
                  </div>
                </div>
              )}

              {/* Image Previews Grid */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group aspect-square">
                      <img
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
                        {index + 1}
                      </span>
                    </div>
                  ))}

                  {imageFiles.length < MAX_IMAGES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/50 flex flex-col items-center justify-center text-primary/60 hover:text-primary/80 transition-colors"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-xs mt-1">{imageFiles.length}/{MAX_IMAGES}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Step-based Upload Progress */}
              {uploadStep !== 'idle' && (
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-2">
                  {/* Steps indicator */}
                  <div className="flex items-center gap-2">
                    {/* Step icons with status */}
                    {[
                      { step: 'uploading_images' as const, icon: Upload, label: 'Tải ảnh' },
                      { step: 'uploading_video' as const, icon: Video, label: 'Tải video' },
                      { step: 'moderating' as const, icon: Shield, label: 'Kiểm duyệt' },
                      { step: 'publishing' as const, icon: Rocket, label: 'Xuất bản' },
                    ]
                      .filter(s => {
                        // Only show relevant steps
                        if (s.step === 'uploading_images' && imageFiles.length === 0) return false;
                        if (s.step === 'uploading_video' && !videoFile) return false;
                        if (s.step === 'moderating' && !videoFile) return false;
                        return true;
                      })
                      .map((s, idx, arr) => {
                        const stepOrder = ['uploading_images', 'uploading_video', 'moderating', 'publishing'];
                        const currentIdx = stepOrder.indexOf(uploadStep);
                        const thisIdx = stepOrder.indexOf(s.step);
                        const isDone = thisIdx < currentIdx;
                        const isCurrent = s.step === uploadStep;
                        const Icon = s.icon;
                        
                        return (
                          <div key={s.step} className="flex items-center gap-1.5">
                            {idx > 0 && <div className={`w-4 h-px ${isDone ? 'bg-primary' : 'bg-primary/20'}`} />}
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                              isDone 
                                ? 'bg-primary/15 text-primary' 
                                : isCurrent 
                                  ? 'bg-primary/10 text-primary animate-pulse' 
                                  : 'bg-muted/50 text-muted-foreground'
                            }`}>
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : isCurrent ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Icon className="w-3.5 h-3.5 opacity-50" />
                              )}
                              <span className="hidden sm:inline">{s.label}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  
                  {/* Current step description */}
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
                    {uploadLabel}
                  </p>
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-between pt-2 border-t border-primary/10">
                <div className="flex gap-1">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
                    onChange={handleVideoSelect}
                    ref={videoInputRef}
                    className="hidden"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting || uploadStep !== 'idle' || imageFiles.length >= MAX_IMAGES}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Image className="w-5 h-5" />
                    <span className="hidden sm:inline ml-1">{t("community.images")} ({imageFiles.length}/{MAX_IMAGES})</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isSubmitting || uploadStep !== 'idle' || !!videoFile}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Video className="w-5 h-5" />
                    <span className="hidden sm:inline ml-1">Video {videoFile ? "✓" : ""}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                  >
                    <Smile className="w-5 h-5" />
                    <span className="hidden sm:inline ml-1">{t("community.feelings")}</span>
                  </Button>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={(!content.trim() && imageFiles.length === 0 && !videoFile) || isSubmitting || uploadStep !== 'idle'}
                  className="bg-primary hover:bg-primary/90"
                  size="sm"
                >
                  {isSubmitting || uploadStep !== 'idle' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {t("community.post")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
      
      {/* Content Moderation Dialog */}
      <ContentModerationDialog
        open={moderationDialogOpen}
        onClose={() => setModerationDialogOpen(false)}
        message={moderationMessage}
        blockedItems={moderationBlockedItems}
      />
    </Card>
  );
}
